import { elementForHash } from './elements'
import { ONI_SUBSTANCE_BY_HASH } from './oniSubstances.generated'
import { ONI_WORLD_ZONE_COLORS, type OniTerrainRenderInput } from './oniRenderer'
import { getCachedOniPropertyTextures } from './oniPropertyTextures'
import { pickTerrainMaskVariant, type TerrainMaskVariant } from './terrainMasks'

const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_position;
in vec2 a_world;
in vec2 a_mask_uv;
in vec3 a_zone;
in float a_opaque;
uniform vec2 u_viewport;
uniform vec2 u_grid_size;
out vec2 v_world;
out vec2 v_mask_uv;
out vec3 v_zone;
out float v_opaque;
out vec2 v_property_uv;
void main() {
  vec2 clip = vec2(a_position.x / u_viewport.x * 2.0 - 1.0, 1.0 - a_position.y / u_viewport.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  v_world = a_world;
  v_mask_uv = a_mask_uv;
  v_zone = a_zone;
  v_opaque = a_opaque;
  v_property_uv = vec2((a_world.x + 1.0) / u_grid_size.x, 1.0 - (a_world.y + 1.0) / u_grid_size.y);
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_main;
uniform sampler2D u_masks;
uniform sampler2D u_solid_dig;
uniform sampler2D u_world_zone;
uniform sampler2D u_state_change;
uniform sampler2D u_state_map;
uniform sampler2D u_falling_solid;
uniform sampler2D u_falling_map;
uniform sampler2D u_dig_damage_map;
uniform float u_world_uv_scale;
uniform vec4 u_colour_tint;
in vec2 v_world;
in vec2 v_mask_uv;
in vec3 v_zone;
in float v_opaque;
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
    h /= 6.0;
    if (h < 0.0) h += 1.0;
  }
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
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
  vec2 mainUV = fract(vec2(v_world.x, -v_world.y) / u_world_uv_scale);
  vec4 alphaTest = texture(u_masks, v_mask_uv);
  if (v_opaque <= 0.5 && alphaTest.a <= 0.600000024) discard;
  vec3 rock = texture(u_main, mainUV).rgb * u_colour_tint.rgb;
  if (v_opaque <= 0.5) rock *= alphaTest.rgb;
  vec3 solidDig = texture(u_solid_dig, v_property_uv).rgb;
  // Lighting.substanceEdgeParameters from LightingSettings.asset:
  // intensity=.2, edgeIntensity=1.7, directSunlightScale=.5, power=3.
  // ExposedToSunlight is zero until that simulation property is connected.
  float substanceLight = 0.2;
  if (v_opaque <= 0.5) substanceLight += pow((1.0 - solidDig.r) * 1.7, 3.0);
  rock *= substanceLight;
  vec4 stateMap = texture(u_state_map, v_world * 5.0);
  float stateAmount = clamp(texture(u_state_change, v_property_uv).r - 0.5, 0.0, 1.0) * stateMap.a * 2.0;
  rock = mix(rock, stateMap.rgb * vec3(0.5344828), stateAmount);
  vec4 fallingMap = texture(u_falling_map, v_world * 5.0);
  float fallingAmount = clamp(texture(u_falling_solid, v_property_uv).r - 0.5, 0.0, 1.0) * fallingMap.a * 2.0;
  rock = mix(rock, fallingMap.rgb * vec3(0.53333336), fallingAmount);
  float damageAmount = solidDig.g * texture(u_dig_damage_map, v_world * 0.125).a;
  rock = mix(rock, vec3(0.6764706), damageAmount);
  vec3 rockHsl = rgb2hsl(rock);
  vec3 zoneHsl = rgb2hsl(texture(u_world_zone, v_property_uv).rgb);
  vec3 tinted = hsl2rgb(vec3(zoneHsl.xy, rockHsl.z));
  vec3 finalRgb = mix(rock, tinted, 0.4);
  // Substance.shader (ALPHA/MATTE) writes the alpha-test texture's alpha;
  // the opaque variant writes 1.0. GroundRenderer does not derive coverage
  // from the red/green channels.
  outColor = vec4(finalRgb, v_opaque > 0.5 ? 1.0 : alphaTest.a);
}`

type MaskAtlas = { canvas: HTMLCanvasElement; rects: WeakMap<TerrainMaskVariant, [number, number, number, number]> }
type Batch = { texture: HTMLImageElement | HTMLCanvasElement; scale: number; tint: readonly number[]; vertices: number[] }
type RenderMaterial = {
  substanceIndex: number
  worldUvScale: number
  colourTint: readonly [number, number, number, number]
}
type GroundSample = { element: ReturnType<typeof elementForHash>; material: RenderMaterial; texture: HTMLImageElement | HTMLCanvasElement }

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('无法创建 ONI 地形 Shader。')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'ONI Shader 编译失败。')
  return shader
}

export class OniSubstanceWebGLRenderer {
  private canvas?: HTMLCanvasElement
  private gl?: WebGL2RenderingContext
  private program?: WebGLProgram
  private buffer?: WebGLBuffer
  private maskAtlasCache = new WeakMap<object, MaskAtlas>()
  private textures = new WeakMap<HTMLImageElement | HTMLCanvasElement, {
    repeat?: WebGLTexture
    clamp?: WebGLTexture
  }>()
  private solidDigTexture?: WebGLTexture
  private worldZoneTexture?: WebGLTexture
  private stateChangeTexture?: WebGLTexture
  private fallingSolidTexture?: WebGLTexture
  private uploadedPropertyCacheKey?: object
  private fallbackTextures = new Map<string, HTMLCanvasElement>()

  private fallbackTexture(color: string): HTMLCanvasElement {
    const cached = this.fallbackTextures.get(color)
    if (cached) return cached
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 2
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = color
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    this.fallbackTextures.set(color, canvas)
    return canvas
  }

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
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) throw new Error(this.gl.getProgramInfoLog(program) ?? 'ONI Shader 链接失败。')
        this.program = program
        this.buffer = this.gl.createBuffer() ?? undefined
      } catch (cause) {
        // WebGL2 is an optimization. Browsers with a broken/blocked context
        // must still get the Canvas2D renderer rather than a blank map.
        console.error('ONI Substance WebGL 初始化失败，已回退 Canvas2D。', cause)
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

  private texture(source: HTMLImageElement | HTMLCanvasElement, repeat: boolean): WebGLTexture | undefined {
    const gl = this.gl
    if (!gl) return undefined
    const cache = this.textures.get(source) ?? {}
    const key = repeat ? 'repeat' : 'clamp'
    const cached = cache[key]
    if (cached) return cached
    const texture = gl.createTexture()
    if (!texture) return undefined
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE)
    cache[key] = texture
    this.textures.set(source, cache)
    return texture
  }

  private propertyTexture(
    current: WebGLTexture | undefined,
    width: number,
    height: number,
    format: number,
    data: Uint8Array,
  ): WebGLTexture | undefined {
    const gl = this.gl
    if (!gl) return undefined
    const texture = current ?? gl.createTexture() ?? undefined
    if (!texture) return undefined
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    const internalFormat = format === gl.RGB ? gl.RGB8 : gl.R8
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, gl.UNSIGNED_BYTE, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  }

  private maskAtlas(input: OniTerrainRenderInput): MaskAtlas | undefined {
    if (!input.maskSets) return undefined
    const cached = this.maskAtlasCache.get(input.maskSets)
    if (cached) return cached
    const variants: TerrainMaskVariant[] = []
    const seen = new Set<HTMLCanvasElement>()
    input.maskSets.forEach((paths) => paths.forEach((items) => items.forEach((variant) => {
      if (!seen.has(variant.image)) { seen.add(variant.image); variants.push(variant) }
    })))
    if (variants.length === 0) return undefined
    const tile = variants[0]?.image.width ?? 176
    const columns = Math.ceil(Math.sqrt(variants.length))
    const rows = Math.ceil(variants.length / columns)
    const canvas = document.createElement('canvas')
    canvas.width = columns * tile
    canvas.height = rows * tile
    const context = canvas.getContext('2d')
    if (!context) return undefined
    const rects = new WeakMap<TerrainMaskVariant, [number, number, number, number]>()
    variants.forEach((variant, index) => {
      const x = (index % columns) * tile
      const y = Math.floor(index / columns) * tile
      context.drawImage(variant.image, x, y)
      rects.set(variant, [x / canvas.width, y / canvas.height, (x + tile) / canvas.width, (y + tile) / canvas.height])
    })
    const atlas = { canvas, rects }
    this.maskAtlasCache.set(input.maskSets, atlas)
    return atlas
  }

  render(input: OniTerrainRenderInput): boolean {
    if (!input.maskSets) return false
    const gl = this.initialize(input.context.canvas.width, input.context.canvas.height)
    const atlas = this.maskAtlas(input)
    if (!gl || !this.canvas || !this.program || !this.buffer || !atlas) return false
    const batches = new Map<number, Batch>()
    const sample = (x: number, y: number): GroundSample | undefined => {
      if (input.isTerrainMaskedAt(x, y)) return undefined
      const cell = input.cellAt(x, y)
      const element = cell && elementForHash(cell.elementHash)
      const material = cell && ONI_SUBSTANCE_BY_HASH.get(cell.elementHash & 0xffff)
      if (element?.state !== 'solid') return undefined
      const texture = material?.textureUrl ? input.textures[material.textureUrl] : undefined
      const elementTexture = element.texture ? input.textures[element.texture] : undefined
      return {
        element,
        texture: texture ?? elementTexture ?? this.fallbackTexture(element.color),
        material: material ?? {
          substanceIndex: element.terrainOrder ?? element.hash,
          worldUvScale: element.worldUvScale ?? 8,
          colourTint: [1, 1, 1, 1],
        },
      }
    }
    for (let canvasY = input.range.minRow; canvasY <= input.range.maxRow; canvasY += 1) {
      const y = input.height - 1 - canvasY
      for (let x = input.range.minX; x <= input.range.maxX; x += 1) {
        const corners = [sample(x - 1, y - 1), sample(x, y - 1), sample(x - 1, y), sample(x, y)]
        const materials = [...new Map(corners.filter(Boolean).map((item) => [item!.material.substanceIndex, item!])).values()]
          .sort((a, b) => a.material.substanceIndex - b.material.substanceIndex)
        for (const item of materials) {
          const idx = item.material.substanceIndex
          const mask = (corners[2]?.material.substanceIndex! >= idx ? 8 : 0)
            | (corners[3]?.material.substanceIndex! >= idx ? 4 : 0)
            | (corners[0]?.material.substanceIndex! >= idx ? 2 : 0)
            | (corners[1]?.material.substanceIndex! >= idx ? 1 : 0)
          if (!mask) continue
          const texture = item.texture
          const zoneType = input.worldZones[y * input.width + x] ?? 3
          const maskPaths = input.maskSets.get(zoneType) ?? input.maskSets.get(3)
          if (mask !== 15 && !maskPaths) {
            continue
          }
          const variant = mask === 15 ? undefined : pickTerrainMaskVariant(maskPaths!, mask, x, y)
          const rect = variant && atlas.rects.get(variant)
          if (mask !== 15 && !rect) continue
          const batch = batches.get(idx) ?? { texture, scale: item.material.worldUvScale, tint: item.material.colourTint, vertices: [] }
          batches.set(idx, batch)
          // GroundRenderer's vertex positions are cell centres. The screen
          // quad therefore straddles the integer cell coordinate instead of
          // starting at it.
          const left = input.originX + (x - .5) * input.cellSize
          const top = input.originY + (canvasY + .5) * input.cellSize
          const right = left + input.cellSize
          const bottom = top + input.cellSize
          const [u0, v0, u1, v1] = rect ?? [0, 0, 1, 1]
          const zone = ONI_WORLD_ZONE_COLORS[input.worldZones[y * input.width + x] ?? 3] ?? ONI_WORLD_ZONE_COLORS[3]
          const z = [zone.r / 255, zone.g / 255, zone.b / 255]
          const opaque = mask === 15 ? 1 : 0
          const vertex = (px: number, py: number, wx: number, wy: number, u: number, v: number) => [px, py, wx, wy, u, v, ...z, opaque]
          batch.vertices.push(
            ...vertex(left, top, x - .5, y + .5, u0, v0), ...vertex(right, top, x + .5, y + .5, u1, v0), ...vertex(left, bottom, x - .5, y - .5, u0, v1),
            ...vertex(left, bottom, x - .5, y - .5, u0, v1), ...vertex(right, top, x + .5, y + .5, u1, v0), ...vertex(right, bottom, x + .5, y - .5, u1, v1),
          )
        }
      }
    }
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_viewport'), this.canvas.width, this.canvas.height)
    const propertyTextures = getCachedOniPropertyTextures(input)
    const stateMap = input.textures['/assets/render/melt.png']
    const fallingMap = input.textures['/assets/render/mudmelt.png']
    const digDamageMap = input.textures['/assets/render/crackAlpha.png']
    if (!stateMap || !fallingMap || !digDamageMap) return false
    const propertyKey = input.propertyCacheKey
    const needsPropertyUpload = !propertyKey || this.uploadedPropertyCacheKey !== propertyKey
    if (needsPropertyUpload) {
      this.solidDigTexture = this.propertyTexture(this.solidDigTexture, propertyTextures.width, propertyTextures.height, gl.RGB, propertyTextures.solidDigAmount)
      this.worldZoneTexture = this.propertyTexture(this.worldZoneTexture, propertyTextures.width, propertyTextures.height, gl.RGB, propertyTextures.worldZone)
      this.stateChangeTexture = this.propertyTexture(this.stateChangeTexture, propertyTextures.width, propertyTextures.height, gl.RED, propertyTextures.stateChange)
      this.fallingSolidTexture = this.propertyTexture(this.fallingSolidTexture, propertyTextures.width, propertyTextures.height, gl.RED, propertyTextures.fallingSolid)
      if (propertyKey) this.uploadedPropertyCacheKey = propertyKey
    }
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_grid_size'), propertyTextures.width, propertyTextures.height)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.texture(atlas.canvas, false) ?? null)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_masks'), 1)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, this.solidDigTexture ?? null)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_solid_dig'), 2)
    gl.activeTexture(gl.TEXTURE3)
    gl.bindTexture(gl.TEXTURE_2D, this.worldZoneTexture ?? null)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_world_zone'), 3)
    gl.activeTexture(gl.TEXTURE4)
    gl.bindTexture(gl.TEXTURE_2D, this.stateChangeTexture ?? null)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_state_change'), 4)
    gl.activeTexture(gl.TEXTURE5)
    gl.bindTexture(gl.TEXTURE_2D, this.texture(stateMap, true) ?? null)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_state_map'), 5)
    gl.activeTexture(gl.TEXTURE6)
    gl.bindTexture(gl.TEXTURE_2D, this.fallingSolidTexture ?? null)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_falling_solid'), 6)
    gl.activeTexture(gl.TEXTURE7)
    gl.bindTexture(gl.TEXTURE_2D, this.texture(fallingMap, true) ?? null)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_falling_map'), 7)
    gl.activeTexture(gl.TEXTURE8)
    gl.bindTexture(gl.TEXTURE_2D, this.texture(digDamageMap, true) ?? null)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_dig_damage_map'), 8)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    const stride = 10 * 4
    const attribute = (name: string, size: number, offset: number) => {
      const location = gl.getAttribLocation(this.program!, name)
      if (location < 0) return
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * 4)
    }
    attribute('a_position', 2, 0); attribute('a_world', 2, 2); attribute('a_mask_uv', 2, 4); attribute('a_zone', 3, 6); attribute('a_opaque', 1, 9)
    // GroundRenderer offsets Z by substance.idx, so larger indices are drawn
    // nearer the camera. Canvas/WebGL without a depth buffer must paint them
    // in ascending index order to preserve the same overlap rule.
    for (const [, batch] of [...batches].sort(([left], [right]) => left - right)) {
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.vertices), gl.DYNAMIC_DRAW)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.texture(batch.texture, true) ?? null)
      gl.uniform1i(gl.getUniformLocation(this.program, 'u_main'), 0)
      gl.uniform1f(gl.getUniformLocation(this.program, 'u_world_uv_scale'), batch.scale)
      gl.uniform4f(gl.getUniformLocation(this.program, 'u_colour_tint'), batch.tint[0], batch.tint[1], batch.tint[2], batch.tint[3])
      gl.drawArrays(gl.TRIANGLES, 0, batch.vertices.length / 10)
    }
    input.context.drawImage(this.canvas, 0, 0)
    return true
  }
}
