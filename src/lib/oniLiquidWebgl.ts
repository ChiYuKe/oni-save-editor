import originalLiquidSource from './oniLiquidOriginal.glsl?raw'
import { buildOniPropertyTextures } from './oniPropertyTextures'
import type { OniTerrainRenderInput } from './oniRenderer'

// The exported Texture2DArray is 1024 x 16384: sixteen 1024px slices. The
// shader only selects the first twelve substance ids in this build, but the
// GPU texture must retain the source array depth and layer numbering.
const LIQUID_TEXTURE_LAYERS = 16
const LIQUID_SCROLL_SPEEDS = [.02, .02, .02, .02, .02, .02, .01, -.01, -.02, -.02, -.02]

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

// The extracted program is the game's compiled GLCore program. WebGL2 uses
// the same GLSL body; only desktop version/extension declarations and Unity's
// sampler location macro are host-specific.
const ORIGINAL_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
${extractStage(originalLiquidSource, 'FRAGMENT')
    .replace(/^#version 150\s*$/gm, '')
    .replace(/^#extension .*$/gm, '')
    .replace('#define UNITY_LOCATION(x) layout(location = x)', '#define UNITY_LOCATION(x)')}`

const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;
in vec2 in_POSITION0;
uniform vec2 u_viewport;
uniform vec4 u_canvas;
uniform vec3 _WorldSpaceCameraPos;
uniform vec4 _CameraZoomInfo;
uniform vec4 _WorldSizeInfo;
out vec3 vs_TEXCOORD0;
out vec2 vs_TEXCOORD2;
out vec2 vs_TEXCOORD3;
out vec2 vs_TEXCOORD4;
void main() {
  vec2 localWorld = in_POSITION0;
  // WaterCubes is positioned in Grid coordinates. SIMSAVE exposes the
  // playable map without the one-cell border, so the shader coordinates need
  // the same +1 offset while the screen quad remains cropped to the map.
  // Liquid.shader receives the external Liquid texture in screen-row order,
  // while PropertyTextures' TextureBuffer rows remain Grid-Y ordered.
  vec2 world = vec2(localWorld.x + 1.0, u_canvas.w + 1.0 - localWorld.y);
  float screenX = u_canvas.x + localWorld.x * u_canvas.z;
  float screenY = u_canvas.y + (u_canvas.w - localWorld.y) * u_canvas.z;
  gl_Position = vec4(screenX / u_viewport.x * 2.0 - 1.0, 1.0 - screenY / u_viewport.y * 2.0, 0.0, 1.0);
  vs_TEXCOORD0 = vec3(world, 0.0);
  vs_TEXCOORD2 = world * _WorldSizeInfo.zw;
  float left = _WorldSpaceCameraPos.x - _CameraZoomInfo.x * _CameraZoomInfo.y;
  float right = _WorldSpaceCameraPos.x + _CameraZoomInfo.x * _CameraZoomInfo.y;
  float bottom = _WorldSpaceCameraPos.y - _CameraZoomInfo.x;
  float top = _WorldSpaceCameraPos.y + _CameraZoomInfo.x;
  vs_TEXCOORD3 = vec2((world.x - left) / (right - left), (world.y - bottom) / (top - bottom));
  float shinePhase = (2.0 * _WorldSpaceCameraPos.x + _WorldSpaceCameraPos.y) * .1;
  vs_TEXCOORD4 = vec2(cos(shinePhase), sin(shinePhase));
}`

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
  private materialData?: WebGLTexture
  private liquidData?: WebGLTexture
  private mrt0Copy?: WebGLTexture
  private mrt1Copy?: WebGLTexture
  private imageTextures = new WeakMap<HTMLImageElement, WebGLTexture>()
  private arrayTextures = new WeakMap<HTMLImageElement, WebGLTexture>()
  private arrayCanvas?: HTMLCanvasElement

  private initialize(width: number, height: number): WebGL2RenderingContext | undefined {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas')
      this.gl = this.canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: false }) ?? undefined
      if (!this.gl) return undefined
      try {
        const program = this.gl.createProgram()
        if (!program) return undefined
        const vertex = compile(this.gl, this.gl.VERTEX_SHADER, VERTEX_SHADER)
        const fragment = compile(this.gl, this.gl.FRAGMENT_SHADER, ORIGINAL_FRAGMENT_SHADER)
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
        console.error('ONI 原始 Liquid.shader 初始化失败，液体层将保持透明。', cause)
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

  private rawTexture(current: WebGLTexture | undefined, width: number, height: number, format: number, data: Uint8Array): WebGLTexture | undefined {
    const gl = this.gl
    if (!gl) return undefined
    const texture = current ?? gl.createTexture() ?? undefined
    if (!texture) return undefined
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    const internal = format === gl.RGBA ? gl.RGBA8 : gl.R8
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, format, gl.UNSIGNED_BYTE, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
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
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2])
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source)
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
    const zoomRatio = Math.max(0, Math.min(1, (uniforms.orthoSize - 4) / 16))
    set4f('_Time', t / 20, t, t * 2, t * 3)
    set4f('_ScreenParams', uniforms.width, uniforms.height, 1 + 1 / uniforms.width, 1 + 1 / uniforms.height)
    set4f('_ShineParams2', .1, 0, 0, 0)
    set4f('_CameraZoomInfo', uniforms.orthoSize, uniforms.aspect, 20, zoomRatio)
    set4f('_WorldSizeInfo', uniforms.width, uniforms.height, 1 / uniforms.width, 1 / uniforms.height)
    set4f('_WorldCameraPos', uniforms.cameraX, uniforms.cameraY, 0, uniforms.orthoSize)
    const camera = location('_WorldSpaceCameraPos')
    if (camera) gl.uniform3f(camera, uniforms.cameraX, uniforms.cameraY, 0)
    set4f('unity_OrthoParams', 0, uniforms.orthoSize, 0, 0)
    const scroll = new Float32Array(64)
    scroll.set(LIQUID_SCROLL_SPEEDS)
    const scrollLocation = location('_TextureScrollSpeeds')
    if (scrollLocation) gl.uniform1fv(scrollLocation, scroll)

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
    const properties = buildOniPropertyTextures(input)
    const direct = (data: Uint8Array, channels: number) => reverseRows(data, channels, properties.width, properties.height)
    this.solidLiquidGasMass = this.rawTexture(this.solidLiquidGasMass, properties.width, properties.height, gl.RGBA, direct(properties.solidLiquidGasMass, 4))
    // The native simulation uploads Liquid as screen-row ordered external data.
    // The remaining property textures are TextureBuffer data and are flipped
    // into WebGL's row order by `direct`.
    this.liquid = this.rawTexture(this.liquid, properties.width, properties.height, gl.RGBA, properties.liquid)
    this.materialData = this.rawTexture(this.materialData, properties.width, properties.height, gl.RGBA, direct(properties.materialData, 4))
    this.liquidData = this.rawTexture(this.liquidData, properties.width, properties.height, gl.RGBA, direct(properties.liquidData, 4))
    const bubblesImage = input.textures['/assets/render/bubbles.png']
    const normalNoiseImage = input.textures['/assets/render/normal_metal.png']
    const liquidArrayImage = input.textures['/assets/render/bgarray_liquids.png']
    const specularArrayImage = input.textures['/assets/render/bgarray_liquids_specular.png']
    const bubbles = bubblesImage ? this.imageTexture(bubblesImage) : undefined
    const normalNoise = normalNoiseImage ? this.imageTexture(normalNoiseImage) : undefined
    const liquidArray = liquidArrayImage ? this.imageArrayTexture(liquidArrayImage) : undefined
    const specularArray = specularArrayImage ? this.imageArrayTexture(specularArrayImage) : undefined
    if (!this.solidLiquidGasMass || !this.liquid || !this.materialData || !this.liquidData || !bubbles || !normalNoise || !liquidArray || !specularArray) return false
    this.mrt0Copy = this.uploadCanvas(this.mrt0Copy, sourceCanvas)
    this.mrt1Copy = this.uploadCanvas(this.mrt1Copy, sourceCanvas)
    if (!this.mrt0Copy || !this.mrt1Copy) return false

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
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.outputTextures[0] ?? null, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.outputTextures[1] ?? null, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.outputTextures[2] ?? null, 0)
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2])
    gl.viewport(0, 0, sourceCanvas.width, sourceCanvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(program)
    gl.disable(gl.BLEND)
    this.setUniforms(uniforms)
    const viewport = gl.getUniformLocation(program, 'u_viewport')
    if (viewport) gl.uniform2f(viewport, sourceCanvas.width, sourceCanvas.height)
    const set4f = (name: string, x: number, y: number, z: number, w: number) => {
      const location = gl.getUniformLocation(program, name)
      if (location) gl.uniform4f(location, x, y, z, w)
    }
    set4f('u_canvas', input.originX, input.originY, cellSize, input.height)
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
    bind2d(2, '_MaterialDataTex', this.materialData)
    bind2d(3, '_LiquidDataTex', this.liquidData)
    bind2d(4, '_BoilingBubblesTex', bubbles)
    bind2d(5, 'MRT0_Copy', this.mrt0Copy)
    bind2d(6, 'MRT1_Copy', this.mrt1Copy)
    bind2d(7, '_NormalNoise', normalNoise)
    bindArray(8, '_Textures', liquidArray)
    bindArray(9, '_SpecularMapTextures', specularArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    const vertices = new Float32Array([
      0, 0, input.width, 0, 0, input.height,
      0, input.height, input.width, 0, input.width, input.height,
    ])
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW)
    const position = gl.getAttribLocation(program, 'in_POSITION0')
    if (position < 0) return false
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 8, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    // Liquid.shader writes MRT0/MRT1/MRT2. Copy the visible MRT0 result to
    // the canvas default framebuffer before handing it back to Canvas2D.
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer)
    gl.readBuffer(gl.COLOR_ATTACHMENT0)
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
