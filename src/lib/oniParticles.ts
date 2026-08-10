import { member, scalarNumber } from './editor'
import type { DictValue, ObjectValue, RawPodValue, Value } from './model'
import type { ParsedSave } from './save'
import { ONI_SUBSTANCE_MATERIALS } from './oniSubstances.generated'

export interface OniParticleTextures {
  fallingWater: CanvasImageSource
  bubbles: CanvasImageSource
}

export interface OniParticleRenderOptions {
  worldHeight: number
  cellSize: number
  originX: number
  originY: number
}

interface FallingWaterParticle {
  x: number
  y: number
  frame: number
  mass: number
  colour: readonly [number, number, number, number]
}

interface BubbleParticle {
  x: number
  y: number
  frame: number
  sizeLevel: number
  alpha: number
  colour: readonly [number, number, number, number]
}

const substancesByElementId = new Map<number, (typeof ONI_SUBSTANCE_MATERIALS)[number]>(
  ONI_SUBSTANCE_MATERIALS.map((material) => [material.elementId, material]),
)
let texturePromise: Promise<OniParticleTextures> | undefined

function object(value: Value | undefined): ObjectValue | undefined {
  return value?.kind === 'object' ? value : undefined
}

function dictionary(value: Value | undefined): DictValue | undefined {
  return value?.kind === 'dict' ? value : undefined
}

function rawPod(value: Value | undefined): RawPodValue | undefined {
  return value?.kind === 'raw-pod' ? value : undefined
}

function valueNumber(value: Value | undefined): number | undefined {
  return scalarNumber(value)
}

function nestedNumber(value: Value | undefined, ...names: string[]): number | undefined {
  let current = value
  for (const name of names) current = member(object(current), name)?.value
  return valueNumber(current)
}

function podNumbers(pod: RawPodValue | undefined, kind: 'float32' | 'int32' | 'byte'): number[] {
  if (!pod) return []
  if (kind === 'byte') return Array.from(pod.bytes.subarray(0, pod.count))
  const view = new DataView(pod.bytes.buffer, pod.bytes.byteOffset, pod.bytes.byteLength)
  const count = Math.min(pod.count, Math.floor(pod.bytes.byteLength / 4))
  return Array.from({ length: count }, (_, index) => kind === 'float32'
    ? view.getFloat32(index * 4, true)
    : view.getInt32(index * 4, true))
}

function image(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const result = new Image()
    result.onload = () => resolve(result)
    result.onerror = () => reject(new Error(`Unable to load ${url}`))
    result.src = url
  })
}

export function loadOniParticleTextures(): Promise<OniParticleTextures> {
  texturePromise ??= Promise.all([
    image('/assets/particles/water_drip.png'),
    image('/assets/particles/bubbleObject.png'),
  ]).then(([fallingWater, bubbles]) => ({ fallingWater, bubbles }))
  return texturePromise
}

function fallingWaterParticles(save: ParsedSave): FallingWaterParticle[] {
  const fallingWater = object(member(save.gameData, 'fallingWater')?.value)
  const physics = member(fallingWater, 'physics')?.value
  const properties = member(fallingWater, 'serializedParticleProperties')?.value
  if (physics?.kind !== 'list' || properties?.kind !== 'list') return []
  const count = Math.min(physics.items.length, properties.items.length, 16249)
  const particles: FallingWaterParticle[] = []
  for (let index = 0; index < count; index++) {
    const body = object(physics.items[index])
    const property = object(properties.items[index])
    const position = member(body, 'position')?.value
    const colour = object(member(body, 'colour')?.value)
    const red = valueNumber(member(colour, 'r')?.value)
    const green = valueNumber(member(colour, 'g')?.value)
    const blue = valueNumber(member(colour, 'b')?.value)
    const alpha = valueNumber(member(colour, 'a')?.value)
    if (position?.kind !== 'vector2' || red === undefined || green === undefined || blue === undefined) continue
    particles.push({
      x: position.x,
      y: position.y,
      frame: Math.max(0, Math.min(3, valueNumber(member(body, 'frame')?.value) ?? 0)),
      mass: Math.max(0, valueNumber(member(property, 'mass')?.value) ?? 0),
      // FallingWater stores Color32.a as the substance glow flag; the shader does
      // not use it as sprite opacity.
      colour: [red, green, blue, alpha ?? 0],
    })
  }
  return particles
}

function bubbleParticles(save: ParsedSave): BubbleParticle[] {
  const manager = object(member(save.gameData, 'bubbleManager')?.value)
  const bubbles = dictionary(member(manager, 'bubbles')?.value)
  const archetypes = dictionary(member(manager, 'archetypes')?.value)
  if (!bubbles || !archetypes) return []
  const archetypeElements = new Map<number, number>()
  for (let index = 0; index < Math.min(archetypes.keys.length, archetypes.values.length); index++) {
    const hash = nestedNumber(archetypes.keys[index], 'hashCode')
    const element = valueNumber(member(object(archetypes.values[index]), 'element')?.value)
    if (hash !== undefined && element !== undefined) archetypeElements.set(hash, element)
  }
  const result: BubbleParticle[] = []
  for (let bucketIndex = 0; bucketIndex < Math.min(bubbles.keys.length, bubbles.values.length); bucketIndex++) {
    const key = object(bubbles.keys[bucketIndex])
    const data = object(bubbles.values[bucketIndex])
    const archetypeHash = nestedNumber(member(key, 'archetype')?.value, 'hashCode')
    const substance = archetypeHash === undefined ? undefined : substancesByElementId.get(archetypeElements.get(archetypeHash) ?? 0)
    const colour = substance?.colour ?? [255, 255, 255, 255]
    const positions = member(data, 'position')?.value
    if (positions?.kind !== 'list') continue
    const frames = podNumbers(rawPod(member(data, 'frame')?.value), 'int32')
    const levels = podNumbers(rawPod(member(data, 'sizeLevel')?.value), 'byte')
    const alphas = podNumbers(rawPod(member(data, 'alpha')?.value), 'float32')
    const count = Math.min(positions.items.length, frames.length, levels.length, alphas.length)
    for (let index = 0; index < count && result.length < 16249; index++) {
      const position = positions.items[index]
      const serializedAlpha = alphas[index]
      if (position.kind !== 'vector2' || serializedAlpha === 0 || !Number.isFinite(serializedAlpha)) continue
      result.push({
        x: position.x,
        y: position.y,
        frame: ((frames[index] % 30) + 30) % 30,
        sizeLevel: Math.max(0, Math.min(2, levels[index])),
        // Subscript.Alpha maps the -1 "not fading" sentinel to fully opaque.
        alpha: serializedAlpha === -1 ? 1 : Math.max(0, Math.min(1, serializedAlpha)),
        colour,
      })
    }
  }
  return result
}

function tintedAtlas(texture: HTMLImageElement, colour: readonly [number, number, number, number]): HTMLCanvasElement {
  const atlas = document.createElement('canvas')
  atlas.width = texture.width
  atlas.height = texture.height
  const context = atlas.getContext('2d')
  if (!context) return atlas
  context.drawImage(texture, 0, 0)
  context.globalCompositeOperation = 'source-in'
  context.fillStyle = `rgb(${colour[0]} ${colour[1]} ${colour[2]})`
  context.fillRect(0, 0, atlas.width, atlas.height)
  return atlas
}

export function drawOniSavedParticles(
  context: CanvasRenderingContext2D,
  save: ParsedSave,
  textures: OniParticleTextures,
  options: OniParticleRenderOptions,
): { fallingWater: number; bubbles: number } {
  const { worldHeight, cellSize, originX, originY } = options
  const water = fallingWaterParticles(save)
  const bubbles = bubbleParticles(save)
  const waterTexture = textures.fallingWater as HTMLImageElement
  const bubbleTexture = textures.bubbles as HTMLImageElement
  const waterFrameWidth = waterTexture.width / 4
  const bubbleFrameWidth = bubbleTexture.width / 30
  const bubbleRowHeight = bubbleTexture.height / 3
  const waterAtlases = new Map<string, HTMLCanvasElement>()
  const bubbleAtlases = new Map<string, HTMLCanvasElement>()
  const atlasFor = (texture: HTMLImageElement, colour: readonly [number, number, number, number], cache: Map<string, HTMLCanvasElement>) => {
    const key = `${colour[0]},${colour[1]},${colour[2]}`
    let atlas = cache.get(key)
    if (!atlas) {
      atlas = tintedAtlas(texture, colour)
      cache.set(key, atlas)
    }
    return atlas
  }

  for (const particle of water) {
    const scale = .25 + .75 * Math.max(0, Math.min(1, particle.mass / 50))
    const size = cellSize * scale
    const centerX = originX + particle.x * cellSize
    const centerY = originY + (worldHeight - particle.y) * cellSize
    context.drawImage(atlasFor(waterTexture, particle.colour, waterAtlases), particle.frame * waterFrameWidth, 0, waterFrameWidth, waterTexture.height, centerX - size / 2, centerY - size / 2, size, size)
  }
  for (const particle of bubbles) {
    const centerX = originX + particle.x * cellSize
    const centerY = originY + (worldHeight - particle.y) * cellSize
    context.save()
    context.globalAlpha = particle.alpha * (particle.colour[3] / 255)
    context.drawImage(atlasFor(bubbleTexture, particle.colour, bubbleAtlases), particle.frame * bubbleFrameWidth, particle.sizeLevel * bubbleRowHeight, bubbleFrameWidth, bubbleRowHeight, centerX - cellSize / 2, centerY - cellSize / 2, cellSize, cellSize)
    context.restore()
  }
  return { fallingWater: water.length, bubbles: bubbles.length }
}

export function oniSavedParticleCounts(save: ParsedSave): { fallingWater: number; bubbles: number } {
  return {
    fallingWater: fallingWaterParticles(save).length,
    bubbles: bubbleParticles(save).length,
  }
}
