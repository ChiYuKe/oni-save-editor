import v21LiquidSource from './oniLiquidV21.glsl?raw'
import originalLiquidSource from './oniLiquidOriginal.glsl?raw'
import { getCachedOniPropertyTextures } from './oniPropertyTextures'
import type { OniTerrainRenderInput } from './oniRenderer'
import { ONI_LIQUID_DEFAULTS, ONI_LIQUID_TEXTURE_SCROLL_SPEEDS } from './oniShaders'

// The exported Texture2DArray is 1024 x 16384: sixteen 1024px slices. The
// shader only selects the first twelve substance ids in this build, but the
// GPU texture must retain the source array depth and layer numbering.
const LIQUID_TEXTURE_LAYERS = 16

function extractStage(source: string, stage: 'VERTEX' | 'FRAGMENT'): string {
  const lines = source.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === `#ifdef ${stage}`)
  if (start < 0) throw new Error(`ONI 液体 Shader 缺少 ${stage} 阶段。`)
  let depth = 0
  for (let index = start; index < lines.length; index += 1) {
    const directive = lines[index].trim()
    if (/^#if(n?def)?\b/.test(directive)) depth += 1
    if (directive === '#endif') {
      depth -= 1
      if (depth === 0) return lines.slice(start + 1, index).join('\n')
    }
  }
  throw new Error(`ONI 液体 Shader 的 ${stage} 阶段未闭合。`)
}

const LIQUID_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
${extractStage(v21LiquidSource, 'VERTEX')
    .replace(/^#version 300 es\s*$/gm, '')}`

// Keep the game's original fragment calculations. Adapt only GLSL version,
// desktop uniform-location qualifiers and canvas premultiplication.
const originalFragment = extractStage(originalLiquidSource, 'FRAGMENT')
  // Property uploads already use bottom-origin rows; remove the desktop-only flip.
  .replace('vs_TEXCOORD2.xy * vec2(1.0, -1.0) + vec2(0.0, 1.0)', 'vs_TEXCOORD2.xy')
  .replace(/^#version[^\n]*$/gm, '')
  .replace(/^#extension[^\n]*$/gm, '')
  .replace(/UNITY_LOCATION\(\d+\)\s+(?=uniform)/g, '')
  .replace('void main()\n{', `void main()\n{\n  if (any(lessThan(vs_TEXCOORD2, vec2(0.))) || any(greaterThan(vs_TEXCOORD2, vec2(1.)))) discard;`)
  .replace('    SV_Target2 = vec4(0.0, 0.0, 0.0, 0.0);', '    SV_Target2 = vec4(0.0, 0.0, 0.0, 0.0);\n    SV_Target0.rgb *= SV_Target0.a;')
const LIQUID_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
${originalFragment}`

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('无法创建 ONI 液体 Shader。')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'ONI 液体 Shader 编译失败。')
  }
  return shader
}

function reverseRows(data: Uint8Array, channels: number, width: number, height: number): Uint8Array {
  const output = new Uint8Array(data.length)
  const rowBytes = width * channels
  for (let row = 0; row < height; row += 1) {
    const sourceOffset = (height - 1 - row) * rowBytes
    output.set(data.subarray(sourceOffset, sourceOffset + rowBytes), row * rowBytes)
  }
  return output
}

type LiquidUniforms = {
  time: number
  cameraX: number
  cameraY: number
  orthoSize: number
  aspect: number
  width: number
  height: number
  screenWidth: number
  screenHeight: number
}

export class OniLiquidWebGLRenderer {
  private canvas?: HTMLCanvasElement
  private gl?: WebGL2RenderingContext
  private program?: WebGLProgram
  private buffer?: WebGLBuffer
  private framebuffer?: WebGLFramebuffer
  private outputTextures: Array<WebGLTexture | undefined> = []
  private outputWidth = 0
  private outputHeight = 0
  private solidLiquidGasMass?: WebGLTexture
  private liquid?: WebGLTexture
  private liquidLinear?: WebGLTexture
  private liquidClip?: WebGLTexture
  private materialData?: WebGLTexture
  private liquidData?: WebGLTexture
  private mrt0Copy?: WebGLTexture
  private mrt1Copy?: WebGLTexture
  private mrtMaskCanvas?: HTMLCanvasElement
  private mrtWidth = 0
  private mrtHeight = 0
  private imageTextures = new WeakMap<HTMLImageElement, WebGLTexture>()
  private arrayTextures = new WeakMap<HTMLImageElement, WebGLTexture>()
  private arrayCanvas?: HTMLCanvasElement
  private uploadedPropertyCacheKey?: object

  private initialize(width: number, height: number): WebGL2RenderingContext | undefined {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas')
      this.gl = this.canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true }) ?? undefined
      if (!this.gl) return undefined
      try {
        const program = this.gl.createProgram()
        if (!program) return undefined
        const vertex = compile(this.gl, this.gl.VERTEX_SHADER, LIQUID_VERTEX_SHADER)
        const fragment = compile(this.gl, this.gl.FRAGMENT_SHADER, LIQUID_FRAGMENT_SHADER)
        this.gl.attachShader(program, vertex)
        this.gl.attachShader(program, fragment)
        this.gl.linkProgram(program)
        this.gl.deleteShader(vertex)
        this.gl.deleteShader(fragment)
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
          throw new Error(this.gl.getProgramInfoLog(program) ?? 'ONI 液体 Shader 链接失败。')
        }
        this.program = program
        this.buffer = this.gl.createBuffer() ?? undefined
        this.framebuffer = this.gl.createFramebuffer() ?? undefined
      } catch (cause) {
        console.error('ONI v21 Liquid.shader 初始化失败，液体层将保持透明。', cause)
        this.program = undefined
        this.buffer = undefined
        this.framebuffer = undefined
        return undefined
      }
    }
    if (!this.gl || !this.canvas) return undefined
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    return this.gl
  }

  private rawTexture(current: WebGLTexture | undefined, width: number, height: number, format: number, data: Uint8Array, sampling: 'nearest' | 'linear' = 'nearest'): WebGLTexture | undefined {
    const gl = this.gl
    if (!gl) return undefined
    const texture = current ?? gl.createTexture() ?? undefined
    if (!texture) return undefined
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    const internal = format === gl.RGBA ? gl.RGBA8 : gl.R8
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, format, gl.UNSIGNED_BYTE, data)
    const filter = sampling === 'linear' ? gl.LINEAR : gl.NEAREST
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  }

  private imageTexture(image: HTMLImageElement): WebGLTexture | undefined {
    const gl = this.gl
    if (!gl) return undefined
    const cached = this.imageTextures.get(image)
    if (cached) return cached
    const texture = gl.createTexture() ?? undefined
    if (!texture) return undefined
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    this.imageTextures.set(image, texture)
    return texture
  }

  private imageArrayTexture(image: HTMLImageElement): WebGLTexture | undefined {
    const gl = this.gl
    const tiled = image.naturalWidth === image.naturalHeight && image.naturalWidth % 4 === 0
    if (!gl || image.naturalWidth <= 0 || (!tiled && image.naturalHeight < image.naturalWidth * LIQUID_TEXTURE_LAYERS)) return undefined
    const cached = this.arrayTextures.get(image)
    if (cached) return cached
    const layerSize = image.naturalWidth / (tiled ? 4 : 1)
    const canvas = this.arrayCanvas ?? document.createElement('canvas')
    canvas.width = layerSize
    canvas.height = layerSize
    this.arrayCanvas = canvas
    const context = canvas.getContext('2d')
    const texture = gl.createTexture() ?? undefined
    if (!context || !texture) return undefined
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, layerSize, layerSize, LIQUID_TEXTURE_LAYERS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT)
    for (let layer = 0; layer < LIQUID_TEXTURE_LAYERS; layer += 1) {
      context.clearRect(0, 0, layerSize, layerSize)
      context.drawImage(image, tiled ? (layer % 4) * layerSize : 0, (tiled ? Math.floor(layer / 4) : layer) * layerSize, layerSize, layerSize, 0, 0, layerSize, layerSize)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, layerSize, layerSize, 1, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    }
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    this.arrayTextures.set(image, texture)
    return texture
  }

  private ensureFramebuffer(width: number, height: number): boolean {
    const gl = this.gl
    if (!gl || !this.framebuffer) return false
    if (this.outputWidth === width && this.outputHeight === height && this.outputTextures.length === 3) return true
    this.outputWidth = width
    this.outputHeight = height
    this.outputTextures = [0, 1, 2].map(() => {
      const texture = gl.createTexture() ?? undefined
      if (!texture) return undefined
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      return texture
    })
    if (!this.outputTextures.every(Boolean)) return false
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.outputTextures[0] ?? null, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.outputTextures[1] ?? null, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.outputTextures[2] ?? null, 0)
    // v21's ported Liquid.shader has one fragment output (outColor). Keeping
    // attachments 1 and 2 attached is harmless for the copied backdrop, but
    // they must not be active draw buffers or WebGL rejects the draw call.
    gl.drawBuffers([gl.COLOR_ATTACHMENT0])
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return complete
  }

  private uploadCanvas(current: WebGLTexture | undefined, source: HTMLCanvasElement): WebGLTexture | undefined {
    const gl = this.gl
    if (!gl) return undefined
    const texture = current ?? gl.createTexture() ?? undefined
    if (!texture) return undefined
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    if (this.mrtWidth !== source.width || this.mrtHeight !== source.height || !current) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source)
      this.mrtWidth = source.width
      this.mrtHeight = source.height
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source)
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  }

  private setUniforms(uniforms: LiquidUniforms): void {
    const gl = this.gl
    const program = this.program
    if (!gl || !program) return
    const location = (name: string) => gl.getUniformLocation(program, name)
    const set1f = (name: string, value: number) => {
      const target = location(name)
      if (target) gl.uniform1f(target, value)
    }
    const set4f = (name: string, x: number, y: number, z: number, w: number) => {
      const target = location(name)
      if (target) gl.uniform4f(target, x, y, z, w)
    }
    const t = uniforms.time
    const zoomRatio = Math.max(0, Math.min(1, uniforms.orthoSize / 20))
    set4f('_Time', t / 20, t, t * 2, t * 3)
    set4f('_ScreenParams', uniforms.screenWidth, uniforms.screenHeight, 1 + 1 / uniforms.screenWidth, 1 + 1 / uniforms.screenHeight)
    set4f('_ShineParams2', .1, 0, 0, 0)
    set4f('_CameraZoomInfo', uniforms.orthoSize, uniforms.aspect, 20, zoomRatio)
    set4f('_WorldSizeInfo', uniforms.width, uniforms.height, 1 / uniforms.width, 1 / uniforms.height)
    set4f('_WorldCameraPos', uniforms.cameraX, uniforms.cameraY, 0, uniforms.orthoSize)
    const camera = location('_WorldSpaceCameraPos')
    if (camera) gl.uniform3f(camera, uniforms.cameraX, uniforms.cameraY, 0)
    set4f('unity_OrthoParams', 0, uniforms.orthoSize, 0, 0)
    // liquid.shader indexes _TextureScrollSpeeds[layer]; LiquidShaderProperties.asset
    // serialises one speed per substance texture layer.
    const scrollSpeeds = location('_TextureScrollSpeeds')
    if (scrollSpeeds) gl.uniform1fv(scrollSpeeds, ONI_LIQUID_TEXTURE_SCROLL_SPEEDS as unknown as Float32List)
    const d = ONI_LIQUID_DEFAULTS
    const values: Record<string, number> = {
      _BoilingTreshold: d.boilingThreshold,
      _FreezingTreshold: d.freezingThreshold,
      _BoilOverride_DistortionStrength: d.boilOverrideDistortionStrength,
      _BoilOverride_DistortionFrequency: d.boilOverrideDistortionFrequency,
      _BoilOverride_DistortionSpeed: d.boilOverrideDistortionSpeed,
      _AirBubbleMinBoilingPointRequired: d.airBubbleMinBoilingPointRequired,
      _AirBubbleLargeMinBoilingPointRequired: d.airBubbleLargeMinBoilingPointRequired,
      _AirBubbles_Sample1_MaxOpacity: d.airBubblesSample1MaxOpacity,
      _AirBubbles_Sample1_SizeModifier: d.airBubblesSample1SizeModifier,
      _AirBubbles_Sample1_SpeedModifier: d.airBubblesSample1SpeedModifier,
      _AirBubbles_Sample2_MaxOpacity: d.airBubblesSample2MaxOpacity,
      _AirBubbles_Sample2_SizeModifier: d.airBubblesSample2SizeModifier,
      _AirBubbles_Sample2_SpeedModifier: d.airBubblesSample2SpeedModifier,
      _DistortionBubbles_Sample1_SizeModifier: d.distortionBubblesSample1SizeModifier,
      _DistortionBubbles_Sample1_SpeedModifier: d.distortionBubblesSample1SpeedModifier,
      _DistortionBubbles_Sample2_SizeModifier: d.distortionBubblesSample2SizeModifier,
      _DistortionBubbles_Sample2_SpeedModifier: d.distortionBubblesSample2SpeedModifier,
      _BubbleDistortionStrengthModifier: d.bubbleDistortionStrengthModifier,
      _FreezeOverride_SolidColorStrength: d.freezeOverrideSolidColorStrength,
      _FreezeOverride_OpacityStrength: d.freezeOverrideOpacityStrength,
      _FreezeOverride_DistortionStrength: d.freezeOverrideDistortionStrength,
      _FreezeOverride_DistortionFrequency: d.freezeOverrideDistortionFrequency,
      _FreezeOverride_DistortionSpeed: d.freezeOverrideDistortionSpeed,
      _LiquidSelectStart: d.liquidSelectStart,
      _LiquidSelectRangeNear: d.liquidSelectRangeNear,
      _LiquidSelectRangeFar: d.liquidSelectRangeFar,
      _LiquidSelectRangeNearOrthoSize: d.liquidSelectRangeNearOrthoSize,
      _LiquidSelectRangeFarOrthoSize: d.liquidSelectRangeFarOrthoSize,
      _CausticSpeed: d.causticSpeed,
      _CausticFrequency: d.causticFrequency,
      _CausticCount: d.causticCount,
      _CausticScale: d.causticScale,
      _Opacity: d.opacity,
      _OpaqueLiquidsOpacity: d.opaqueLiquidsOpacity,
      _ZoomedOutOpacity: d.zoomedOutOpacity,
      _ZoomedInOpacity: d.zoomedInOpacity,
      _ZoomedOutOpacityInfluenceRadius: d.zoomedOutOpacityInfluenceRadius,
      _ZoomedInOpacityInfluenceRadius: d.zoomedInOpacityInfluenceRadius,
      _WaveSpeed: d.waveSpeed,
      _WaveFrequency: d.waveFrequency,
      _WaveCount: d.waveCount,
      _WaveHeight: d.waveHeight,
      _DistortionStrength: d.distortionStrength,
      _DistortionFrequency: d.distortionFrequency,
      _DistortionSpeed: d.distortionSpeed,
    }
    Object.entries(values).forEach(([name, value]) => set1f(name, value))
    const molten = d.moltenMetalColor
    set4f('_MoltenMetalColor', molten[0], molten[1], molten[2], molten[3])
    set4f('_NormalNoise_ST', .4, .6, .03, .03)
  }

  render(input: OniTerrainRenderInput): boolean {
    const sourceCanvas = input.context.canvas
    const gl = this.initialize(sourceCanvas.width, sourceCanvas.height)
    const program = this.program
    const buffer = this.buffer
    const framebuffer = this.framebuffer
    if (!gl || !this.canvas || !program || !buffer || !framebuffer || !this.ensureFramebuffer(sourceCanvas.width, sourceCanvas.height)) return false
    const propertyKey = input.propertyCacheKey
    const properties = getCachedOniPropertyTextures(input)
    const direct = (data: Uint8Array, channels: number) => reverseRows(data, channels, properties.width, properties.height)
    // The game supplies a separate liquidFoundationMask for this sampler.
    // Building/BlockTile occupancy is not that mask; with no imported
    // foundation texture, the correct value is the game's no-clip texture.
    const needsPropertyUpload = !propertyKey || this.uploadedPropertyCacheKey !== propertyKey
    if (needsPropertyUpload) {
      const clipData = new Uint8Array(properties.width * properties.height * 4)
      this.solidLiquidGasMass = this.rawTexture(this.solidLiquidGasMass, properties.width, properties.height, gl.RGBA, direct(properties.solidLiquidGasMass, 4))
      this.liquid = this.rawTexture(this.liquid, properties.width, properties.height, gl.RGBA, direct(properties.liquid, 4))
      this.liquidLinear = this.rawTexture(this.liquidLinear, properties.width, properties.height, gl.RGBA, direct(properties.liquid, 4), 'linear')
      this.liquidClip = this.rawTexture(this.liquidClip, properties.width, properties.height, gl.RGBA, direct(clipData, 4))
      this.materialData = this.rawTexture(this.materialData, properties.width, properties.height, gl.RGBA, direct(properties.materialData, 4))
      this.liquidData = this.rawTexture(this.liquidData, properties.width, properties.height, gl.RGBA, direct(properties.liquidData, 4))
      if (propertyKey) this.uploadedPropertyCacheKey = propertyKey
    }
    const bubblesImage = input.textures['/assets/render/bubbles.png']
    const normalNoiseImage = input.textures['/assets/render/normal_metal.png']
    const liquidArrayImage = input.textures['/assets/render/bgarray_liquids.png']
    const specularArrayImage = input.textures['/assets/render/bgarray_liquids_specular.png']
    const bubbles = bubblesImage ? this.imageTexture(bubblesImage) : undefined
    const normalNoise = normalNoiseImage ? this.imageTexture(normalNoiseImage) : undefined
    const liquidArray = liquidArrayImage ? this.imageArrayTexture(liquidArrayImage) : undefined
    const specularArray = specularArrayImage ? this.imageArrayTexture(specularArrayImage) : undefined
    if (!this.solidLiquidGasMass || !this.liquid || !this.liquidLinear || !this.liquidClip || !this.materialData || !this.liquidData || !bubbles || !normalNoise || !liquidArray || !specularArray) return false
    const scene = input.sceneSource ?? sourceCanvas
    if ((this.mrtWidth !== scene.width || this.mrtHeight !== scene.height) && this.mrt1Copy) {
      gl.deleteTexture(this.mrt1Copy); this.mrt1Copy = undefined
    }
    this.mrt0Copy = this.uploadCanvas(this.mrt0Copy, scene)
    if (input.sceneMaskSource) {
      this.mrt1Copy = this.uploadCanvas(this.mrt1Copy, input.sceneMaskSource)
    } else {
    // MRT1 stores rendering masks, not a second copy of scene RGB. With no
    // imported normal/shine masks, use neutral RGB and the scene coverage.
    const mask = this.mrtMaskCanvas ?? document.createElement('canvas')
    this.mrtMaskCanvas = mask
    if (mask.width !== scene.width) mask.width = scene.width
    if (mask.height !== scene.height) mask.height = scene.height
    const maskContext = mask.getContext('2d')
    if (!maskContext) return false
    maskContext.globalCompositeOperation = 'copy'
    maskContext.drawImage(scene, 0, 0)
    maskContext.globalCompositeOperation = 'source-in'
    maskContext.fillStyle = '#000'
    maskContext.fillRect(0, 0, mask.width, mask.height)
    maskContext.globalCompositeOperation = 'source-over'
    this.mrt1Copy = this.uploadCanvas(this.mrt1Copy, mask)
    }
    if (!this.mrt0Copy || !this.mrt1Copy) return false

    const cellSize = input.cellSize
    const orthoSize = sourceCanvas.height / (2 * cellSize)
    const aspect = sourceCanvas.width / sourceCanvas.height
    const cameraX = (sourceCanvas.width / 2 - input.originX) / cellSize + 1
    const cameraY = input.height - (sourceCanvas.height / 2 - input.originY) / cellSize + 1
    const uniforms: LiquidUniforms = {
      time: input.timeSeconds ?? 0,
      cameraX,
      cameraY,
      orthoSize,
      aspect,
      width: properties.width,
      height: properties.height,
      screenWidth: sourceCanvas.width,
      screenHeight: sourceCanvas.height,
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.outputTextures[0] ?? null, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.outputTextures[1] ?? null, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.outputTextures[2] ?? null, 0)
    gl.drawBuffers([gl.COLOR_ATTACHMENT0])
    gl.viewport(0, 0, sourceCanvas.width, sourceCanvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(program)
    gl.disable(gl.BLEND)
    this.setUniforms(uniforms)
    const cameraPosition = gl.getUniformLocation(program, 'uCamPos')
    if (cameraPosition) gl.uniform2f(cameraPosition, cameraX, cameraY)
    const aspectLocation = gl.getUniformLocation(program, 'uAspect')
    if (aspectLocation) gl.uniform1f(aspectLocation, aspect)
    const orthoLocation = gl.getUniformLocation(program, 'uOrthoY')
    if (orthoLocation) gl.uniform1f(orthoLocation, orthoSize)
    const bind2d = (unit: number, name: string, texture: WebGLTexture) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      const location = gl.getUniformLocation(program, name)
      if (location) gl.uniform1i(location, unit)
    }
    const bindArray = (unit: number, name: string, texture: WebGLTexture) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture)
      const location = gl.getUniformLocation(program, name)
      if (location) gl.uniform1i(location, unit)
    }
    bind2d(0, '_SolidLiquidGasMassTex', this.solidLiquidGasMass)
    bind2d(1, '_LiquidTex', this.liquid)
    bind2d(2, '_LiquidTexLinear', this.liquidLinear)
    bind2d(3, '_LiquidClipTex', this.liquidClip)
    bind2d(4, '_MaterialDataTex', this.materialData)
    bind2d(5, '_LiquidDataTex', this.liquidData)
    bind2d(6, '_BoilingBubblesTex', bubbles)
    bind2d(7, 'MRT0_Copy', this.mrt0Copy)
    bind2d(8, 'MRT1_Copy', this.mrt1Copy)
    bind2d(9, '_NormalNoise', normalNoise)
    bindArray(10, '_Textures', liquidArray)
    bindArray(11, '_SpecularMapTextures', specularArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    // aPosition is both clip-space input and the normalized screen UV used by
    // the ported Liquid.shader. Retained chunks opt into a top-origin world
    // range which is converted to bottom-origin canvas space. Other callers
    // retain the original full-screen [0, 1] quad exactly.
    const requestedRange = input.clipToRange ? input.range : undefined
    const minX = Math.max(0, Math.min(input.width - 1, requestedRange?.minX ?? 0))
    const maxX = Math.max(minX, Math.min(input.width - 1, requestedRange?.maxX ?? input.width - 1))
    const minRow = Math.max(0, Math.min(input.height - 1, requestedRange?.minRow ?? 0))
    const maxRow = Math.max(minRow, Math.min(input.height - 1, requestedRange?.maxRow ?? input.height - 1))
    const left = requestedRange ? (input.originX + minX * cellSize) / sourceCanvas.width : 0
    const right = requestedRange ? (input.originX + (maxX + 1) * cellSize) / sourceCanvas.width : 1
    const top = requestedRange ? 1 - (input.originY + minRow * cellSize) / sourceCanvas.height : 1
    const bottom = requestedRange ? 1 - (input.originY + (maxRow + 1) * cellSize) / sourceCanvas.height : 0
    const vertices = new Float32Array([
      left, bottom, right, bottom, left, top,
      left, top, right, bottom, right, top,
    ])
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW)
    const position = gl.getAttribLocation(program, 'aPosition')
    if (position < 0) return false
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 8, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    // Copy the native liquid result to the canvas default framebuffer before
    // handing it back to Canvas2D.
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    gl.blitFramebuffer(
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    input.context.save()
    input.context.globalCompositeOperation = 'source-over'
    input.context.globalAlpha = 1
    input.context.imageSmoothingEnabled = false
    input.context.drawImage(this.canvas, 0, 0)
    input.context.restore()
    return true
  }
}


