import type { OniBiomeRenderInput } from './oniRenderer'
import { GLSL_HEADER } from './oniShaderCommon'
import { ONI_BACKGROUND_SETTINGS, ONI_ZONE_TEXTURE_ARRAY_INDICES } from './oniShaders'

const VERTEX = `${GLSL_HEADER}
in vec2 a_position;
uniform vec2 u_viewport;
uniform vec2 u_origin;
uniform float u_cell_size;
out vec2 v_world;
void main() {
  gl_Position = vec4(a_position / u_viewport * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
  v_world = (a_position - u_origin) / u_cell_size;
}`

// BackWallArray.frag: sample four NEAREST zone indices, sample each texture
// at the SAME world UV, premultiply each sample, then bilinearly mix them.
// Interpolating the slice number itself produces unrelated biome textures.
const FRAGMENT = `${GLSL_HEADER}
precision highp sampler2DArray;
uniform sampler2D u_zones;
uniform sampler2DArray u_images;
uniform ivec2 u_grid;
uniform float u_world_height;
uniform float u_uv_scale;
in vec2 v_world;
out vec4 outColor;
int zoneAt(ivec2 cell) {
  ivec2 p = clamp(cell + ivec2(1), ivec2(0), u_grid - ivec2(1));
  p.y = u_grid.y - 1 - p.y;
  return int(round(texelFetch(u_zones, p, 0).r * 255.));
}
vec4 sampleZone(int zone, vec2 uv) {
  if (zone == 255) return vec4(0.);
  vec4 c = texture(u_images, vec3(uv, float(zone)));
  return vec4(c.rgb * c.a, c.a);
}
void main() {
  vec2 world = vec2(v_world.x, u_world_height - v_world.y);
  vec2 grid = world - .5;
  ivec2 cell = ivec2(floor(grid));
  vec2 f = fract(grid);
  int bl = zoneAt(cell);
  int br = zoneAt(cell + ivec2(1, 0));
  int tl = zoneAt(cell + ivec2(0, 1));
  int tr = zoneAt(cell + ivec2(1, 1));
  // Logical playable cell 0 is SIMSAVE cell 1. PNG rows use top-origin V.
  vec2 uv = (world + 1.) * vec2(u_uv_scale, -u_uv_scale);
  vec4 c = mix(mix(sampleZone(bl, uv), sampleZone(br, uv), f.x),
               mix(sampleZone(tl, uv), sampleZone(tr, uv), f.x), f.y);
  // The original clips a low-coverage transition only beside space.
  if ((bl == 255 || br == 255 || tl == 255 || tr == 255) && c.a * c.a <= .5) discard;
  outColor = c;
}`

export class OniBiomeWebGLRenderer {
  private canvas?: HTMLCanvasElement
  private gl?: WebGL2RenderingContext
  private program?: WebGLProgram
  private buffer?: WebGLBuffer
  private zoneTexture?: WebGLTexture
  private images?: WebGLTexture
  private resizeCanvas?: HTMLCanvasElement
  private zonesKey?: Uint8Array
  private backgroundsKey?: OniBiomeRenderInput['backgrounds']
  private gridWidth = 0
  private gridHeight = 0

  private initialize(): boolean {
    if (this.canvas) return Boolean(this.program)
    this.canvas = document.createElement('canvas')
    const gl = this.canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true })
    if (!gl) return false
    this.gl = gl
    const program = gl.createProgram()
    if (!program) return false
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
        const shader = gl.createShader(type)
        if (!shader) throw new Error('Cannot allocate biome shader')
        gl.shaderSource(shader, source); gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Biome shader compile failed')
        gl.attachShader(program, shader); gl.deleteShader(shader)
      }
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Biome shader link failed')
      this.program = program
      this.buffer = gl.createBuffer() ?? undefined
      return Boolean(this.buffer)
    } catch (error) {
      gl.deleteProgram(program)
      console.error('ONI 群落背景 WebGL 初始化失败。', error)
      return false
    }
  }

  render(input: OniBiomeRenderInput): boolean {
    const first = Object.values(input.backgrounds).filter(image => image.naturalWidth > 0).reduce<HTMLImageElement | undefined>((best, image) => !best || image.naturalWidth > best.naturalWidth ? image : best, undefined)
    if (!first || !this.initialize()) return false
    const gl = this.gl!, canvas = this.canvas!, program = this.program!
    const width = input.width + 2, height = input.height + 2
    if (this.zonesKey !== input.worldZones || this.gridWidth !== width || this.gridHeight !== height) {
      const bytes = new Uint8Array(width * height).fill(255)
      for (let y = 0; y < input.height; y++) for (let x = 0; x < input.width; x++) {
        const zone = input.worldZones[y * input.width + x]
        bytes[(height - 2 - y) * width + x + 1] = zone === 7 || zone === 255 ? 255 : ONI_ZONE_TEXTURE_ARRAY_INDICES[zone] ?? 0
      }
      this.zoneTexture ??= gl.createTexture() ?? undefined
      gl.bindTexture(gl.TEXTURE_2D, this.zoneTexture ?? null)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, bytes)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      this.zonesKey = input.worldZones; this.gridWidth = width; this.gridHeight = height
    }
    if (this.backgroundsKey !== input.backgrounds) {
      if (this.images) gl.deleteTexture(this.images)
      this.images = gl.createTexture() ?? undefined
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.images ?? null)
      const count = 19
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, first.naturalWidth, first.naturalHeight, count, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      for (let slice = 0; slice < count; slice++) {
        const image = input.backgrounds[slice]
        if (image?.naturalWidth && image.naturalHeight) {
          let source: HTMLImageElement | HTMLCanvasElement = image
          if (image.naturalWidth !== first.naturalWidth || image.naturalHeight !== first.naturalHeight) {
            const resized = this.resizeCanvas ??= document.createElement('canvas')
            resized.width = first.naturalWidth; resized.height = first.naturalHeight
            resized.getContext('2d')!.drawImage(image, 0, 0, resized.width, resized.height)
            source = resized
          }
          gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, slice, first.naturalWidth, first.naturalHeight, 1, gl.RGBA, gl.UNSIGNED_BYTE, source)
        }
      }
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY)
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT)
      this.backgroundsKey = input.backgrounds
    }
    if (!this.zoneTexture || !this.images || !this.buffer) return false
    if (canvas.width !== input.context.canvas.width) canvas.width = input.context.canvas.width
    if (canvas.height !== input.context.canvas.height) canvas.height = input.context.canvas.height
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
    gl.disable(gl.BLEND); gl.useProgram(program)
    gl.uniform2f(gl.getUniformLocation(program, 'u_viewport'), canvas.width, canvas.height)
    gl.uniform2f(gl.getUniformLocation(program, 'u_origin'), input.originX, input.originY)
    gl.uniform1f(gl.getUniformLocation(program, 'u_cell_size'), input.cellSize)
    gl.uniform2i(gl.getUniformLocation(program, 'u_grid'), width, height)
    gl.uniform1f(gl.getUniformLocation(program, 'u_world_height'), input.height)
    gl.uniform1f(gl.getUniformLocation(program, 'u_uv_scale'), ONI_BACKGROUND_SETTINGS.uvScale / 20)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.zoneTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_zones'), 0)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.images)
    gl.uniform1i(gl.getUniformLocation(program, 'u_images'), 1)
    const l = input.originX + input.range.minX * input.cellSize
    const r = input.originX + (input.range.maxX + 1) * input.cellSize
    const t = input.originY + input.range.minRow * input.cellSize
    const b = input.originY + (input.range.maxRow + 1) * input.cellSize
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([l,t,r,t,l,b,l,b,r,t,r,b]), gl.DYNAMIC_DRAW)
    const position = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 8, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    input.context.drawImage(canvas, 0, 0)
    return true
  }
}
