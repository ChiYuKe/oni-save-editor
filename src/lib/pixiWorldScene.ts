import { OniRenderStats } from './oniRenderStats'
import { Application, Container, Sprite, Texture } from 'pixi.js'
import { ONI_CHUNK_LAYERS } from './oniRenderLayers'

export type WorldChunkLayer = 'background' | 'gas' | 'terrain' | 'entitiesBack' | 'liquid' | 'entitiesFront' | 'particles' | 'light' | 'overlay'

const WORLD_CHUNK_LAYER_ORDER = Object.fromEntries(
  [...ONI_CHUNK_LAYERS, 'overlay'].map((layer, index) => [layer, index * 10]),
) as Record<WorldChunkLayer, number>

export type WorldChunk = {
  key: string
  x: number
  y: number
  canvas: HTMLCanvasElement
  width?: number
  height?: number
  layer?: WorldChunkLayer
  /** Stable within a layer, for example a saved object's scene/Z order. */
  order?: number
  /** Crisp editor overlays opt out; world artwork uses linear sampling. */
  scaleMode?: 'linear' | 'nearest'
  /** Viewport-sized dynamic textures do not need a new mip pyramid each frame. */
  mipmaps?: boolean
}

type RetainedChunk = {
  canvas: HTMLCanvasElement
  sprite: Sprite
  texture: Texture
}

export class PixiWorldScene {
  private readonly app = new Application()
  private readonly world = new Container()
  private readonly chunks = new Map<string, RetainedChunk>()
  private initialized = false
  private initializing = false
  private destroyRequested = false
  private destroyed = false
  private frame = 0
  private batchDepth = 0
  private batchDirty = false
  private readonly stats = new OniRenderStats()

  async init(canvas: HTMLCanvasElement): Promise<boolean> {
    if (this.initializing || this.initialized || this.destroyed) return false
    this.initializing = true
    try {
      await this.app.init({
        canvas,
        preference: 'webgl',
        antialias: true,
        autoDensity: true,
        resolution: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
        backgroundAlpha: 0,
        clearBeforeRender: true,
        powerPreference: 'high-performance',
      })
      this.initializing = false
      this.initialized = true
      if (this.destroyRequested) {
        this.destroyNow()
        return false
      }
      this.app.stage.addChild(this.world)
      this.world.cullable = true
      this.world.sortableChildren = true
      this.app.ticker.stop()
      return true
    } catch (cause) {
      this.initializing = false
      this.destroyRequested = true
      if (this.initialized) this.destroyNow()
      console.error('Pixi 地图场景初始化失败。', cause)
      return false
    }
  }

  resize(width: number, height: number): void {
    if (!this.initialized || width <= 0 || height <= 0) return
    this.app.renderer.resize(Math.ceil(width), Math.ceil(height))
    this.render()
  }

  setChunk(chunk: WorldChunk): void {
    if (!this.initialized || this.destroyed || chunk.canvas.width <= 0 || chunk.canvas.height <= 0) return
    const layer = chunk.layer ?? 'terrain'
    // Layer belongs in the retained key. This lets the terrain, fluids and
    // objects for the same world tile be replaced independently.
    const retainedKey = `${layer}:${chunk.key}`
    const zIndex = WORLD_CHUNK_LAYER_ORDER[layer] * 1_000_000 + (chunk.order ?? 0)
    const previous = this.chunks.get(retainedKey)
    if (previous) {
      // Most chunk rebuilds repaint the same retained canvas. Preserve the
      // Sprite and TextureSource so Pixi only re-uploads pixels instead of
      // allocating and destroying GPU resources for every edit/layer toggle.
      if (previous.canvas === chunk.canvas) {
        previous.sprite.position.set(chunk.x, chunk.y)
        previous.sprite.zIndex = zIndex
        previous.sprite.blendMode = layer === 'light' ? 'add' : 'normal'
        previous.sprite.width = chunk.width ?? chunk.canvas.width
        previous.sprite.height = chunk.height ?? chunk.canvas.height
        previous.texture.source.scaleMode = chunk.scaleMode ?? 'linear'
        previous.texture.source.autoGenerateMipmaps = chunk.mipmaps ?? chunk.scaleMode !== 'nearest'
        previous.texture.source.update()
        this.render()
        return
      }
      this.destroyChunk(previous)
    }
    // skipCache avoids Pixi's global resource cache retaining disposable
    // chunk canvases after a world or save is closed.
    const texture = Texture.from(chunk.canvas, true)
    texture.source.scaleMode = chunk.scaleMode ?? 'linear'
    texture.source.autoGenerateMipmaps = chunk.mipmaps ?? chunk.scaleMode !== 'nearest'
    const sprite = new Sprite(texture)
    sprite.position.set(chunk.x, chunk.y)
    sprite.width = chunk.width ?? chunk.canvas.width
    sprite.height = chunk.height ?? chunk.canvas.height
    sprite.cullable = true
    sprite.zIndex = zIndex
    sprite.blendMode = layer === 'light' ? 'add' : 'normal'
    this.world.addChild(sprite)
    this.chunks.set(retainedKey, { canvas: chunk.canvas, sprite, texture })
    this.render()
  }

  beginBatch(): void {
    this.batchDepth += 1
  }

  endBatch(immediate = false): void {
    if (this.batchDepth <= 0) return
    this.batchDepth -= 1
    if (this.batchDepth === 0 && this.batchDirty) {
      this.batchDirty = false
      if (immediate) this.renderNow()
      else this.render()
    }
  }

  removeMissing(keys: Set<string>, layer?: WorldChunkLayer): void {
    for (const [key, item] of this.chunks) {
      const separator = key.indexOf(':')
      const chunkLayer = key.slice(0, separator) as WorldChunkLayer
      const chunkKey = key.slice(separator + 1)
      if ((layer && chunkLayer !== layer) || keys.has(chunkKey)) continue
      this.destroyChunk(item)
      this.chunks.delete(key)
    }
    this.render()
  }

  clearLayer(layer: WorldChunkLayer): void {
    this.removeMissing(new Set(), layer)
  }

  visibleWorldRect() {
    const scale = this.world.scale.x
    return { x: -this.world.position.x / scale, y: -this.world.position.y / scale,
      width: this.app.screen.width / scale, height: this.app.screen.height / scale, scale }
  }

  setCamera(x: number, y: number, scale: number): void {
    this.world.position.set(x, y)
    this.world.scale.set(scale)
    this.render()
  }

  private renderNow(): void {
    if (!this.initialized || this.destroyed) return
    if (this.frame) cancelAnimationFrame(this.frame)
    this.frame = 0
    this.draw()
  }

  renderStats(now: number) { return this.stats.sample(now) }

  private draw(): void {
    const start = performance.now()
    this.app.render()
    this.stats.record(performance.now() - start)
  }

  render(): void {
    if (this.batchDepth > 0) {
      this.batchDirty = true
      return
    }
    if (!this.initialized || this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      if (this.initialized) this.draw()
    })
  }

  destroy(): void {
    if (this.destroyed || this.destroyRequested) return
    this.destroyRequested = true
    if (this.initializing || !this.initialized) return
    this.destroyNow()
  }

  private destroyNow(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.frame) cancelAnimationFrame(this.frame)
    this.frame = 0
    for (const item of this.chunks.values()) {
      this.destroyChunk(item)
    }
    this.chunks.clear()
    this.app.destroy({ removeView: false }, { children: true, texture: false, textureSource: false })
    this.initialized = false
  }

  private destroyChunk(item: RetainedChunk): void {
    this.world.removeChild(item.sprite)
    item.sprite.destroy({ texture: false, textureSource: false })
    item.texture.destroy(true)
  }
}
