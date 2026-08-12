import { ELEMENTS, elementForHash, type ElementDefinition } from './elements'
import { ONI_SUBSTANCE_BY_HASH } from './oniSubstances.generated'
import { OniSubstanceWebGLRenderer } from './oniSubstanceWebgl'
import { OniGasWebGLRenderer } from './oniGasWebgl'
import { OniLiquidWebGLRenderer } from './oniLiquidWebgl'
import type { SimCell } from './sim'
import { pickTerrainMaskVariant, type TerrainMaskPaths, type TerrainMaskSets } from './terrainMasks'

export type OniRenderRange = {
  minX: number
  maxX: number
  minRow: number
  maxRow: number
}

export type OniZoneColor = { r: number; g: number; b: number }

export const ONI_SCENE_LAYER_ORDER: Record<string, number> = {
  WorldSelection: -3,
  NoLayer: -2,
  Background: -1,
  Backwall: 1,
  Gas: 2,
  GasConduits: 3,
  GasConduitBridges: 4,
  LiquidConduits: 5,
  LiquidConduitBridges: 6,
  SolidConduits: 7,
  SolidConduitContents: 8,
  SolidConduitBridges: 9,
  Wires: 10,
  WireBridges: 11,
  WireBridgesFront: 12,
  LogicWires: 13,
  LogicGates: 14,
  LogicGatesFront: 15,
  InteriorWall: 16,
  GasFront: 17,
  BuildingBack: 18,
  Building: 19,
  BuildingUse: 20,
  BuildingFront: 21,
  TransferArm: 22,
  Ore: 23,
  Creatures: 24,
  Move: 25,
  Front: 26,
  GlassTile: 27,
  Liquid: 28,
  Ground: 29,
  TileMain: 30,
  TileFront: 31,
  FXFront: 32,
  FXFront2: 33,
  SceneMAX: 34,
}

// Values exported from SubworldZoneRenderData.zoneColours. The substance
// shader uses these as HSL hue/saturation sources, not as RGBA overlays.
export const ONI_WORLD_ZONE_COLORS: Record<number, OniZoneColor> = {
  0: { r: 157, g: 201, b: 214 },
  1: { r: 172, g: 114, b: 193 },
  2: { r: 123, g: 151, b: 75 },
  3: { r: 242, g: 187, b: 71 },
  4: { r: 203, g: 149, b: 163 },
  5: { r: 222, g: 90, b: 59 },
  6: { r: 63, g: 28, b: 5 },
  7: { r: 36, g: 36, b: 36 },
  8: { r: 211, g: 152, b: 152 },
  9: { r: 255, g: 160, b: 7 },
  10: { r: 142, g: 192, b: 57 },
  11: { r: 74, g: 228, b: 88 },
  12: { r: 235, g: 155, b: 63 },
  13: { r: 204, g: 54, b: 54 },
  14: { r: 158, g: 72, b: 223 },
  15: { r: 255, g: 160, b: 7 },
  16: { r: 242, g: 187, b: 71 },
  17: { r: 142, g: 192, b: 57 },
  18: { r: 171, g: 207, b: 234 },
  19: { r: 205, g: 162, b: 199 },
  20: { r: 162, g: 205, b: 164 },
  21: { r: 255, g: 160, b: 7 },
  22: { r: 53, g: 47, b: 140 },
  23: { r: 91, g: 53, b: 16 },
  24: { r: 89, g: 212, b: 161 },
  25: { r: 241, g: 193, b: 218 },
  26: { r: 64, g: 56, b: 75 },
  27: { r: 192, g: 100, b: 16 },
}

const ZONE_TEXTURE_ARRAY_INDICES = [
  0, 1, 2, 3, 4, 5, 5, 3, 6, 7,
  8, 9, 10, 11, 12, 7, 3, 13, 0, 0,
  0, 14, 15, 16, 4, 6, 18, 17,
]

const WORLD_ZONE_FOREGROUND_BLEND = .4
const BIOME_BACKGROUND_WORLD_CELLS = 20
const DEFAULT_ELEMENT_WORLD_UV_SCALE = 8

type GroundMaskSample = {
  element: ElementDefinition
  order: number
}

export type OniTerrainRenderInput = {
  context: CanvasRenderingContext2D
  width: number
  height: number
  cellSize: number
  originX: number
  originY: number
  range: OniRenderRange
  worldZones: Uint8Array
  textures: Record<string, HTMLImageElement>
  maskSets: TerrainMaskSets | null
  cellAt: (x: number, y: number) => SimCell | undefined
  /** Stable save identity used by GPU passes to reuse derived property textures. */
  propertyCacheKey?: object
  isTerrainMaskedAt: (x: number, y: number) => boolean
  damageAt?: (x: number, y: number) => number
  hasBackwallAt?: (x: number, y: number) => boolean
  zoneColors: typeof ONI_WORLD_ZONE_COLORS
}

export type OniBiomeRenderInput = Pick<OniTerrainRenderInput,
  'context' | 'width' | 'height' | 'cellSize' | 'originX' | 'originY' | 'range' | 'worldZones'
> & {
  backgrounds: Record<number, HTMLImageElement>
}

function zoneTextureIndex(zoneType: number): number | undefined {
  if (zoneType === 7 || zoneType === 255) return undefined
  return ZONE_TEXTURE_ARRAY_INDICES[zoneType] ?? 0
}

function terrainMaterialOrder(hash: number | undefined): number {
  if (hash === undefined) return Number.NEGATIVE_INFINITY
  const element = elementForHash(hash)
  if (element.state !== 'solid') return Number.NEGATIVE_INFINITY
  // GroundRenderer compares Element.substance.idx, not SimHashes. The index
  // is the entry order in the game's SubstanceHookup asset.
  return ONI_SUBSTANCE_BY_HASH.get(hash & 0xffff)?.substanceIndex
    ?? element.terrainOrder
    ?? element.hash
}

function createElementPatterns(
  context: CanvasRenderingContext2D,
  textures: Record<string, HTMLImageElement>,
  cellSize: number,
  worldOriginX: number,
  worldBottomY: number,
): Map<string, CanvasPattern | null> {
  const patterns = new Map<string, CanvasPattern | null>()
  Object.entries(textures).forEach(([path, image]) => {
    const pattern = context.createPattern(image, 'repeat')
    if (pattern) {
      const element = ELEMENTS.find((candidate) => candidate.texture === path)
      const material = element ? ONI_SUBSTANCE_BY_HASH.get(element.hash) : undefined
      const worldUvScale = material?.worldUvScale ?? element?.worldUvScale ?? DEFAULT_ELEMENT_WORLD_UV_SCALE
      const scaleX = (cellSize * worldUvScale) / image.naturalWidth
      const scaleY = (cellSize * worldUvScale) / image.naturalHeight
      pattern.setTransform(new DOMMatrix([scaleX, 0, 0, scaleY, worldOriginX, worldBottomY - cellSize * worldUvScale]))
    }
    patterns.set(path, pattern)
  })
  return patterns
}

function drawGroundMaskQuad(
  input: OniTerrainRenderInput,
  patterns: Map<string, CanvasPattern | null>,
  maskPaths: TerrainMaskPaths | null,
  zoneColor: OniZoneColor | undefined,
  x: number,
  y: number,
  px: number,
  py: number,
): void {
  const { context, cellSize, cellAt, isTerrainMaskedAt } = input
  const sampleAt = (sampleX: number, sampleY: number): GroundMaskSample | undefined => {
    if (isTerrainMaskedAt(sampleX, sampleY)) return undefined
    const cell = cellAt(sampleX, sampleY)
    if (!cell) return undefined
    const element = elementForHash(cell.elementHash)
    if (element.state !== 'solid') return undefined
    return { element, order: terrainMaterialOrder(cell.elementHash) }
  }

  // GroundRenderer.WorldChunk.Rebuild corner order:
  // bottom-left, bottom-right, top-left, top-right.
  const samples = [
    sampleAt(x - 1, y - 1),
    sampleAt(x, y - 1),
    sampleAt(x - 1, y),
    sampleAt(x, y),
  ]
  const materials = Array.from(new Map(
    samples.filter((sample): sample is GroundMaskSample => Boolean(sample)).map((sample) => [sample.order, sample]),
  ).values()).sort((left, right) => left.order - right.order)

  for (const material of materials) {
    const mask = (samples[2] && samples[2].order >= material.order ? 8 : 0)
      | (samples[3] && samples[3].order >= material.order ? 4 : 0)
      | (samples[0] && samples[0].order >= material.order ? 2 : 0)
      | (samples[1] && samples[1].order >= material.order ? 1 : 0)
    if (mask === 0) continue
    const variant = maskPaths ? pickTerrainMaskVariant(maskPaths, mask, x, y) : undefined

    context.save()
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    if (mask !== 15 && variant) {
      context.translate(px, py)
      context.scale(cellSize, cellSize)
      context.clip(variant.path)
      context.setTransform(1, 0, 0, 1, 0, 0)
    }
    context.fillStyle = patterns.get(material.element.texture ?? '') ?? material.element.color
    context.fillRect(px, py, cellSize, cellSize)

    if (zoneColor) {
      context.globalCompositeOperation = 'color'
      context.globalAlpha = WORLD_ZONE_FOREGROUND_BLEND
      context.fillStyle = `rgb(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b})`
      context.fillRect(px, py, cellSize, cellSize)
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
    }

    if (mask !== 15 && variant) {
      context.globalCompositeOperation = 'multiply'
      context.drawImage(variant.image, px, py, cellSize, cellSize)
    }
    context.restore()
  }
}

/**
 * Stateless ONI world renderer. Both the interactive viewport and exported
 * panoramas call these same passes, so their terrain can no longer drift into
 * two separate approximations.
 */
export class OniWorldRenderer {
  private readonly substanceRenderer = new OniSubstanceWebGLRenderer()
  private readonly gasRenderer = new OniGasWebGLRenderer()
  private readonly liquidRenderer = new OniLiquidWebGLRenderer()
  renderBiome(input: OniBiomeRenderInput): void {
    const { context, worldZones, width, height, cellSize, originX, originY, range, backgrounds } = input
    const paths = new Map<number, Path2D>()
    const fallbackColors = new Map<number, OniZoneColor>()
    for (let canvasY = range.minRow; canvasY <= range.maxRow; canvasY++) {
      const y = height - 1 - canvasY
      for (let x = range.minX; x <= range.maxX; x++) {
        const zoneType = worldZones[y * width + x] ?? 7
        const textureIndex = zoneTextureIndex(zoneType)
        if (textureIndex === undefined) continue
        const path = paths.get(textureIndex) ?? new Path2D()
        path.rect(originX + x * cellSize, originY + canvasY * cellSize, cellSize + .25, cellSize + .25)
        paths.set(textureIndex, path)
        if (!fallbackColors.has(textureIndex)) {
          const color = ONI_WORLD_ZONE_COLORS[zoneType]
          if (color) fallbackColors.set(textureIndex, color)
        }
      }
    }

    context.save()
    context.globalAlpha = .84
    context.imageSmoothingEnabled = true
    for (const [textureIndex, path] of paths) {
      const image = backgrounds[textureIndex]
      if (image?.naturalWidth && image.naturalHeight) {
        const scale = (cellSize * BIOME_BACKGROUND_WORLD_CELLS) / image.naturalWidth
        const pattern = context.createPattern(image, 'repeat')
        if (pattern) {
          pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, originX, originY]))
          context.fillStyle = pattern
          context.fill(path)
          continue
        }
      }
      const fallback = fallbackColors.get(textureIndex) ?? { r: 36, g: 43, b: 48 }
      context.fillStyle = `rgb(${fallback.r}, ${fallback.g}, ${fallback.b})`
      context.fill(path)
    }
    context.restore()
  }

  renderTerrain(input: OniTerrainRenderInput): void {
    if (this.substanceRenderer.render(input)) return
    const { context, width, height, cellSize, originX, originY, range, textures, worldZones, maskSets } = input
    const patterns = createElementPatterns(context, textures, cellSize, originX, originY + height * cellSize)
    for (let canvasY = range.minRow; canvasY <= range.maxRow; canvasY++) {
      const y = height - 1 - canvasY
      for (let x = range.minX; x <= range.maxX; x++) {
        const zoneType = worldZones[y * width + x] ?? 3
        drawGroundMaskQuad(
          input,
          patterns,
          maskSets?.get(zoneType) ?? null,
          ONI_WORLD_ZONE_COLORS[zoneType],
          x,
          y,
          // GroundRenderer's terrain vertices are centred on integer cell
          // coordinates, so the one-cell quad spans half a cell on each side.
          originX + (x - .5) * cellSize,
          originY + (canvasY + .5) * cellSize,
        )
      }
    }
    // Match Substance.shader's 0.2 ambient material light in one compositing
    // pass. `source-atop` changes only terrain pixels and keeps empty cells
    // transparent. Doing this per cell made the fallback path unnecessarily
    // expensive on large maps.
    context.save()
    context.globalCompositeOperation = 'source-atop'
    context.fillStyle = 'rgb(51, 51, 51)'
    context.fillRect(0, 0, context.canvas.width, context.canvas.height)
    context.restore()
  }

  renderGas(input: OniTerrainRenderInput): boolean {
    return this.gasRenderer.render(input)
  }

  renderLiquid(input: OniTerrainRenderInput): boolean {
    return this.liquidRenderer.render(input)
  }

}

export const oniWorldRenderer = new OniWorldRenderer()
