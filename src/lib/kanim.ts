export type KanimBuildFrame = {
  sourceFrameNum: number
  duration: number
  buildImageIndex: number
  pivotX: number
  pivotY: number
  pivotWidth: number
  pivotHeight: number
  uvX1: number
  uvY1: number
  uvX2: number
  uvY2: number
}

export type KanimSymbol = {
  hash: number
  path: number
  color: number
  flags: number
  frames: KanimBuildFrame[]
}

export type KanimAnimationElement = {
  symbolHash: number
  frameNumber: number
  folderHash: number
  flags: number
  alpha: number
  blue: number
  green: number
  red: number
  m00: number
  m10: number
  m01: number
  m11: number
  m02: number
  m12: number
  order: number
}

export type KanimAnimationFrame = {
  x: number
  y: number
  width: number
  height: number
  elements: KanimAnimationElement[]
}

export type KanimBank = {
  name: string
  hash: number
  rate: number
  frames: KanimAnimationFrame[]
}

export type KanimPackage = {
  name: string
  width: number
  height: number
  texture: CanvasImageSource
  symbols: Map<number, KanimSymbol>
  symbolNames: Map<number, string>
  banks: KanimBank[]
}

export type KanimSource = {
  id: string
  name: string
  path: string
  texture: File
  build: File
  anim: File
}

export type KanimFileEntry = { file: File; path: string }

class BinaryCursor {
  private readonly view: DataView
  private offset = 0

  constructor(bytes: ArrayBuffer | Uint8Array) {
    const buffer = bytes instanceof Uint8Array
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      : bytes
    this.view = new DataView(buffer)
  }

  get position(): number {
    return this.offset
  }

  get remaining(): number {
    return this.view.byteLength - this.offset
  }

  private ensure(size: number): void {
    if (size < 0 || this.offset + size > this.view.byteLength) {
      throw new Error('KAnim 文件已损坏或版本不兼容。')
    }
  }

  bytes(size: number): Uint8Array {
    this.ensure(size)
    const result = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, size)
    this.offset += size
    return result
  }

  int32(): number {
    this.ensure(4)
    const result = this.view.getInt32(this.offset, true)
    this.offset += 4
    return result
  }

  float32(): number {
    this.ensure(4)
    const result = this.view.getFloat32(this.offset, true)
    this.offset += 4
    return result
  }

  string(): string {
    const length = this.int32()
    if (length <= 0) return ''
    const bytes = this.bytes(length)
    return new TextDecoder('ascii').decode(bytes)
  }
}

function assertHeader(cursor: BinaryCursor, header: string): void {
  const actual = new TextDecoder('ascii').decode(cursor.bytes(header.length))
  if (actual !== header) throw new Error(`不是有效的 ${header} KAnim 文件。`)
}

export function parseKanimBuild(bytes: ArrayBuffer | Uint8Array): { name: string; symbols: Map<number, KanimSymbol>; symbolNames: Map<number, string> } {
  const cursor = new BinaryCursor(bytes)
  assertHeader(cursor, 'BILD')
  const version = cursor.int32()
  const symbolCount = cursor.int32()
  cursor.int32()
  const name = cursor.string()
  const symbols = new Map<number, KanimSymbol>()

  for (let symbolIndex = 0; symbolIndex < symbolCount; symbolIndex++) {
    const hash = cursor.int32()
    const path = version > 9 ? cursor.int32() : 0
    const color = cursor.int32()
    const flags = cursor.int32()
    const frameCount = cursor.int32()
    const frames: KanimBuildFrame[] = []
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      frames.push({
        sourceFrameNum: cursor.int32(),
        duration: cursor.int32(),
        buildImageIndex: cursor.int32(),
        pivotX: cursor.float32(),
        pivotY: cursor.float32(),
        pivotWidth: cursor.float32(),
        pivotHeight: cursor.float32(),
        uvX1: cursor.float32(),
        uvY1: cursor.float32(),
        uvX2: cursor.float32(),
        uvY2: cursor.float32(),
      })
    }
    symbols.set(hash, { hash, path, color, flags, frames })
  }

  const hashCount = cursor.int32()
  const symbolNames = new Map<number, string>()
  for (let index = 0; index < hashCount; index++) symbolNames.set(cursor.int32(), cursor.string())
  return { name, symbols, symbolNames }
}

export function parseKanimAnim(bytes: ArrayBuffer | Uint8Array): { banks: KanimBank[]; symbolNames: Map<number, string> } {
  const cursor = new BinaryCursor(bytes)
  assertHeader(cursor, 'ANIM')
  cursor.int32()
  cursor.int32()
  cursor.int32()
  const bankCount = cursor.int32()
  const banks: KanimBank[] = []

  for (let bankIndex = 0; bankIndex < bankCount; bankIndex++) {
    const name = cursor.string()
    const hash = cursor.int32()
    const rate = cursor.float32()
    const frameCount = cursor.int32()
    const frames: KanimAnimationFrame[] = []
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const frame: KanimAnimationFrame = {
        x: cursor.float32(),
        y: cursor.float32(),
        width: cursor.float32(),
        height: cursor.float32(),
        elements: [],
      }
      const elementCount = cursor.int32()
      for (let elementIndex = 0; elementIndex < elementCount; elementIndex++) {
        frame.elements.push({
          symbolHash: cursor.int32(),
          frameNumber: cursor.int32(),
          folderHash: cursor.int32(),
          flags: cursor.int32(),
          alpha: cursor.float32(),
          blue: cursor.float32(),
          green: cursor.float32(),
          red: cursor.float32(),
          m00: cursor.float32(),
          m10: cursor.float32(),
          m01: cursor.float32(),
          m11: cursor.float32(),
          m02: cursor.float32(),
          m12: cursor.float32(),
          order: cursor.float32(),
        })
      }
      frames.push(frame)
    }
    banks.push({ name, hash, rate, frames })
  }

  cursor.int32()
  const hashCount = cursor.int32()
  const symbolNames = new Map<number, string>()
  for (let index = 0; index < hashCount; index++) symbolNames.set(cursor.int32(), cursor.string())
  return { banks, symbolNames }
}

async function imageSourceFromFile(file: File): Promise<CanvasImageSource> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法读取 KAnim 纹理 PNG。'))
    }
    image.src = url
  })
}

export async function loadKanimPackage(source: KanimSource): Promise<KanimPackage> {
  const [texture, buildBytes, animBytes] = await Promise.all([
    imageSourceFromFile(source.texture),
    source.build.arrayBuffer(),
    source.anim.arrayBuffer(),
  ])
  const build = parseKanimBuild(buildBytes)
  const anim = parseKanimAnim(animBytes)
  const image = texture as CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number }
  const width = image.width ?? image.naturalWidth ?? 0
  const height = image.height ?? image.naturalHeight ?? 0
  if (width <= 0 || height <= 0) throw new Error('KAnim 纹理尺寸无效。')
  return { name: build.name || source.name, width, height, texture, symbols: build.symbols, symbolNames: new Map([...build.symbolNames, ...anim.symbolNames]), banks: anim.banks }
}

export function collectKanimSources(entries: KanimFileEntry[]): KanimSource[] {
  type Parts = { path: string; name: string; texture?: File; build?: File; anim?: File }
  const groups = new Map<string, Parts>()
  for (const entry of entries) {
    const normalizedPath = entry.path.replace(/\\/g, '/')
    const slash = normalizedPath.lastIndexOf('/')
    const directory = slash >= 0 ? normalizedPath.slice(0, slash) : ''
    const fileName = normalizedPath.slice(slash + 1)
    const match = fileName.match(/^(.*)_0\.png$/i) ?? fileName.match(/^(.*)_(build|anim)\.bytes$/i)
    if (!match) continue
    const baseName = match[1]
    const kind = fileName.toLowerCase().endsWith('_0.png') ? 'texture' : fileName.toLowerCase().endsWith('_build.bytes') ? 'build' : 'anim'
    const id = `${directory}/${baseName}`
    const current = groups.get(id) ?? { path: directory ? `${directory}/${baseName}` : baseName, name: baseName.replace(/_kanim$/i, '') }
    current[kind] = entry.file
    groups.set(id, current)
  }
  return [...groups.entries()]
    .filter(([, parts]) => parts.texture && parts.build && parts.anim)
    .map(([id, parts]) => ({ id, name: parts.name, path: parts.path, texture: parts.texture!, build: parts.build!, anim: parts.anim! }))
    .sort((first, second) => first.name.localeCompare(second.name))
}

function buildFrameForElement(packageData: KanimPackage, element: KanimAnimationElement): KanimBuildFrame | undefined {
  const symbol = packageData.symbols.get(element.symbolHash)
  if (!symbol) return undefined
  return symbol.frames.find((frame) => frame.sourceFrameNum === element.frameNumber) ?? symbol.frames[element.frameNumber]
}

type AffineTransform = { a: number; b: number; c: number; d: number; e: number; f: number }
type Point = { x: number; y: number }

function elementTransform(element: KanimAnimationElement, frame: KanimBuildFrame): AffineTransform {
  const transformPoint = (x: number, y: number): Point => {
    const pivotedX = x * .5 + frame.pivotX
    const pivotedY = y * .5 + frame.pivotY
    return {
      x: pivotedX * element.m00 + pivotedY * element.m01 + element.m02,
      y: pivotedX * element.m10 + pivotedY * element.m11 + element.m12,
    }
  }
  const origin = transformPoint(0, 0)
  const unitX = transformPoint(1, 0)
  const unitY = transformPoint(0, 1)
  return { a: unitX.x - origin.x, b: unitX.y - origin.y, c: unitY.x - origin.x, d: unitY.y - origin.y, e: origin.x, f: origin.y }
}

function localRect(frame: KanimBuildFrame): { left: number; top: number; right: number; bottom: number } {
  return { left: -frame.pivotWidth, top: -frame.pivotHeight, right: frame.pivotWidth, bottom: frame.pivotHeight }
}

function transformedBounds(frame: KanimBuildFrame, transform: AffineTransform): { left: number; top: number; right: number; bottom: number } {
  const rect = localRect(frame)
  const points = [
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.left, y: rect.bottom },
    { x: rect.right, y: rect.bottom },
  ].map(({ x, y }) => ({ x: transform.a * x + transform.c * y + transform.e, y: transform.b * x + transform.d * y + transform.f }))
  return {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y)),
  }
}

function unionBounds(current: { left: number; top: number; right: number; bottom: number } | null, next: { left: number; top: number; right: number; bottom: number }) {
  if (!current) return next
  return { left: Math.min(current.left, next.left), top: Math.min(current.top, next.top), right: Math.max(current.right, next.right), bottom: Math.max(current.bottom, next.bottom) }
}

function textureRectangle(frame: KanimBuildFrame, width: number, height: number): { x: number; y: number; width: number; height: number } {
  const x1 = Math.max(0, Math.min(width, Math.floor(frame.uvX1 * width)))
  const y1 = Math.max(0, Math.min(height, Math.floor(frame.uvY1 * height)))
  const x2 = Math.max(x1 + 1, Math.min(width, Math.floor(frame.uvX2 * width) || x1 + 1))
  const y2 = Math.max(y1 + 1, Math.min(height, Math.floor(frame.uvY2 * height) || y1 + 1))
  return { x: x1, y: y1, width: Math.max(1, x2 - x1), height: Math.max(1, y2 - y1) }
}

function colorIsWhite(element: KanimAnimationElement): boolean {
  return Math.abs(element.red - 1) < .001 && Math.abs(element.green - 1) < .001 && Math.abs(element.blue - 1) < .001
}

export function preferredKanimBank(packageData: KanimPackage): string {
  for (const preferred of ['on', 'working_loop', 'idle', 'off', 'working_pre', 'place']) {
    const bank = packageData.banks.find((candidate) => candidate.name.toLowerCase() === preferred)
    if (bank && bank.frames.length > 0) return bank.name
  }
  return packageData.banks.find((bank) => bank.frames.length > 0)?.name ?? ''
}

export function renderKanimFrame(packageData: KanimPackage, bankName: string, frameIndex = 0, requestedScale = 1): HTMLCanvasElement {
  const bank = packageData.banks.find((candidate) => candidate.name === bankName) ?? packageData.banks[0]
  if (!bank || bank.frames.length === 0) throw new Error('这个 KAnim 没有可渲染的动画帧。')
  const frame = bank.frames[Math.max(0, Math.min(bank.frames.length - 1, frameIndex))]
  let bounds: { left: number; top: number; right: number; bottom: number } | null = null
  const renderElements: Array<{ element: KanimAnimationElement; buildFrame: KanimBuildFrame; transform: AffineTransform }> = []

  for (const element of frame.elements) {
    const buildFrame = buildFrameForElement(packageData, element)
    if (!buildFrame || element.alpha <= 0) continue
    const transform = elementTransform(element, buildFrame)
    bounds = unionBounds(bounds, transformedBounds(buildFrame, transform))
    renderElements.push({ element, buildFrame, transform })
  }

  if (!bounds) bounds = { left: frame.x, top: frame.y, right: frame.x + frame.width, bottom: frame.y + frame.height }
  const padding = 2
  let scale = Number.isFinite(requestedScale) && requestedScale > 0 ? requestedScale : 1
  const maxDimension = 8192
  scale = Math.min(scale, maxDimension / Math.max(1, bounds.right - bounds.left), maxDimension / Math.max(1, bounds.bottom - bounds.top))
  const width = Math.max(1, Math.ceil((bounds.right - bounds.left) * scale) + padding * 2)
  const height = Math.max(1, Math.ceil((bounds.bottom - bounds.top) * scale) + padding * 2)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法创建 PNG 画布。')
  context.clearRect(0, 0, width, height)
  context.imageSmoothingEnabled = true

  for (let index = renderElements.length - 1; index >= 0; index--) {
    const { element, buildFrame, transform } = renderElements[index]
    const source = textureRectangle(buildFrame, packageData.width, packageData.height)
    const rect = localRect(buildFrame)
    context.save()
    context.setTransform(
      transform.a * scale,
      transform.b * scale,
      transform.c * scale,
      transform.d * scale,
      (transform.e - bounds.left) * scale + padding,
      (transform.f - bounds.top) * scale + padding,
    )
    context.globalAlpha = Math.max(0, Math.min(1, element.alpha))
    if (!colorIsWhite(element)) {
      // ONI uses this color multiplier sparingly; keep the source colors intact
      // for the common white-tinted building symbols.
      context.globalAlpha *= Math.max(0, Math.min(1, (element.red + element.green + element.blue) / 3))
    }
    context.drawImage(packageData.texture, source.x, source.y, source.width, source.height, rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)
    context.restore()
  }
  return canvas
}

export async function canvasPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('无法生成 PNG 文件。')
  return blob
}
