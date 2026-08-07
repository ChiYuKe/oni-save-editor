import type { SavedObjectInstance, Value } from './model'

export type UtilityFamily = 'electrical' | 'gas' | 'liquid' | 'solid' | 'logic'

/**
 * A utility tile as seen by UtilityNetworkManager. Different visual materials
 * still share one family/network (for example insulated and radiant conduits).
 */
export type UtilityCellRecord = {
  tag: string
  bits: number | undefined
  isPhysical: boolean
}

export type UtilityCellMap = Map<UtilityFamily, Map<string, UtilityCellRecord>>

type UtilityTileFrame = readonly [
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  boundsWidth: number,
  boundsHeight: number,
  boundsCenterX: number,
  boundsCenterY: number,
]

export type UtilityTileDefinition = {
  path: string
  family: UtilityFamily
  frames: readonly (UtilityTileFrame | undefined)[]
  frameByConnections: readonly number[]
}

const utilityFrameCanvases = new WeakMap<HTMLImageElement, Map<number, HTMLCanvasElement>>()

const ELECTRIC_CONNECTION_FRAMES = [5, 6, 6, 3, 6, 2, 2, 1, 6, 2, 2, 1, 3, 1, 1, 0]
const CONDUIT_CONNECTION_FRAMES = [6, 4, 4, 2, 4, 9, 7, 8, 4, 3, 9, 1, 2, 1, 8, 0]
const LIQUID_CONNECTION_FRAMES = [5, 3, 10, 2, 10, 8, 9, 7, 3, 1, 8, 0, 2, 0, 7, 4]

// These rectangles and bounds are read from the game's KAnim build.bytes.
// The connection order is the same LRUD animation order used by KAnimGraphTileVisualizer.
const ELECTRIC_FRAMES: UtilityTileFrame[] = [
  [112, 38, 112, 112, 223, 223, .35, .8], [0, 75, 112, 74, 224, 148, .9, 39.14],
  [348, 177, 75, 80, 150, 159, -35.93, 33.43], [335, 87, 112, 31, 223, 62, .35, -1.16],
  [120, 204, 78, 53, 155, 105, -33.7, 2.45], [447, 125, 45, 53, 90, 105, -1.25, 2.9],
  [197, 219, 76, 38, 151, 75, -35.6, 3.67],
]
const ELECTRIC_CONDUCT_FRAMES: UtilityTileFrame[] = [
  [132, 178, 111, 111, 222, 222, -.02, 1.2], [132, 432, 112, 80, 224, 160, .5, 33.78],
  [331, 97, 80, 82, 159, 163, -31.95, 30.17], [132, 324, 112, 35, 224, 69, -.25, 1.05],
  [419, 380, 78, 53, 155, 105, -33.7, 2.45], [464, 237, 45, 53, 90, 105, -1.25, 2.9],
  [244, 290, 77, 38, 153, 75, -36.57, 3.67],
]
const ELECTRIC_INSULATED_FRAMES: UtilityTileFrame[] = [
  [0, 145, 111, 111, 222, 222, .2, 1.38], [111, 176, 111, 81, 222, 161, .45, 32.47],
  [222, 95, 79, 81, 158, 161, -32.85, 32.46], [111, 127, 111, 49, 222, 97, .45, .83],
  [111, 27, 78, 52, 155, 103, -32.85, 2.28], [452, 94, 52, 52, 103, 103, -.48, 2.28],
  [301, 97, 76, 49, 152, 97, -34.65, .8],
]
const ELECTRIC_RUBBER_FRAMES: UtilityTileFrame[] = [
  [245, 401, 111, 111, 222, 222, -.4, 1.2], [133, 432, 112, 80, 223, 160, .43, 30.97],
  [355, 307, 82, 86, 163, 171, -28.03, 28.85], [133, 55, 111, 38, 221, 76, -.38, 2.6],
  [332, 91, 82, 39, 164, 77, -28.7, 4.13], [462, 2, 39, 53, 77, 105, 2.5, .85],
  [436, 351, 76, 41, 152, 82, -35.85, 4.35],
]
const ELECTRIC_HIWATT_FRAMES: UtilityTileFrame[] = [
  [114, 366, 111, 111, 222, 222, .2, 1.38], [114, 85, 111, 81, 222, 161, .45, 32.47],
  [225, 259, 79, 81, 158, 161, -32.85, 32.46], [0, 296, 111, 49, 222, 97, .45, .83],
  [226, 208, 78, 52, 155, 103, -32.85, 2.28], [304, 208, 52, 52, 103, 103, -.48, 2.28],
  [338, 341, 76, 49, 152, 97, -34.65, .8],
]
const LOGIC_FRAMES: UtilityTileFrame[] = [
  [0, 26, 110, 109, 219, 218, -.02, 1.18], [139, 190, 110, 66, 219, 132, -.02, 44.4],
  [358, 190, 65, 66, 130, 132, -44.4, 44.4], [0, 3, 110, 23, 219, 46, -.02, 1.22],
  [421, 141, 77, 50, 153, 99, -33.05, 2.1], [358, 97, 45, 50, 89, 99, -1.35, 2.1],
  [249, 147, 86, 44, 172, 87, -23.38, -.85],
]
// KAnim source frame 5 is intentionally absent from this atlas. Keep the
// source frame number as the array index; connection maps refer to it directly.
const GAS_FRAMES: Array<UtilityTileFrame | undefined> = [
  [228, 400, 112, 113, 224, 225, .9, 2.4], [0, 205, 113, 94, 226, 187, .93, 29.5],
  [0, 359, 114, 61, 227, 121, .23, 2.2], [202, 123, 88, 88, 176, 175, -23.75, 27.75],
  [203, 61, 76, 62, 152, 124, -36.94, 3.2], undefined,
  [292, 233, 65, 66, 129, 132, .35, 2.24], [113, 210, 90, 89, 179, 177, -23.47, 26.5],
  [0, 420, 114, 93, 228, 185, .38, 28.5], [113, 122, 89, 88, 178, 176, -23, 25.71],
]
const LIQUID_FRAMES: Array<UtilityTileFrame | undefined> = [
  [0, 306, 113, 95, 226, 189, -.69, 20.07], [113, 235, 78, 78, 156, 155, -34.22, 35.1],
  [0, 77, 113, 42, 225, 83, -.38, 1.16], [113, 356, 80, 44, 159, 88, -34.45, 1.35],
  [0, 400, 113, 112, 226, 224, -.33, -.25], [211, 187, 51, 48, 102, 95, -2.25, .85],
  undefined, [0, 118, 113, 93, 226, 186, -.69, 18.75], [191, 235, 78, 78, 156, 155, -34.22, 35.1],
  [113, 157, 78, 78, 156, 155, -34.22, 35.1], [113, 312, 80, 44, 159, 88, -34.45, 1.35],
]
const CONVEYOR_FRAMES: Array<UtilityTileFrame | undefined> = [
  [131, 398, 115, 114, 229, 228, 4.05, 6.53], [131, 315, 111, 84, 222, 167, -2.33, 31.75],
  [242, 263, 110, 55, 220, 109, -.1, -1.24], [242, 125, 81, 84, 162, 167, -32.53, 31.9],
  [403, 65, 75, 60, 150, 120, -36.5, -7.86], undefined, [323, 1, 41, 42, 82, 83, .25, -.15],
  [323, 43, 78, 82, 155, 164, -26.78, 29.08], [242, 317, 110, 81, 220, 162, -.1, 29.38],
  [323, 125, 80, 84, 160, 167, -30.43, 31.75],
]

function utilityDefinition(path: string, family: UtilityFamily, frames: readonly (UtilityTileFrame | undefined)[], frameByConnections: readonly number[]): UtilityTileDefinition {
  return { path: `/assets/buildings/utilities/${path}_0.png`, family, frames, frameByConnections }
}

export const UTILITY_DEFINITIONS = {
  electric: utilityDefinition('utilities_electric_kanim', 'electrical', ELECTRIC_FRAMES, ELECTRIC_CONNECTION_FRAMES),
  electricConduct: utilityDefinition('utilities_electric_conduct_kanim', 'electrical', ELECTRIC_CONDUCT_FRAMES, ELECTRIC_CONNECTION_FRAMES),
  electricInsulated: utilityDefinition('utilities_electric_insulated_kanim', 'electrical', ELECTRIC_INSULATED_FRAMES, ELECTRIC_CONNECTION_FRAMES),
  electricRubber: utilityDefinition('utilities_electric_rubber_kanim', 'electrical', ELECTRIC_RUBBER_FRAMES, ELECTRIC_CONNECTION_FRAMES),
  electricHiwatt: utilityDefinition('utilities_electric_conduct_hiwatt_kanim', 'electrical', ELECTRIC_HIWATT_FRAMES, ELECTRIC_CONNECTION_FRAMES),
  logic: utilityDefinition('logic_wires_kanim', 'logic', LOGIC_FRAMES, ELECTRIC_CONNECTION_FRAMES),
  gas: utilityDefinition('utilities_gas_kanim', 'gas', GAS_FRAMES, CONDUIT_CONNECTION_FRAMES),
  gasInsulated: utilityDefinition('utilities_gas_insulated_kanim', 'gas', GAS_FRAMES, CONDUIT_CONNECTION_FRAMES),
  gasRadiant: utilityDefinition('utilities_gas_radiant_kanim', 'gas', GAS_FRAMES, CONDUIT_CONNECTION_FRAMES),
  liquid: utilityDefinition('utilities_liquid_kanim', 'liquid', LIQUID_FRAMES, LIQUID_CONNECTION_FRAMES),
  liquidInsulated: utilityDefinition('utilities_liquid_insulated_kanim', 'liquid', LIQUID_FRAMES, LIQUID_CONNECTION_FRAMES),
  liquidRadiant: utilityDefinition('utilities_liquid_radiant_kanim', 'liquid', LIQUID_FRAMES, LIQUID_CONNECTION_FRAMES),
  conveyor: utilityDefinition('utilities_conveyor_kanim', 'solid', CONVEYOR_FRAMES, CONDUIT_CONNECTION_FRAMES),
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
  const frame = definition.frames[frameIndex]
  if (!frame) return
  const [sourceX, sourceY, sourceWidth, sourceHeight, boundsWidth, boundsHeight, boundsCenterX, boundsCenterY] = frame
  const worldScale = cellSize / 200
  const targetWidth = boundsWidth * worldScale
  const targetHeight = boundsHeight * worldScale
  // KAnim uses the building's CellToPosCBC root: x is the cell centre and y
  // is the cell's bottom edge. Bounds use a Y-up coordinate system.
  const centerX = anchorX + boundsCenterX * worldScale
  const centerY = anchorY - boundsCenterY * worldScale
  const sourceTop = image.naturalHeight - sourceY - sourceHeight
  if (sourceTop < 0 || sourceTop + sourceHeight > image.naturalHeight) return

  // KAnim's uvBox Y coordinate is bottom-origin while PNG/canvas source
  // rectangles are top-origin. Isolating the selected frame also prevents
  // filtering from sampling a neighbouring frame in the atlas.
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
  context.drawImage(frameCanvas, 0, 0, sourceWidth, sourceHeight, centerX - targetWidth / 2, centerY - targetHeight / 2, targetWidth, targetHeight)
  context.restore()
}
