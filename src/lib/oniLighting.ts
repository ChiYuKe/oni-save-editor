import type { SimCell } from './sim'
import { elementForHash } from './elements'

export type OniLightShape = 'circle' | 'cone' | 'quad'
export type OniLightDirection = 'north' | 'east' | 'south' | 'west'

export interface OniLightDefinition {
  range: number
  lux: number
  color: readonly [number, number, number]
  overlayColor: readonly [number, number, number]
  offset: readonly [number, number]
  shape: OniLightShape
  direction: OniLightDirection
  angle: number
  width: number
  falloffRate: number
  intensityAnimation: number
  requiresActive: boolean
}

type LightDefinitionPatch = Partial<OniLightDefinition> & Pick<OniLightDefinition, 'range' | 'lux' | 'color'>

const LIGHT_YELLOW = [0.57, 0.55, 0.44] as const
const LIGHT_ORANGE = [0.87, 0.55, 0.44] as const
const LIGHT_PINK = [0.9, 0.4, 0.6] as const
const LIGHT_PURPLE = [0.9, 0.4, 0.74] as const
const LIGHT_BLUE = [0.38, 0.61, 1] as const
const LIGHT_OVERLAY = [0.56, 0.56, 0.56] as const

function light(patch: LightDefinitionPatch): OniLightDefinition {
  return {
    range: patch.range,
    lux: patch.lux,
    color: patch.color,
    overlayColor: patch.overlayColor ?? LIGHT_OVERLAY,
    offset: patch.offset ?? [0, 0],
    shape: patch.shape ?? 'circle',
    direction: patch.direction ?? 'south',
    angle: patch.angle ?? 0,
    width: patch.width ?? 4,
    falloffRate: patch.falloffRate ?? 0.5,
    intensityAnimation: patch.intensityAnimation ?? 1,
    requiresActive: patch.requiresActive ?? false,
  }
}

// Values below are transcribed from TUNING/LIGHT2D.cs and each prefab's
// *Config.cs. Keys are SaveManager prefab tags, not localized display names.
const definitions: Record<string, OniLightDefinition> = {
  floorlamp: light({ range: 4, lux: 1000, color: LIGHT_YELLOW, offset: [0.05, 1.5], requiresActive: true }),
  ceilinglight: light({ range: 8, lux: 1800, color: LIGHT_YELLOW, offset: [0.05, 0.65], shape: 'cone', angle: 2.6, requiresActive: true }),
  glassceilinglight: light({ range: 8, lux: 5400, color: [0x5c / 255, 0xfd / 255, 0xf0 / 255], overlayColor: [0x1d / 255, 0xa6 / 255, 0x57 / 255], offset: [0.05, 0.65], shape: 'cone', angle: 2.6, requiresActive: true }),
  sunlamp: light({ range: 16, lux: 40000, color: LIGHT_YELLOW, offset: [0, 3.5], shape: 'cone', angle: 5.2, requiresActive: true }),
  mercuryceilinglight: light({ range: 8, lux: 60000, color: LIGHT_PINK, offset: [0.05, 0.65], shape: 'quad', angle: 2.6, width: 3, falloffRate: 0.4, requiresActive: true }),
  headquarters: light({ range: 5, lux: 1000, color: LIGHT_YELLOW, offset: [0.5, 3] }),
  exobaseheadquarters: light({ range: 5, lux: 1000, color: LIGHT_YELLOW, offset: [0, 2.5] }),
  megabraintank: light({ range: 7, lux: 7200, color: LIGHT_YELLOW }),
  poicerestechunlock: light({ range: 5, lux: 1800, color: LIGHT_YELLOW, offset: [0, 3.4], shape: 'cone', angle: 2.6 }),
  poidlc4techunlock: light({ range: 5, lux: 1800, color: LIGHT_YELLOW, offset: [0, 3.4], shape: 'cone', angle: 2.6 }),
  poidlc5techunlock: light({ range: 5, lux: 1800, color: LIGHT_YELLOW, offset: [0, 3.4], shape: 'cone', angle: 2.6 }),
  bulbloom: light({ range: 2, lux: 500, color: [0.4, 0.5, 1], offset: [0.05, 0.5] }),
  campfire: light({ range: 6, lux: 450, color: [0.8, 0.6, 0], requiresActive: true }),
  pinkrock: light({ range: 2, lux: 1000, color: LIGHT_PINK, offset: [0.05, 0.33] }),
  pinkrockcarved: light({ range: 3, lux: 1000, color: LIGHT_PINK, offset: [0.05, 0.33] }),
  parrotfish: light({ range: 5, lux: 5000, color: LIGHT_ORANGE, offset: [0.2, 0.5], intensityAnimation: 0.2 }),
  parrotfishbaby: light({ range: 5, lux: 5000, color: LIGHT_ORANGE, offset: [0.2, 0.5], intensityAnimation: 0.2 }),
  fossildig: light({ range: 3, lux: 1000, color: [1, 1, 0], overlayColor: LIGHT_YELLOW, offset: [-0.15, 2.35], requiresActive: true }),
  artifact_bioluminescentrock: light({ range: 2, lux: 666, color: LIGHT_BLUE, offset: [0.05, 0.33], shape: 'cone' }),
  artifact_magmalamp: light({ range: 2, lux: 666, color: LIGHT_YELLOW, offset: [0.05, 0.33], shape: 'cone' }),
  artifact_plasmalamp: light({ range: 2, lux: 666, color: LIGHT_PURPLE, offset: [0.05, 0.5] }),
}

const lightBugColors: Record<string, readonly [number, number, number] | undefined> = {
  '': LIGHT_YELLOW,
  blue: [0.4392157, 0.4862745, 0.5686275],
  crystal: [0.5137255, 0.6666667, 0.6666667],
  orange: [0.5686275, 0.48235294, 0.4392157],
  pink: [0.5686275, 0.4392157, 0.5686275],
  purple: [0.49019608, 0.4392157, 0.5686275],
  // BaseLightBugConfig deliberately omits Light2D when this variant is black.
  black: undefined,
}
for (const [variant, color] of Object.entries(lightBugColors)) {
  if (!color) continue
  for (const baby of ['', 'baby']) {
    definitions[`lightbug${variant}${baby}`] = light({ range: 5, lux: 1800, color, offset: [0.05, 0.25] })
  }
}

export const ONI_LIGHT_DEFINITIONS: Readonly<Record<string, OniLightDefinition>> = definitions

export function oniLightDefinitionForTag(tag: string): OniLightDefinition | undefined {
  return definitions[tag.trim().toLowerCase()]
}

export interface OniLightInstance {
  x: number
  y: number
  definition: OniLightDefinition
}

interface LightGrid {
  width: number
  height: number
  cellAt(x: number, y: number): SimCell | undefined
}

function valid(grid: LightGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height
}

// Sim.Cell.Properties: SolidImpermeable=4 and Transparent=16. This is the
// exact predicate used by DiscreteShadowCaster.DoesOcclude when its
// canSeeThroughTransparent argument is true.
function occludes(grid: LightGrid, x: number, y: number): boolean {
  if (!valid(grid, x, y)) return false
  const cell = grid.cellAt(x, y)
  if (!cell) return false
  if (cell.properties !== undefined) return (cell.properties & 4) !== 0 && (cell.properties & 16) === 0
  // The disk format stores no runtime property flags. Do not interpret hash
  // bytes as flags; use the saved element for the available static geometry.
  return elementForHash(cell.elementHash).state === 'solid'
}

type Octant = 'N_NW' | 'N_NE' | 'E_NE' | 'E_SE' | 'S_SE' | 'S_SW' | 'W_SW' | 'W_NW'
const ALL_OCTANTS: readonly Octant[] = ['N_NW', 'N_NE', 'E_NE', 'E_SE', 'S_SE', 'S_SW', 'W_SW', 'W_NW']

function roundToEven(value: number): number {
  const floor = Math.floor(value)
  const fraction = value - floor
  if (fraction < 0.5) return floor
  if (fraction > 0.5) return floor + 1
  return floor % 2 === 0 ? floor : floor + 1
}

function slope(x1: number, y1: number, x2: number, y2: number, invert: boolean): number {
  return invert ? (y1 - y2) / (x1 - x2) : (x1 - x2) / (y1 - y2)
}

function visibilityDistance(x1: number, y1: number, x2: number, y2: number): number {
  return (x1 - x2) ** 2 + (y1 - y2) ** 2
}

function addVisible(grid: LightGrid, visible: Set<number>, x: number, y: number): void {
  if (valid(grid, x, y)) visible.add(y * grid.width + x)
}

// Direct TypeScript port of DiscreteShadowCaster.ScanOctant. Its asymmetric
// neighbour checks and even .5 rounding are intentionally retained.
function scanOctant(grid: LightGrid, originX: number, originY: number, range: number, depth: number, octant: Octant, initialStartSlope: number, endSlope: number, visible: Set<number>): void {
  const rangeSquared = range * range
  let startSlope = initialStartSlope
  let x = 0
  let y = 0
  switch (octant) {
    case 'N_NW': {
      y = originY + depth
      if (y >= grid.height) return
      x = Math.max(0, originX - roundToEven(startSlope * depth))
      while (slope(x, y, originX, originY, false) <= endSlope) {
        if (visibilityDistance(x, y, originX, originY) <= rangeSquared) {
          if (occludes(grid, x, y)) {
            if (x - 1 >= 0 && !occludes(grid, x - 1, y) && !occludes(grid, x - 1, y - 1)) scanOctant(grid, originX, originY, range, depth + 1, octant, startSlope, slope(x - 0.5, y - 0.5, originX, originY, false), visible)
          } else {
            if (x - 1 >= 0 && occludes(grid, x - 1, y)) startSlope = -slope(x - 0.5, y + 0.5, originX, originY, false)
            if (!occludes(grid, x, y - 1)) addVisible(grid, visible, x, y)
          }
        }
        x++
      }
      x--
      break
    }
    case 'N_NE': {
      y = originY + depth
      if (y >= grid.height) return
      x = Math.min(grid.width - 1, originX + roundToEven(startSlope * depth))
      while (slope(x, y, originX, originY, false) >= endSlope) {
        if (visibilityDistance(x, y, originX, originY) <= rangeSquared) {
          if (occludes(grid, x, y)) {
            // The original compares against HeightInCells here; preserve it.
            if (x + 1 < grid.height && !occludes(grid, x + 1, y) && !occludes(grid, x + 1, y - 1)) scanOctant(grid, originX, originY, range, depth + 1, octant, startSlope, slope(x + 0.5, y - 0.5, originX, originY, false), visible)
          } else {
            if (x + 1 < grid.height && occludes(grid, x + 1, y)) startSlope = slope(x + 0.5, y + 0.5, originX, originY, false)
            if (!occludes(grid, x, y - 1)) addVisible(grid, visible, x, y)
          }
        }
        x--
      }
      x++
      break
    }
    case 'E_NE': {
      x = originX + depth
      if (x >= grid.width) return
      y = Math.min(grid.height - 1, originY + roundToEven(startSlope * depth))
      while (slope(x, y, originX, originY, true) >= endSlope) {
        if (visibilityDistance(x, y, originX, originY) <= rangeSquared) {
          if (occludes(grid, x, y)) {
            if (y + 1 < grid.height && !occludes(grid, x, y + 1) && !occludes(grid, x - 1, y + 1)) scanOctant(grid, originX, originY, range, depth + 1, octant, startSlope, slope(x - 0.5, y + 0.5, originX, originY, true), visible)
          } else {
            if (y + 1 < grid.height && occludes(grid, x, y + 1)) startSlope = slope(x + 0.5, y + 0.5, originX, originY, true)
            if (!occludes(grid, x - 1, y)) addVisible(grid, visible, x, y)
          }
        }
        y--
      }
      y++
      break
    }
    case 'E_SE': {
      x = originX + depth
      if (x >= grid.width) return
      y = Math.max(0, originY - roundToEven(startSlope * depth))
      while (slope(x, y, originX, originY, true) <= endSlope) {
        if (visibilityDistance(x, y, originX, originY) <= rangeSquared) {
          if (occludes(grid, x, y)) {
            if (y - 1 >= 0 && !occludes(grid, x, y - 1) && !occludes(grid, x - 1, y - 1)) scanOctant(grid, originX, originY, range, depth + 1, octant, startSlope, slope(x - 0.5, y - 0.5, originX, originY, true), visible)
          } else {
            if (y - 1 >= 0 && occludes(grid, x, y - 1)) startSlope = -slope(x + 0.5, y - 0.5, originX, originY, true)
            if (!occludes(grid, x - 1, y)) addVisible(grid, visible, x, y)
          }
        }
        y++
      }
      y--
      break
    }
    case 'S_SE': {
      y = originY - depth
      if (y < 0) return
      x = Math.min(grid.width - 1, originX + roundToEven(startSlope * depth))
      while (slope(x, y, originX, originY, false) <= endSlope) {
        if (visibilityDistance(x, y, originX, originY) <= rangeSquared) {
          if (occludes(grid, x, y)) {
            if (x + 1 < grid.width && !occludes(grid, x + 1, y) && !occludes(grid, x + 1, y + 1)) scanOctant(grid, originX, originY, range, depth + 1, octant, startSlope, slope(x + 0.5, y + 0.5, originX, originY, false), visible)
          } else {
            if (x + 1 < grid.width && occludes(grid, x + 1, y)) startSlope = -slope(x + 0.5, y - 0.5, originX, originY, false)
            if (!occludes(grid, x, y + 1)) addVisible(grid, visible, x, y)
          }
        }
        x--
      }
      x++
      break
    }
    case 'S_SW': {
      y = originY - depth
      if (y < 0) return
      x = Math.max(0, originX - roundToEven(startSlope * depth))
      while (slope(x, y, originX, originY, false) >= endSlope) {
        if (visibilityDistance(x, y, originX, originY) <= rangeSquared) {
          if (occludes(grid, x, y)) {
            if (x - 1 >= 0 && !occludes(grid, x - 1, y) && !occludes(grid, x - 1, y + 1)) scanOctant(grid, originX, originY, range, depth + 1, octant, startSlope, slope(x - 0.5, y + 0.5, originX, originY, false), visible)
          } else {
            if (x - 1 >= 0 && occludes(grid, x - 1, y)) startSlope = slope(x - 0.5, y - 0.5, originX, originY, false)
            if (!occludes(grid, x, y + 1)) addVisible(grid, visible, x, y)
          }
        }
        x++
      }
      x--
      break
    }
    case 'W_SW': {
      x = originX - depth
      if (x < 0) return
      y = Math.max(0, originY - roundToEven(startSlope * depth))
      while (slope(x, y, originX, originY, true) >= endSlope) {
        if (visibilityDistance(x, y, originX, originY) <= rangeSquared) {
          if (occludes(grid, x, y)) {
            if (y - 1 >= 0 && !occludes(grid, x, y - 1) && !occludes(grid, x + 1, y - 1)) scanOctant(grid, originX, originY, range, depth + 1, octant, startSlope, slope(x + 0.5, y - 0.5, originX, originY, true), visible)
          } else {
            if (y - 1 >= 0 && occludes(grid, x, y - 1)) startSlope = slope(x - 0.5, y - 0.5, originX, originY, true)
            if (!occludes(grid, x + 1, y)) addVisible(grid, visible, x, y)
          }
        }
        y++
      }
      y--
      break
    }
    case 'W_NW': {
      x = originX - depth
      if (x < 0) return
      y = Math.min(grid.height - 1, originY + roundToEven(startSlope * depth))
      while (slope(x, y, originX, originY, true) <= endSlope) {
        if (visibilityDistance(x, y, originX, originY) <= rangeSquared) {
          if (occludes(grid, x, y)) {
            if (y + 1 < grid.height && !occludes(grid, x, y + 1) && !occludes(grid, x + 1, y + 1)) scanOctant(grid, originX, originY, range, depth + 1, octant, startSlope, slope(x + 0.5, y + 0.5, originX, originY, true), visible)
          } else {
            if (y + 1 < grid.height && occludes(grid, x, y + 1)) startSlope = -slope(x - 0.5, y + 0.5, originX, originY, true)
            if (!occludes(grid, x + 1, y)) addVisible(grid, visible, x, y)
          }
        }
        y--
      }
      y++
      break
    }
  }
  x = Math.max(0, Math.min(grid.width - 1, x))
  y = Math.max(0, Math.min(grid.height - 1, y))
  if (depth < range && !occludes(grid, x, y)) scanOctant(grid, originX, originY, range, depth + 1, octant, startSlope, endSlope, visible)
}

function directionVector(direction: OniLightDirection): readonly [number, number] {
  if (direction === 'north') return [0, 1]
  if (direction === 'east') return [1, 0]
  if (direction === 'west') return [-1, 0]
  return [0, -1]
}

export function visibleLightCells(grid: LightGrid, originX: number, originY: number, definition: OniLightDefinition): Set<number> {
  const visible = new Set<number>()
  if (!valid(grid, originX, originY)) return visible
  visible.add(originY * grid.width + originX)
  const range = Math.trunc(definition.range)
  if (definition.shape === 'quad') {
    const [travelX, travelY] = directionVector(definition.direction)
    const orthogonalX = travelY === 0 ? 0 : 1
    const orthogonalY = travelX === 0 ? 0 : 1
    const first = definition.width % 2 === 0 ? definition.width / 2 - 1 : Math.floor((definition.width - 1) / 2)
    for (let lane = 0; lane < definition.width; lane++) {
      const laneX = originX - orthogonalX * first + orthogonalX * lane
      const laneY = originY - orthogonalY * first + orthogonalY * lane
      if (occludes(grid, laneX, laneY)) continue
      for (let depth = 0; depth < range; depth++) {
        const x = laneX + travelX * depth
        const y = laneY + travelY * depth
        if (!valid(grid, x, y) || occludes(grid, x, y)) break
        visible.add(y * grid.width + x)
      }
    }
    return visible
  }
  // DiscreteShadowCaster uses all octants for Circle and only the two southern
  // octants for Cone. Direction is visual-only for the cone prefabs in source.
  const octants: readonly Octant[] = definition.shape === 'cone' ? ['S_SE', 'S_SW'] : ALL_OCTANTS
  octants.forEach((octant) => scanOctant(grid, originX, originY, range, 1, octant, 1, 0, visible))
  return visible
}

function color255(color: readonly [number, number, number], alpha: number): string {
  return `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${alpha})`
}

export interface OniLightBufferRenderOptions extends LightGrid {
  context: CanvasRenderingContext2D
  lights: readonly OniLightInstance[]
  worldHeight: number
  cellSize: number
  originX: number
  originY: number
  visibilityCache?: WeakMap<OniLightInstance, Set<number>>
}

export function drawOniLightBuffer(options: OniLightBufferRenderOptions): number {
  const { context: target, lights, worldHeight, cellSize, originX, originY } = options
  // Feather the cell visibility buffer before composition. Filtering
  // only this additive layer preserves sharp terrain and sprite artwork.
  const buffer = document.createElement('canvas')
  buffer.width = target.canvas.width; buffer.height = target.canvas.height
  const context = buffer.getContext('2d')!
  let rendered = 0
  context.save()
  context.globalCompositeOperation = 'lighter'
  for (const instance of lights) {
    const definition = instance.definition
    const lightX = instance.x + definition.offset[0]
    const lightY = instance.y + definition.offset[1]
    const cellX = Math.floor(lightX)
    const cellY = Math.floor(lightY)
    const visible = options.visibilityCache?.get(instance) ?? visibleLightCells(options, cellX, cellY, definition)
    options.visibilityCache?.set(instance, visible)
    if (visible.size === 0) continue
    const centerX = originX + lightX * cellSize
    const centerY = originY + (worldHeight - lightY) * cellSize
    const radius = Math.max(cellSize, definition.range * cellSize)
    context.save()
    context.beginPath()
    for (const index of visible) {
      const x = index % options.width
      const y = Math.floor(index / options.width)
      context.rect(originX + x * cellSize, originY + (worldHeight - 1 - y) * cellSize, cellSize + 0.5, cellSize + 0.5)
    }
    context.clip()
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
    // LightBuffer sends Color.rgb * IntensityAnimation and Range to the shader;
    // the alpha below only scales the browser's additive target into its 0..1
    // colour space while preserving source RGB, range and radial falloff.
    const strength = Math.min(0.72, (0.18 + Math.log10(Math.max(1, definition.lux)) * 0.075) * definition.intensityAnimation)
    gradient.addColorStop(0, color255(definition.color, strength))
    gradient.addColorStop(Math.min(0.94, 1 / Math.max(1, definition.range)), color255(definition.color, strength * 0.92))
    gradient.addColorStop(1, color255(definition.color, 0))
    context.fillStyle = gradient
    context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)
    context.restore()
    rendered++
  }
  context.restore()
  if (rendered) {
    target.save()
    target.globalCompositeOperation = 'lighter'
    target.filter = `blur(${Math.max(.6, cellSize * .26)}px)`
    target.drawImage(buffer, 0, 0)
    target.restore()
  }
  return rendered
}
