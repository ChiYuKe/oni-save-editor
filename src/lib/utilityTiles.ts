import type { SavedObjectInstance, Value } from './model'

export type UtilityFamily = 'electrical' | 'gas' | 'liquid' | 'solid' | 'logic'

/**
 * A utility tile as seen by UtilityNetworkManager. Different visual materials
 * still share one family/network (for example insulated and radiant conduits).
 */
export type UtilityCellRecord = {
  tag: string
  bits: number | undefined
  /** Connections contributed by the physical utility object in this cell. */
  physicalBits?: number
  isPhysical: boolean
}

export type UtilityCellMap = Map<UtilityFamily, Map<string, UtilityCellRecord>>

type UtilityTileFrame = readonly [
  sourceX: number,
  sourceTop: number,
  sourceWidth: number,
  sourceHeight: number,
  boundsWidth: number,
  boundsHeight: number,
  boundsCenterX: number,
  boundsCenterY: number,
]

type UtilityTileTransform = readonly [
  m00: number,
  m10: number,
  m01: number,
  m11: number,
  translateX: number,
  translateY: number,
]

export type UtilityTileDefinition = {
  path: string
  family: UtilityFamily
  frames: readonly (UtilityTileFrame | undefined)[]
  frameByConnections: readonly number[]
  transformByConnections: readonly UtilityTileTransform[]
}

const utilityFrameCanvases = new WeakMap<HTMLImageElement, Map<number, HTMLCanvasElement>>()

const ELECTRIC_CONNECTION_FRAMES = [5, 6, 6, 3, 6, 2, 2, 1, 6, 2, 2, 1, 3, 1, 1, 0]
const CONDUIT_CONNECTION_FRAMES = [6, 4, 4, 2, 4, 9, 7, 8, 4, 3, 9, 1, 2, 1, 8, 0]
const LIQUID_CONNECTION_FRAMES = [5, 3, 10, 2, 10, 8, 9, 7, 3, 1, 8, 0, 2, 0, 7, 4]

// A KAnim animation frame does more than select a build frame: it rotates or
// mirrors that frame for the requested LRUD connection. KAnim coordinates use
// the same Y-down orientation as canvas. Its roughly -100-unit Y translation
// moves artwork from the CellToPosCBC bottom anchor to the cell centre.
function utilityTransform(
  m00: number,
  m10: number,
  m01: number,
  m11: number,
  translateX = 0,
  translateY = -100.75,
): UtilityTileTransform {
  return [m00, m10, m01, m11, translateX, translateY]
}

// Indexed by the UtilityConnections bit mask: left, right, up, down.
const ELECTRIC_CONNECTION_TRANSFORMS = [
  utilityTransform(1, 0, 0, 1, 1.25, -100.3),
  utilityTransform(1, 0, 0, 1),
  utilityTransform(-1, 0, 0, 1, .3, -99.1),
  utilityTransform(1, 0, 0, 1),
  utilityTransform(0, 1, -1, 0, .8, -100.5),
  utilityTransform(0, 1, -1, 0, .8, -100.25),
  utilityTransform(-1, 0, 0, -1, 0, -99.2),
  utilityTransform(1, 0, 0, -1, -.1, -99.15),
  utilityTransform(0, -1, -1, 0, -.8, -99.55),
  utilityTransform(1, 0, 0, 1),
  utilityTransform(0, -1, 1, 0, -.75, -99.85),
  utilityTransform(1, 0, 0, 1),
  utilityTransform(0, -1, -1, 0, .2, -99.95),
  utilityTransform(0, -1, -1, 0, .8, -99.95),
  utilityTransform(0, -1, 1, 0, -.9, -99.9),
  utilityTransform(1, 0, 0, 1),
]

const GAS_CONNECTION_TRANSFORMS = [
  utilityTransform(1, 0, 0, 1, 2.15, -103.6),
  utilityTransform(1, 0, 0, 1, 1.35, -102.2),
  utilityTransform(-1, 0, 0, 1, .75, -102.2),
  utilityTransform(1, 0, 0, 1, -.45, -100.4),
  utilityTransform(0, 1, -1, 0, 3.15, -100),
  utilityTransform(0, 1, -1, 0, .75, -102.2),
  utilityTransform(0, 1, 1, 0, -1.65, -102.2),
  utilityTransform(1, 0, 0, -1, .35, -99.2),
  utilityTransform(0, -1, -1, 0, .75, -99.2),
  utilityTransform(1, 0, 0, 1, .15, -101.7),
  utilityTransform(-1, 0, 0, 1, -1.05, -98.65),
  utilityTransform(1, 0, 0, 1, -.55, -102),
  utilityTransform(0, 1, -1, 0, 2.15, -99.9),
  utilityTransform(0, -1, -1, 0, .35, -100.2),
  utilityTransform(0, -1.005, 1, 0, .35, -100.3),
  utilityTransform(1, 0, 0, 1, -.55, -102),
]

const LIQUID_CONNECTION_TRANSFORMS = [
  utilityTransform(1, 0, 0, 1),
  utilityTransform(1, 0, 0, 1),
  utilityTransform(-1, 0, 0, 1, 0, -99.75),
  utilityTransform(1, 0, 0, 1),
  utilityTransform(0, 1, -1, 0),
  utilityTransform(0, 1, -1, 0),
  utilityTransform(-1, 0, 0, -1),
  utilityTransform(1, 0, 0, -1),
  utilityTransform(0, -1, -1, 0),
  utilityTransform(1, 0, 0, 1),
  utilityTransform(-1, 0, 0, 1, -.05, -100.7),
  utilityTransform(1, 0, 0, 1),
  utilityTransform(0, -1, -1, 0),
  utilityTransform(0, -1, -1, 0),
  utilityTransform(0, -1, 1, 0),
  utilityTransform(1, 0, 0, 1, .6, -99.65),
]

const CONVEYOR_CONNECTION_TRANSFORMS = [
  utilityTransform(1, 0, 0, 1, .55, -105.2),
  utilityTransform(1, 0, 0, 1, .15, -105.3),
  utilityTransform(-1, 0, 0, 1, .35, -105.4),
  utilityTransform(1, 0, 0, 1, .35, -104.15),
  utilityTransform(0, 1, -1, 0, 1.6, -101.6),
  utilityTransform(0, 1, -1, 0, 1.85, -105),
  utilityTransform(0, 1, 1, 0, 1.15, -105.8),
  utilityTransform(1, 0, 0, -1, -.2, -104.1),
  utilityTransform(0, -1, -1, 0, 1.65, -98.8),
  utilityTransform(1, 0, 0, 1, 2.05, -105.45),
  utilityTransform(-1, 0, 0, 1, 2.1, -105.05),
  utilityTransform(1, 0, 0, 1, .25, -105.2),
  utilityTransform(0, 1, -1, 0, .95, -100.55),
  utilityTransform(0, -1, -1, 0, 2, -103),
  utilityTransform(0, -1.005, 1, 0, -.65, -100.1),
  utilityTransform(1, 0, 0, 1, .25, -105.2),
]

// These rectangles and bounds are read from the game's KAnim build.bytes.
// The connection order is the same LRUD animation order used by KAnimGraphTileVisualizer.
const ELECTRIC_FRAMES: UtilityTileFrame[] = [
  [112, 107, 112, 112, 223, 223, .35, .8], [0, 107, 112, 74, 224, 148, .9, 39.139],
  [348, 0, 75, 80, 150, 159, -35.928, 33.432], [335, 138, 112, 31, 223, 62, .35, -1.158],
  [120, 0, 78, 53, 155, 105, -33.7, 2.445], [447, 79, 45, 53, 90, 105, -1.25, 2.9],
  [197, 0, 76, 38, 151, 75, -35.6, 3.675],
]
const ELECTRIC_CONDUCT_FRAMES: UtilityTileFrame[] = [
  [132, 223, 111, 111, 222, 222, -.025, 1.2], [132, 0, 112, 80, 224, 160, .5, 33.775],
  [331, 334, 80, 82, 159, 163, -31.95, 30.175], [132, 154, 112, 35, 224, 69, -.25, 1.05],
  [419, 80, 78, 53, 155, 105, -33.7, 2.445], [464, 223, 45, 53, 90, 105, -1.25, 2.9],
  [244, 185, 77, 38, 153, 75, -36.575, 3.675],
]
const ELECTRIC_INSULATED_FRAMES: UtilityTileFrame[] = [
  [0, 0, 111, 111, 222, 222, .2, 1.375], [111, 0, 111, 81, 222, 161, .45, 32.475],
  [222, 81, 79, 81, 158, 161, -32.85, 32.463], [111, 81, 111, 49, 222, 97, .45, .825],
  [111, 178, 78, 52, 155, 103, -32.85, 2.275], [452, 111, 52, 52, 103, 103, -.475, 2.275],
  [301, 111, 76, 49, 152, 97, -34.65, .8],
]
const ELECTRIC_RUBBER_FRAMES: UtilityTileFrame[] = [
  [245, 0, 111, 111, 222, 222, -.4, 1.2], [133, 0, 112, 80, 223, 160, .425, 30.975],
  [355, 120, 82, 86, 163, 171, -28.025, 28.85], [133, 420, 111, 38, 221, 76, -.375, 2.6],
  [332, 383, 82, 39, 164, 77, -28.7, 4.125], [462, 458, 39, 53, 77, 105, 2.5, .85],
  [436, 120, 76, 41, 152, 82, -35.85, 4.35],
]
const ELECTRIC_HIWATT_FRAMES: UtilityTileFrame[] = [
  [114, 35, 111, 111, 222, 222, .2, 1.375], [114, 347, 111, 81, 222, 161, .45, 32.475],
  [225, 173, 79, 81, 158, 161, -32.85, 32.463], [0, 168, 111, 49, 222, 97, .45, .825],
  [226, 253, 78, 52, 155, 103, -32.85, 2.275], [304, 253, 52, 52, 103, 103, -.475, 2.275],
  [338, 123, 76, 49, 152, 97, -34.65, .8],
]
const LOGIC_FRAMES: UtilityTileFrame[] = [
  [0, 121, 110, 109, 219, 218, -.025, 1.175], [139, 0, 110, 66, 219, 132, -.025, 44.4],
  [358, 0, 65, 66, 130, 132, -44.4, 44.4], [0, 230, 110, 23, 219, 46, -.025, 1.225],
  [421, 66, 77, 50, 153, 99, -33.05, 2.1], [358, 110, 45, 50, 89, 99, -1.35, 2.1],
  [249, 66, 86, 44, 172, 87, -23.375, -.85],
]
// KAnim source frame 5 is intentionally absent from this atlas. Keep the
// source frame number as the array index; connection maps refer to it directly.
const GAS_FRAMES: Array<UtilityTileFrame | undefined> = [
  [228, 0, 112, 113, 224, 225, .9, 2.4], [0, 214, 113, 94, 226, 187, .925, 29.5],
  [0, 93, 114, 61, 227, 121, .225, 2.2], [202, 302, 88, 88, 176, 175, -23.75, 27.75],
  [203, 390, 76, 62, 152, 124, -36.938, 3.2], undefined,
  [292, 214, 65, 66, 129, 132, .35, 2.237], [113, 214, 90, 89, 179, 177, -23.475, 26.5],
  [0, 0, 114, 93, 228, 185, .375, 28.5], [113, 302, 89, 88, 178, 176, -23, 25.713],
]
const LIQUID_FRAMES: Array<UtilityTileFrame | undefined> = [
  [0, 112, 113, 95, 226, 189, -.688, 20.075], [113, 200, 78, 78, 156, 155, -34.222, 35.1],
  [0, 394, 113, 42, 225, 83, -.375, 1.162], [113, 112, 80, 44, 159, 88, -34.45, 1.351],
  [0, 0, 113, 112, 226, 224, -.325, -.25], [211, 278, 51, 48, 102, 95, -2.25, .85],
  undefined, [0, 301, 113, 93, 226, 186, -.688, 18.75], [191, 200, 78, 78, 156, 155, -34.222, 35.1],
  [113, 278, 78, 78, 156, 155, -34.222, 35.1], [113, 156, 80, 44, 159, 88, -34.45, 1.351],
]
const CONVEYOR_FRAMES: Array<UtilityTileFrame | undefined> = [
  [131, 0, 115, 114, 229, 228, 4.05, 6.525], [131, 114, 111, 84, 222, 167, -2.325, 31.75],
  [242, 195, 110, 55, 220, 109, -.1, -1.244], [242, 304, 81, 84, 162, 167, -32.525, 31.9],
  [403, 388, 75, 60, 150, 120, -36.5, -7.863], undefined, [323, 470, 41, 42, 82, 83, .25, -.15],
  [323, 388, 78, 82, 155, 164, -26.775, 29.075], [242, 114, 110, 81, 220, 162, -.1, 29.375],
  [323, 304, 80, 84, 160, 167, -30.425, 31.75],
]

function utilityDefinition(
  path: string,
  family: UtilityFamily,
  frames: readonly (UtilityTileFrame | undefined)[],
  frameByConnections: readonly number[],
  transformByConnections: readonly UtilityTileTransform[],
): UtilityTileDefinition {
  return { path: `/assets/buildings/utilities/${path}_0.png`, family, frames, frameByConnections, transformByConnections }
}

export const UTILITY_DEFINITIONS = {
  electric: utilityDefinition('utilities_electric_kanim', 'electrical', ELECTRIC_FRAMES, ELECTRIC_CONNECTION_FRAMES, ELECTRIC_CONNECTION_TRANSFORMS),
  electricConduct: utilityDefinition('utilities_electric_conduct_kanim', 'electrical', ELECTRIC_CONDUCT_FRAMES, ELECTRIC_CONNECTION_FRAMES, ELECTRIC_CONNECTION_TRANSFORMS),
  electricInsulated: utilityDefinition('utilities_electric_insulated_kanim', 'electrical', ELECTRIC_INSULATED_FRAMES, ELECTRIC_CONNECTION_FRAMES, ELECTRIC_CONNECTION_TRANSFORMS),
  electricRubber: utilityDefinition('utilities_electric_rubber_kanim', 'electrical', ELECTRIC_RUBBER_FRAMES, ELECTRIC_CONNECTION_FRAMES, ELECTRIC_CONNECTION_TRANSFORMS),
  electricHiwatt: utilityDefinition('utilities_electric_conduct_hiwatt_kanim', 'electrical', ELECTRIC_HIWATT_FRAMES, ELECTRIC_CONNECTION_FRAMES, ELECTRIC_CONNECTION_TRANSFORMS),
  logic: utilityDefinition('logic_wires_kanim', 'logic', LOGIC_FRAMES, ELECTRIC_CONNECTION_FRAMES, ELECTRIC_CONNECTION_TRANSFORMS),
  gas: utilityDefinition('utilities_gas_kanim', 'gas', GAS_FRAMES, CONDUIT_CONNECTION_FRAMES, GAS_CONNECTION_TRANSFORMS),
  gasInsulated: utilityDefinition('utilities_gas_insulated_kanim', 'gas', GAS_FRAMES, CONDUIT_CONNECTION_FRAMES, GAS_CONNECTION_TRANSFORMS),
  gasRadiant: utilityDefinition('utilities_gas_radiant_kanim', 'gas', GAS_FRAMES, CONDUIT_CONNECTION_FRAMES, GAS_CONNECTION_TRANSFORMS),
  liquid: utilityDefinition('utilities_liquid_kanim', 'liquid', LIQUID_FRAMES, LIQUID_CONNECTION_FRAMES, LIQUID_CONNECTION_TRANSFORMS),
  liquidInsulated: utilityDefinition('utilities_liquid_insulated_kanim', 'liquid', LIQUID_FRAMES, LIQUID_CONNECTION_FRAMES, LIQUID_CONNECTION_TRANSFORMS),
  liquidRadiant: utilityDefinition('utilities_liquid_radiant_kanim', 'liquid', LIQUID_FRAMES, LIQUID_CONNECTION_FRAMES, LIQUID_CONNECTION_TRANSFORMS),
  conveyor: utilityDefinition('utilities_conveyor_kanim', 'solid', CONVEYOR_FRAMES, CONDUIT_CONNECTION_FRAMES, CONVEYOR_CONNECTION_TRANSFORMS),
} as const

const UTILITY_TAGS: Record<string, keyof typeof UTILITY_DEFINITIONS> = {
  wire: 'electric',
  wirerefined: 'electricConduct',
  wirehighwattage: 'electricInsulated',
  wirerefinedhighwattage: 'electricHiwatt',
  wirerubber: 'electricRubber',
  logicwire: 'logic',
  gasconduit: 'gas',
  insulatedgasconduit: 'gasInsulated',
  gasconduitradiant: 'gasRadiant',
  liquidconduit: 'liquid',
  insulatedliquidconduit: 'liquidInsulated',
  liquidconduitradiant: 'liquidRadiant',
  solidconduit: 'conveyor',
}

export function utilityTextureForTag(tag: string): UtilityTileDefinition | undefined {
  const key = tag.trim().toLowerCase()
  const definition = UTILITY_TAGS[key]
  return definition ? UTILITY_DEFINITIONS[definition] : undefined
}

export function utilityFamilyForTag(tag: string): UtilityFamily | undefined {
  return utilityTextureForTag(tag)?.family
}

function numericValue(value: Value): number | undefined {
  if (value.kind === 'sbyte' || value.kind === 'byte' || value.kind === 'int16' || value.kind === 'uint16'
    || value.kind === 'int32' || value.kind === 'uint32' || value.kind === 'enum') return value.v
  return undefined
}

export function utilityConnectionBits(instance: SavedObjectInstance): number | undefined {
  const visualizer = instance.components.find((component) => component.typeName.split(/[.+]/).pop() === 'KAnimGraphTileVisualizer')
  const value = visualizer?.value
  if (!value || value.kind !== 'object') return undefined
  const connection = value.members.find((item) => item.name === '_connections')?.value
  const numeric = connection ? numericValue(connection) : undefined
  return numeric === undefined ? undefined : numeric & 0xf
}

const UTILITY_DIRECTIONS = [
  { dx: -1, dy: 0, bit: 1, oppositeBit: 2 },
  { dx: 1, dy: 0, bit: 2, oppositeBit: 1 },
  { dx: 0, dy: 1, bit: 4, oppositeBit: 8 },
  { dx: 0, dy: -1, bit: 8, oppositeBit: 4 },
] as const

function utilityCellKey(x: number, y: number): string {
  return `${x}:${y}`
}

/**
 * Reproduce the useful part of UtilityNetworkManager.Reconnect for a fallback
 * map. A neighbour is a connection only when its opposite port is also set.
 * This matters because physical utility nodes may occupy adjacent cells while
 * intentionally remaining disconnected. Saved _connections remain authoritative
 * whenever they are available, just as KAnimGraphTileVisualizer.Refresh uses
 * the manager's calculated value in game.
 */
export function utilityNeighbourConnections(
  cells: UtilityCellMap,
  family: UtilityFamily,
  x: number,
  y: number,
): number {
  const familyCells = cells.get(family)
  if (!familyCells) return 0
  const current = familyCells.get(utilityCellKey(x, y))
  let connections = 0
  for (const direction of UTILITY_DIRECTIONS) {
    const neighbour = familyCells.get(utilityCellKey(x + direction.dx, y + direction.dy))
    if (!neighbour) continue
    // Physical buildings read physicalGrid in KAnimGraphTileVisualizer.Refresh;
    // a visual construction node must not make that grid look connected.
    if (current?.isPhysical && !neighbour.isPhysical) continue
    if (neighbour.bits !== undefined) {
      if ((neighbour.bits & direction.oppositeBit) !== 0) connections |= direction.bit
    } else if (current?.bits !== undefined && (current.bits & direction.bit) !== 0) {
      // If only the neighbour is opaque, preserve an explicit current port.
      // With both ends opaque there is no safe way to invent a connection.
      connections |= direction.bit
    }
  }
  return connections
}

export function drawUtilityTile(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  definition: UtilityTileDefinition,
  connectionBits: number,
  anchorX: number,
  anchorY: number,
  cellSize: number,
): void {
  const frameIndex = definition.frameByConnections[connectionBits & 0xf] ?? definition.frameByConnections[0]
  const transform = definition.transformByConnections[connectionBits & 0xf] ?? definition.transformByConnections[0]
  const frame = definition.frames[frameIndex]
  if (!frame || !transform) return
  const [sourceX, sourceTop, sourceWidth, sourceHeight, boundsWidth, boundsHeight, boundsCenterX, boundsCenterY] = frame
  const [m00, m10, m01, m11, translateX, translateY] = transform
  // KAnim's runtime animation scale is 0.005 world units per build unit.
  // A 200-unit utility frame therefore spans one map cell before the small
  // intentional overlap used by the game's connection artwork.
  const worldScale = cellSize / 200
  const targetWidth = boundsWidth * worldScale
  const targetHeight = boundsHeight * worldScale
  // KAnim uses the building's CellToPosCBC root: x is the cell centre and y
  // is the cell's bottom edge.
  if (sourceTop < 0 || sourceTop + sourceHeight > image.naturalHeight || sourceX < 0 || sourceX + sourceWidth > image.naturalWidth) return

  // Build UV rectangles are stored in the texture's top-origin coordinate
  // system. Isolating the selected frame also prevents filtering from
  // sampling a neighbouring frame in the atlas.
  let frameCanvas = utilityFrameCanvases.get(image)?.get(frameIndex)
  if (!frameCanvas) {
    frameCanvas = document.createElement('canvas')
    frameCanvas.width = sourceWidth
    frameCanvas.height = sourceHeight
    const frameContext = frameCanvas.getContext('2d')
    if (!frameContext) return
    frameContext.imageSmoothingEnabled = false
    frameContext.clearRect(0, 0, sourceWidth, sourceHeight)
    frameContext.drawImage(image, sourceX, sourceTop, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight)
    const framesForImage = utilityFrameCanvases.get(image) ?? new Map<number, HTMLCanvasElement>()
    framesForImage.set(frameIndex, frameCanvas)
    utilityFrameCanvases.set(image, framesForImage)
  }

  context.save()
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.translate(anchorX, anchorY)
  context.transform(m00, m10, m01, m11, translateX * worldScale, translateY * worldScale)
  context.drawImage(
    frameCanvas,
    0,
    0,
    sourceWidth,
    sourceHeight,
    boundsCenterX * worldScale - targetWidth / 2,
    boundsCenterY * worldScale - targetHeight / 2,
    targetWidth,
    targetHeight,
  )
  context.restore()
}
