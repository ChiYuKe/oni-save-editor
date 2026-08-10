import { buildOniPropertyTextures } from './oniPropertyTextures'
import type { OniTerrainRenderInput } from './oniRenderer'

const VERTEX_SHADER = `#version 300 es
precision highp float;
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
  v_property_uv = vec2((a_world.x + 1.0) / u_grid_size.x, 1.0 - (a_world.y + 1.0) / u_grid_size.y);
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_world_zone;
uniform sampler2D u_gas_pressure;
uniform sampler2D u_gas_colour;
uniform sampler2D u_gas_danger;
uniform sampler2D u_gas_detail;
uniform sampler2D u_bad_gas;
in vec2 v_world;
in vec2 v_property_uv;
out vec4 outColor;

vec3 rgb2hsl(vec3 c) {
  float hi = max(c.r, max(c.g, c.b));
  float lo = min(c.r, min(c.g, c.b));
  float d = hi - lo;
  float l = (hi + lo) * 0.5;
  float s = d == 0.0 ? 0.0 : d / (1.0 - abs(2.0 * l - 1.0));
  float h = 0.0;
  if (d != 0.0) {
    if (hi == c.r) h = mod((c.g - c.b) / d, 6.0);
    else if (hi == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h = fract(h / 6.0);
  }
  return vec3(h, s, l);
}
float hue2rgb(float p, float q, float t) {
  t = fract(t);
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}
vec3 hsl2rgb(vec3 hsl) {
  if (hsl.y == 0.0) return vec3(hsl.z);
  float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
  float p = 2.0 * hsl.z - q;
  return vec3(hue2rgb(p, q, hsl.x + 1.0 / 3.0), hue2rgb(p, q, hsl.x), hue2rgb(p, q, hsl.x - 1.0 / 3.0));
}
void main() {
  float pressure = texture(u_gas_pressure, v_property_uv).r;
  if (pressure <= 0.0) discard;
  vec3 gasColour = texture(u_gas_colour, v_property_uv).rgb;
  float danger = texture(u_gas_danger, v_property_uv).r;
  float backgroundDetail = mix(texture(u_gas_detail, v_world / 17.0).r, texture(u_bad_gas, v_world / 17.0).a, danger);
  float foregroundDetail = mix(texture(u_gas_detail, v_world / 25.0).r, texture(u_bad_gas, v_world / 25.0).a, danger);
  // FlowOffsetRenderer phase is zero for a deterministic save preview. At
  // phase zero GasTest.shader selects the foreground sample exactly.
  float detail = mix(backgroundDetail, foregroundDetail, 1.0);
  float alpha = detail * detail * sqrt(pressure) * pressure * 0.5;
  vec3 zone = texture(u_world_zone, v_property_uv).rgb;
  vec3 gasHsl = rgb2hsl(gasColour);
  vec3 zoneHsl = rgb2hsl(zone);
  vec3 zoneTint = hsl2rgb(vec3(zoneHsl.xy, gasHsl.z));
  outColor = vec4(mix(gasColour, zoneTint, 0.1), alpha);
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    this.images.set(image, texture)
    return texture
  }

  render(input: OniTerrainRenderInput): boolean {
    const detailImage = input.textures['/assets/render/gasSteam01.png']
    const dangerImage = input.textures['/assets/render/skullgas.png']
    if (!detailImage || !dangerImage) return false
    const gl = this.initialize(input.context.canvas.width, input.context.canvas.height)
    if (!gl || !this.canvas || !this.program || !this.buffer) return false
    const properties = buildOniPropertyTextures(input)
    this.worldZone = this.rawTexture(this.worldZone, properties.width, properties.height, gl.RGB, properties.worldZone)
    this.pressure = this.rawTexture(this.pressure, properties.width, properties.height, gl.RED, properties.gasPressure)
    this.colour = this.rawTexture(this.colour, properties.width, properties.height, gl.RGBA, properties.gasColour)
    this.danger = this.rawTexture(this.danger, properties.width, properties.height, gl.RED, properties.gasDanger)

    const left = input.originX
    const top = input.originY
    const right = left + input.width * input.cellSize
    const bottom = top + input.height * input.cellSize
    const vertices = new Float32Array([
      left, top, -.5, input.height - .5, right, top, input.width - .5, input.height - .5, left, bottom, -.5, -.5,
      left, bottom, -.5, -.5, right, top, input.width - .5, input.height - .5, right, bottom, input.width - .5, -.5,
    ])
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_viewport'), this.canvas.width, this.canvas.height)
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_grid_size'), properties.width, properties.height)
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
