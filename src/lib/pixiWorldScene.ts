import { Application, Container, Sprite, Texture } from 'pixi.js'

export type WorldChunkLayer = 'background' | 'gas' | 'terrain' | 'entitiesBack' | 'liquid' | 'entitiesFront' | 'particles' | 'light' | 'overlay'

const WORLD_CHUNK_LAYER_ORDER: Record<WorldChunkLayer, number> = {
  background: 0,
  entitiesBack: 10,
  gas: 20,
  liquid: 30,
  terrain: 40,
  entitiesFront: 50,
  particles: 60,
  light: 70,
  overlay: 80,
}

export type WorldChunk = {
  key: string
  x: number
  y: number
  canvas: HTMLCanvasElement
  layer?: WorldChunkLayer
  /** Stable within a layer, for example a saved object's scene/Z order. */
  order?: number
  /** Crisp editor overlays opt out; world artwork uses linear sampling. */
  scaleMode?: 'linear' | 'nearest'
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

  async init(canvas: HTMLCanvasElement): Promise<boolean> {
    if (this.initializing || this.initialized || this.destroyed) return false
    this.initializing = true
    try {
      await this.app.init({
        canvas,
        preference: 'webgl',
        antialias: false,
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
        // ONI assets are pixel art. Linear filtering makes every cell look
        // blurred when the retained chunk is scaled by the camera.
        previous.texture.source.scaleMode = chunk.scaleMode ?? 'nearest'
        previous.texture.source.update()
        this.render()
        return
      }
      this.destroyChunk(previous)
    }
    // skipCache avoids Pixi's global resource cache retaining disposable
    // chunk canvases after a world or save is closed.
    const texture = Texture.from(chunk.canvas, true)
    texture.source.scaleMode = chunk.scaleMode ?? 'nearest'
    const sprite = new Sprite(texture)
    sprite.position.set(chunk.x, chunk.y)
    sprite.cullable = true
    sprite.zIndex = zIndex
    this.world.addChild(sprite)
    this.chunks.set(retainedKey, { canvas: chunk.canvas, sprite, texture })
    this.render()
  }

  beginBatch(): void {
    this.batchDepth += 1
  }

  endBatch(): void {
    if (this.batchDepth <= 0) return
    this.batchDepth -= 1
    if (this.batchDepth === 0 && this.batchDirty) {
      this.batchDirty = false
      this.render()
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

  setCamera(x: number, y: number, scale: number): void {
    this.world.position.set(x, y)
    this.world.scale.set(scale)
    this.render()
  }

  render(): void {
    if (this.batchDepth > 0) {
      this.batchDirty = true
      return
    }
    if (!this.initialized || this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      if (this.initialized) this.app.render()
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
