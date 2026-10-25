import { getCachedOniPropertyTextures } from './oniPropertyTextures'
import type { OniTerrainRenderInput } from './oniRenderer'
import { GLSL_HEADER, GLSL_HSL, GLSL_WORLD_ZONE_TINT } from './oniShaderCommon'
import {
  ONI_GAS_BAD_GAS_TEXTURE_KEY,
  ONI_GAS_DETAIL_TEXTURE_KEY,
  ONI_GAS_TEST_MATERIAL,
  ONI_LIGHTING_SETTINGS,
} from './oniShaders'

/**
 * Port of `Klei/GasTest` from
 * `ExportedProject/Assets/Shaders/World/Resources/gastest.shader`.
 *
 * Alpha follows the shader exactly:
 *   `opacity     = mix(_GasOpacity.x, _GasOpacity.y, sqrt(pressure))`
 *   `bgDetail    = _GasDetailTex / _BGUVScaleOffset.xx`
 *   `fgDetail    = _GasDetailTex / _FGUVScaleOffset.xx`
 *   `detail      = mix(mix(bg, badGas.a, danger), mix(fg, badGas.a, danger),
 *                      abs(_GasParameters.x - 0.5) * 2)`
 *   `alpha       = clamp(detail^2 * opacity * clamp(pressure, 0, 1) * _SpaceAlphaScale, 0, 1)`
 *   `SV_Target0.w = alpha * _Alpha`
 *
 * Colour is `sqrt(mix(gas^2 * _DarkenTintBackground, gas^2, light))` blended with the
 * world-zone tint by `_WorldZoneGasBlend`. `_LightBufferTex` is the game's
 * deferred light buffer, which the browser has no equivalent of yet, so the port
 * uses the shader's unlit limit (`light = 0`) instead of sampling it.
 */
const VERTEX_SHADER = `${GLSL_HEADER}
in vec2 a_position;
in vec2 a_world;
uniform vec2 u_viewport;
uniform vec2 u_grid_size;
out vec2 v_world;
out vec2 v_property_uv;
void main() {
  vec2 clip = vec2(a_position.x / u_viewport.x * 2.0 - 1.0, 1.0 - a_position.y / u_viewport.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  v_world = a_world;
  v_property_uv = vec2((a_world.x + 1.5) / u_grid_size.x, 1.0 - (a_world.y + 1.5) / u_grid_size.y);
}`

const FRAGMENT_SHADER = `${GLSL_HEADER}
uniform sampler2D u_world_zone;
uniform sampler2D u_gas_pressure;
uniform sampler2D u_gas_colour;
uniform sampler2D u_gas_danger;
uniform sampler2D u_gas_detail;
uniform sampler2D u_bad_gas;
uniform vec2 u_gas_opacity;
uniform float u_space_alpha_scale;
uniform float u_alpha;
uniform float u_world_zone_gas_blend;
uniform vec3 u_darken_tint_background;
uniform float u_gas_phase;
uniform float u_time;
uniform float u_background_uv_scale;
uniform float u_foreground_uv_scale;
in vec2 v_world;
in vec2 v_property_uv;
out vec4 outColor;
${GLSL_HSL}
${GLSL_WORLD_ZONE_TINT}
void main() {
  float pressure = texture(u_gas_pressure, v_property_uv).r;
  // "_GasPressureTex.Sample(...).wxyz" puts the stored pressure byte in .x.
  vec3 gasColour = texture(u_gas_colour, v_property_uv).rgb;
  float danger = texture(u_gas_danger, v_property_uv).r;
  // Saves contain density but no live FlowOffsetRenderer velocity field.
  // Advect the two detail planes gently in world coordinates; keep the saved
  // pressure/colour masks stationary so artwork never transports matter.
  vec2 backgroundUV = (v_world + vec2(0.055, -0.08) * u_time) / u_background_uv_scale;
  vec2 foregroundUV = (v_world + vec2(-0.08, -0.04) * u_time) / u_foreground_uv_scale;
  float backgroundDetail = mix(texture(u_gas_detail, backgroundUV).r,
                               texture(u_bad_gas, backgroundUV).a, danger);
  float foregroundDetail = mix(texture(u_gas_detail, foregroundUV).r,
                               texture(u_bad_gas, foregroundUV).a, danger);
  float detailPhase = abs(u_gas_phase - 0.5) * 2.0;
  float detail = mix(backgroundDetail, foregroundDetail, detailPhase);
  float gasOpacity = mix(u_gas_opacity.x, u_gas_opacity.y, sqrt(pressure));
  float detailAlpha = detail * detail * gasOpacity;
  float normalizedPressure = clamp(pressure, 0.0, 1.0);
  float pressureAlpha = detailAlpha * normalizedPressure;
  // SubworldZoneRenderData creates WorldZoneTex as RGB24, whose sampled alpha
  // is implicitly 1. Preserve that contract, including the source shader's
  // alpha-based SpaceAlphaScale branch; do not invent a saved zone alpha.
  vec4 zoneSample = texture(u_world_zone, v_property_uv);
  vec3 zone = zoneSample.rgb;
  // GasTest: spaceAlpha = clamp(pressureAlpha * _SpaceAlphaScale, 0, 1), then
  // alpha = mix(pressureAlpha, spaceAlpha, zone.a). So the _SpaceAlphaScale
  // clamp only applies inside the space region.
  float spaceAlpha = clamp(pressureAlpha * u_space_alpha_scale, 0.0, 1.0);
  float alpha = mix(pressureAlpha, spaceAlpha, zoneSample.a) * u_alpha;
  // _LightBufferTex is unavailable; light = 0 is the shader's unlit limit.
  vec3 gasLinear = gasColour * gasColour;
  vec3 litGas = sqrt(gasLinear * u_darken_tint_background);
  vec3 zoneTint = worldZoneTinted(litGas, zone);
  outColor = vec4(mix(litGas, zoneTint, u_world_zone_gas_blend), alpha);
}`

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('无法创建 ONI 气体 Shader。')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'ONI 气体 Shader 编译失败。')
  return shader
}

export class OniGasWebGLRenderer {
  private canvas?: HTMLCanvasElement
  private gl?: WebGL2RenderingContext
  private program?: WebGLProgram
  private buffer?: WebGLBuffer
  private worldZone?: WebGLTexture
  private pressure?: WebGLTexture
  private colour?: WebGLTexture
  private danger?: WebGLTexture
  private images = new WeakMap<HTMLImageElement, WebGLTexture>()
  private uploadedPropertyCacheKey?: object

  private initialize(width: number, height: number): WebGL2RenderingContext | undefined {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas')
      this.gl = this.canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: false }) ?? undefined
      if (!this.gl) return undefined
      try {
        const program = this.gl.createProgram()
        if (!program) return undefined
        const vertex = compile(this.gl, this.gl.VERTEX_SHADER, VERTEX_SHADER)
        const fragment = compile(this.gl, this.gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
        this.gl.attachShader(program, vertex)
        this.gl.attachShader(program, fragment)
        this.gl.linkProgram(program)
        this.gl.deleteShader(vertex)
        this.gl.deleteShader(fragment)
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) throw new Error(this.gl.getProgramInfoLog(program) ?? 'ONI 气体 Shader 链接失败。')
        this.program = program
        this.buffer = this.gl.createBuffer() ?? undefined
      } catch (cause) {
        console.error('ONI GasTest WebGL 初始化失败，已回退 Canvas2D。', cause)
        this.program = undefined
        this.buffer = undefined
        return undefined
      }
    }
    if (!this.gl || !this.canvas) return undefined
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
      this.gl.viewport(0, 0, width, height)
    }
    return this.gl
  }

  private rawTexture(current: WebGLTexture | undefined, width: number, height: number, format: number, data: Uint8Array): WebGLTexture | undefined {
    const gl = this.gl
    if (!gl) return undefined
    const texture = current ?? gl.createTexture() ?? undefined
    if (!texture) return undefined
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    const internal = format === gl.RGBA ? gl.RGBA8 : format === gl.RGB ? gl.RGB8 : gl.R8
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, format, gl.UNSIGNED_BYTE, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  }

  private imageTexture(image: HTMLImageElement): WebGLTexture | undefined {
    const gl = this.gl
    if (!gl) return undefined
    const cached = this.images.get(image)
    if (cached) return cached
    const texture = gl.createTexture() ?? undefined
    if (!texture) return undefined
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    this.images.set(image, texture)
    return texture
  }

  render(input: OniTerrainRenderInput): boolean {
    const detailImage = input.textures[ONI_GAS_DETAIL_TEXTURE_KEY]
    const dangerImage = input.textures[ONI_GAS_BAD_GAS_TEXTURE_KEY]
    if (!detailImage || !dangerImage) return false
    const gl = this.initialize(input.context.canvas.width, input.context.canvas.height)
    if (!gl || !this.canvas || !this.program || !this.buffer) return false
    const propertyKey = input.propertyCacheKey
    const properties = getCachedOniPropertyTextures(input)
    const needsPropertyUpload = !propertyKey || this.uploadedPropertyCacheKey !== propertyKey
    if (needsPropertyUpload) {
      this.worldZone = this.rawTexture(this.worldZone, properties.width, properties.height, gl.RGB, properties.worldZone)
      this.pressure = this.rawTexture(this.pressure, properties.width, properties.height, gl.RED, properties.gasPressure)
      this.colour = this.rawTexture(this.colour, properties.width, properties.height, gl.RGBA, properties.gasColour)
      this.danger = this.rawTexture(this.danger, properties.width, properties.height, gl.RED, properties.gasDanger)
      if (propertyKey) this.uploadedPropertyCacheKey = propertyKey
    }

    // Draw only the requested world-cell range. A retained chunk surface has
    // an origin relative to the complete world, so using the old full-world
    // quad here made the GPU rasterize (and interpolate across) the entire
    // world for every chunk. At map edges it also filled the chunk gutter by
    // sampling the clamped border texels. The half-cell world coordinates are
    // the same coordinates used by the old full-world quad; only its bounds
    // are narrowed to the requested columns and top-origin rows.
    const requestedRange = input.clipToRange
      ? input.range
      : { minX: 0, maxX: input.width - 1, minRow: 0, maxRow: input.height - 1 }
    const minX = Math.max(0, Math.min(input.width - 1, requestedRange.minX))
    const maxX = Math.max(minX, Math.min(input.width - 1, requestedRange.maxX))
    const minRow = Math.max(0, Math.min(input.height - 1, requestedRange.minRow))
    const maxRow = Math.max(minRow, Math.min(input.height - 1, requestedRange.maxRow))
    const left = input.originX + minX * input.cellSize
    const top = input.originY + minRow * input.cellSize
    const right = input.originX + (maxX + 1) * input.cellSize
    const bottom = input.originY + (maxRow + 1) * input.cellSize
    const worldLeft = minX - .5
    const worldRight = maxX + .5
    const worldTop = input.height - minRow - .5
    const worldBottom = input.height - maxRow - 1.5
    const vertices = new Float32Array([
      left, top, worldLeft, worldTop, right, top, worldRight, worldTop, left, bottom, worldLeft, worldBottom,
      left, bottom, worldLeft, worldBottom, right, top, worldRight, worldTop, right, bottom, worldRight, worldBottom,
    ])
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)
    // This canvas contains one gas pass. Preserve its straight RGBA; Canvas2D
    // applies SrcAlpha/OneMinusSrcAlpha once when compositing the layer.
    // Blending onto transparent black here squared alpha and darkened RGB.
    gl.disable(gl.BLEND)
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_viewport'), this.canvas.width, this.canvas.height)
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_grid_size'), properties.width, properties.height)
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_gas_opacity'), ONI_LIGHTING_SETTINGS.gasMinOpacity, ONI_LIGHTING_SETTINGS.gasMaxOpacity)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_space_alpha_scale'), ONI_GAS_TEST_MATERIAL.spaceAlphaScale)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_alpha'), ONI_GAS_TEST_MATERIAL.alpha)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_world_zone_gas_blend'), ONI_LIGHTING_SETTINGS.worldZoneGasBlend)
    const backgroundTint = ONI_LIGHTING_SETTINGS.darkenTintBackground
    gl.uniform3f(gl.getUniformLocation(this.program, 'u_darken_tint_background'), backgroundTint[0], backgroundTint[1], backgroundTint[2])
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_time'), input.timeSeconds ?? 0)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_gas_phase'), ONI_GAS_TEST_MATERIAL.flowPhase + .2 * Math.sin((input.timeSeconds ?? 0) * .35))
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_background_uv_scale'), ONI_GAS_TEST_MATERIAL.backgroundUvScale)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_foreground_uv_scale'), ONI_GAS_TEST_MATERIAL.foregroundUvScale)
    const bind = (unit: number, name: string, texture: WebGLTexture | undefined) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, texture ?? null)
      gl.uniform1i(gl.getUniformLocation(this.program!, name), unit)
    }
    bind(0, 'u_world_zone', this.worldZone)
    bind(1, 'u_gas_pressure', this.pressure)
    bind(2, 'u_gas_colour', this.colour)
    bind(3, 'u_gas_danger', this.danger)
    bind(4, 'u_gas_detail', this.imageTexture(detailImage))
    bind(5, 'u_bad_gas', this.imageTexture(dangerImage))
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW)
    const position = gl.getAttribLocation(this.program, 'a_position')
    const world = gl.getAttribLocation(this.program, 'a_world')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(world)
    gl.vertexAttribPointer(world, 2, gl.FLOAT, false, 16, 8)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    input.context.drawImage(this.canvas, 0, 0)
    return true
  }
}


