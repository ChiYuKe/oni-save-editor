import v21LiquidSource from './oniLiquidV21.glsl?raw'
import { getCachedOniPropertyTextures } from './oniPropertyTextures'
import type { OniTerrainRenderInput } from './oniRenderer'

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

const V21_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
${extractStage(v21LiquidSource, 'VERTEX')
    .replace(/^#version 300 es\s*$/gm, '')}`

const V21_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
${extractStage(v21LiquidSource, 'FRAGMENT')
    .replace(/^#version 300 es\s*$/gm, '')}`

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
  private mrtWidth = 0
  private mrtHeight = 0
  private imageTextures = new WeakMap<HTMLImageElement, WebGLTexture>()
  private arrayTextures = new WeakMap<HTMLImageElement, WebGLTexture>()
  private arrayCanvas?: HTMLCanvasElement
  private uploadedPropertyCacheKey?: object

  private initialize(width: number, height: number): WebGL2RenderingContext | undefined {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas')
      this.gl = this.canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: false }) ?? undefined
      if (!this.gl) return undefined
      try {
        const program = this.gl.createProgram()
        if (!program) return undefined
        const vertex = compile(this.gl, this.gl.VERTEX_SHADER, V21_VERTEX_SHADER)
        const fragment = compile(this.gl, this.gl.FRAGMENT_SHADER, V21_FRAGMENT_SHADER)
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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    this.imageTextures.set(image, texture)
    return texture
  }

  private imageArrayTexture(image: HTMLImageElement): WebGLTexture | undefined {
    const gl = this.gl
    if (!gl || image.naturalWidth <= 0 || image.naturalHeight < image.naturalWidth * LIQUID_TEXTURE_LAYERS) return undefined
    const cached = this.arrayTextures.get(image)
    if (cached) return cached
    const layerSize = image.naturalWidth
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
      context.drawImage(image, 0, layer * layerSize, layerSize, layerSize, 0, 0, layerSize, layerSize)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, layerSize, layerSize, 1, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    }
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
    set4f('_Time', t, t * 20, t * 40, t * 60)
    set4f('_ScreenParams', uniforms.screenWidth, uniforms.screenHeight, 1 + 1 / uniforms.screenWidth, 1 + 1 / uniforms.screenHeight)
    set4f('_ShineParams2', .1, 0, 0, 0)
    set4f('_CameraZoomInfo', uniforms.orthoSize, uniforms.aspect, 20, zoomRatio)
    set4f('_WorldSizeInfo', uniforms.width, uniforms.height, 1 / uniforms.width, 1 / uniforms.height)
    set4f('_WorldCameraPos', uniforms.cameraX, uniforms.cameraY, 0, uniforms.orthoSize)
    const camera = location('_WorldSpaceCameraPos')
    if (camera) gl.uniform3f(camera, uniforms.cameraX, uniforms.cameraY, 0)
    set4f('unity_OrthoParams', 0, uniforms.orthoSize, 0, 0)
    const values: Record<string, number> = {
      _BoilingTreshold: .8,
      _FreezingTreshold: .1,
      _BoilOverride_DistortionStrength: .048,
      _BoilOverride_DistortionFrequency: .84,
      _BoilOverride_DistortionSpeed: 1.002,
      _AirBubbleMinBoilingPointRequired: .178,
      _AirBubbleLargeMinBoilingPointRequired: .323,
      _AirBubbles_Sample1_MaxOpacity: .147,
      _AirBubbles_Sample1_SizeModifier: .83333,
      _AirBubbles_Sample1_SpeedModifier: 1.36,
      _AirBubbles_Sample2_MaxOpacity: .298,
      _AirBubbles_Sample2_SizeModifier: 1.25,
      _AirBubbles_Sample2_SpeedModifier: 2.54,
      _DistortionBubbles_Sample1_SizeModifier: 1,
      _DistortionBubbles_Sample1_SpeedModifier: .9,
      _DistortionBubbles_Sample2_SizeModifier: 5,
      _DistortionBubbles_Sample2_SpeedModifier: .3,
      _FreezeOverride_SolidColorStrength: .4,
      _FreezeOverride_OpacityStrength: .6,
      _FreezeOverride_DistortionStrength: 0,
      _FreezeOverride_DistortionFrequency: 0,
      _FreezeOverride_DistortionSpeed: 0,
      _LiquidSelectStart: .31,
      _LiquidSelectRangeNear: .04,
      _LiquidSelectRangeFar: .09,
      _LiquidSelectRangeNearOrthoSize: 4,
      _LiquidSelectRangeFarOrthoSize: 20,
      _CausticSpeed: 1.21,
      _CausticFrequency: 1.17,
      _CausticCount: 4,
      _CausticScale: 1.2,
      _Opacity: .77,
      _OpaqueLiquidsOpacity: .95,
      _ZoomedOutOpacity: .5,
      _ZoomedInOpacity: .4,
      _ZoomedOutOpacityInfluenceRadius: 20,
      _ZoomedInOpacityInfluenceRadius: 12,
      _WaveSpeed: 2,
      _WaveFrequency: 1,
      _WaveCount: 5,
      _WaveHeight: 5,
      _DistortionStrength: .018,
      _DistortionFrequency: 1,
      _DistortionSpeed: 1,
      _LiquidScrollSpeed: .02,
    }
    Object.entries(values).forEach(([name, value]) => set1f(name, value))
    set4f('_MoltenMetalColor', 1, 1, .3, 1)
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
    this.mrt0Copy = this.uploadCanvas(this.mrt0Copy, sourceCanvas)
    if (!this.mrt0Copy) return false

    const cellSize = input.cellSize
    const orthoSize = sourceCanvas.height / (2 * cellSize)
    const aspect = sourceCanvas.width / sourceCanvas.height
    const cameraX = (sourceCanvas.width / 2 - input.originX) / cellSize + 1
    const cameraY = input.height - (sourceCanvas.height / 2 - input.originY) / cellSize + 1
    const uniforms: LiquidUniforms = {
      time: performance.now() / 1000,
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
    // This port has one Canvas2D source rather than Unity's separate MRT0/MRT1
    // targets. The original code uploaded the same frame twice; binding the
    // shared copy preserves the available data and halves the upload cost.
    bind2d(8, 'MRT1_Copy', this.mrt0Copy)
    bind2d(9, '_NormalNoise', normalNoise)
    bindArray(10, '_Textures', liquidArray)
    bindArray(11, '_SpecularMapTextures', specularArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    const vertices = new Float32Array([
      0, 0, 1, 0, 0, 1,
      0, 1, 1, 0, 1, 1,
    ])
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW)
    const position = gl.getAttribLocation(program, 'aPosition')
    if (position < 0) return false
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 8, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    // Copy the v21 liquid result to the canvas default framebuffer before
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
