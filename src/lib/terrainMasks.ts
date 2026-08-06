const ATLAS_TILE_SIZE = 176
const MASK_SAMPLE_SIZE = 64

type MaskRect = { x: number; y: number }

// The standard sandstone biome is the mask set used by the starter asteroid.
// These coordinates come from the exported GroundMasks/mask_atlas assets.
const SOURCE_MASK_RECTS: Record<number, MaskRect[]> = {
  8: [{ x: 752, y: 48 }, { x: 992, y: 2928 }],
  9: [{ x: 1232, y: 2928 }, { x: 1472, y: 2928 }],
  12: [{ x: 1712, y: 2928 }, { x: 1952, y: 2928 }, { x: 2192, y: 2928 }],
  14: [{ x: 2432, y: 2928 }, { x: 2672, y: 2928 }],
  15: [{ x: 2912, y: 2928 }],
}

export const TERRAIN_MASK_ATLAS_URL = '/assets/elements/mask_atlas.png'
export type TerrainMaskPaths = Map<number, Path2D[]>

function rotateMask(mask: number): number {
  const bit1 = mask & 1
  const bit2 = (mask & 2) >> 1
  const bit4 = (mask & 4) >> 2
  return ((mask & 8) >> 3 << 2) | bit4 | (bit2 << 3) | (bit1 << 1)
}

function rotateCanvas(source: HTMLCanvasElement, turns: number): HTMLCanvasElement {
  if (turns === 0) return source
  const rotated = document.createElement('canvas')
  rotated.width = ATLAS_TILE_SIZE
  rotated.height = ATLAS_TILE_SIZE
  const context = rotated.getContext('2d')
  if (!context) return source
  context.translate(ATLAS_TILE_SIZE / 2, ATLAS_TILE_SIZE / 2)
  context.rotate(-turns * Math.PI / 2)
  context.drawImage(source, -ATLAS_TILE_SIZE / 2, -ATLAS_TILE_SIZE / 2)
  return rotated
}

function pathFromMask(source: HTMLCanvasElement): Path2D {
  const context = source.getContext('2d', { willReadFrequently: true })
  const path = new Path2D()
  if (!context) return path
  const pixels = context.getImageData(0, 0, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE).data
  const scale = ATLAS_TILE_SIZE / MASK_SAMPLE_SIZE
  for (let row = 0; row < MASK_SAMPLE_SIZE; row++) {
    let runStart = -1
    for (let column = 0; column <= MASK_SAMPLE_SIZE; column++) {
      let opaque = false
      if (column < MASK_SAMPLE_SIZE) {
        const sourceX = Math.min(ATLAS_TILE_SIZE - 1, Math.floor((column + .5) * scale))
        const sourceY = Math.min(ATLAS_TILE_SIZE - 1, Math.floor((row + .5) * scale))
        opaque = pixels[(sourceY * ATLAS_TILE_SIZE + sourceX) * 4 + 3] > 32
      }
      if (opaque && runStart < 0) runStart = column
      if (!opaque && runStart >= 0) {
        path.rect(runStart / MASK_SAMPLE_SIZE, row / MASK_SAMPLE_SIZE, (column - runStart) / MASK_SAMPLE_SIZE, 1 / MASK_SAMPLE_SIZE)
        runStart = -1
      }
    }
  }
  return path
}

function createMaskCanvas(atlas: HTMLImageElement, rect: MaskRect): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_TILE_SIZE
  canvas.height = ATLAS_TILE_SIZE
  const context = canvas.getContext('2d')
  if (context) {
    context.imageSmoothingEnabled = false
    context.drawImage(atlas, rect.x, rect.y, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE, 0, 0, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE)
  }
  return canvas
}

export function createTerrainMaskPaths(atlas: HTMLImageElement): TerrainMaskPaths {
  const paths: TerrainMaskPaths = new Map([[0, []]])
  const sourcePaths = new Map<number, Path2D[]>()
  Object.entries(SOURCE_MASK_RECTS).forEach(([maskText, rects]) => {
    const mask = Number(maskText)
    sourcePaths.set(mask, rects.map((rect) => pathFromMask(createMaskCanvas(atlas, rect))))
  })

  for (let mask = 1; mask < 16; mask++) {
    let sourceMask = mask
    let turns = 0
    while (!sourcePaths.has(sourceMask) && turns < 4) {
      sourceMask = rotateMask(sourceMask)
      turns += 1
    }
    const source = sourcePaths.get(sourceMask)
    if (!source) {
      paths.set(mask, [])
      continue
    }
    const rects = SOURCE_MASK_RECTS[sourceMask]
    paths.set(mask, source.map((_, index) => {
      const sourceCanvas = createMaskCanvas(atlas, rects[index])
      return pathFromMask(rotateCanvas(sourceCanvas, turns))
    }))
  }
  return paths
}

export function terrainMaskForCell(
  isConnected: (x: number, y: number) => boolean,
  x: number,
  y: number,
): number {
  // Match the four-corner ordering used by GroundRenderer: the current cell
  // is the upper-right corner, with the other bits coming from its neighbours.
  return 8
    | (isConnected(x - 1, y) ? 4 : 0)
    | (isConnected(x - 1, y - 1) ? 2 : 0)
    | (isConnected(x, y - 1) ? 1 : 0)
}

export function pickTerrainMaskPath(paths: TerrainMaskPaths, mask: number, x: number, y: number): Path2D | undefined {
  const variants = paths.get(mask)
  if (!variants || variants.length === 0) return undefined
  const variation = Math.abs((x * 92821 + y * 68917) % variants.length)
  return variants[variation]
}

type TerrainPoint = { x: number; y: number }

function terrainNoise(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

function sharedEdgeProfile(seed: number): number[] {
  const first = .045 + terrainNoise(seed) * .045
  const second = .055 + terrainNoise(seed + 1) * .055
  const third = .045 + terrainNoise(seed + 2) * .05
  return [first, second, first * .45, third, second * .7, first * .8]
}

function openEdgePoints(side: 'top' | 'right' | 'bottom' | 'left', x: number, y: number): TerrainPoint[] {
  const horizontalSeed = (x * 92821 + y * 68917 + 101) | 0
  const verticalSeed = (x * 92821 + y * 68917 + 202) | 0
  const xPositions = [0, .18, .37, .58, .79, 1]
  const yPositions = [0, .2, .41, .61, .81, 1]
  if (side === 'top') {
    const profile = sharedEdgeProfile(horizontalSeed)
    return xPositions.map((pointX, index) => ({ x: pointX, y: profile[index] }))
  }
  if (side === 'right') {
    const profile = sharedEdgeProfile(verticalSeed)
    return yPositions.map((pointY, index) => ({ x: 1 - profile[index], y: pointY }))
  }
  if (side === 'bottom') {
    const profile = sharedEdgeProfile(horizontalSeed)
    return xPositions.map((_, index) => ({ x: xPositions[5 - index], y: 1 - profile[5 - index] }))
  }
  const profile = sharedEdgeProfile(verticalSeed)
  return yPositions.map((_, index) => ({ x: profile[5 - index], y: yPositions[5 - index] }))
}

export function createTerrainCellPath(
  isConnected: (x: number, y: number) => boolean,
  x: number,
  y: number,
): Path2D {
  const path = new Path2D()
  const edges: Array<{ side: 'top' | 'right' | 'bottom' | 'left'; connected: boolean }> = [
    { side: 'top', connected: isConnected(x, y + 1) },
    { side: 'right', connected: isConnected(x + 1, y) },
    { side: 'bottom', connected: isConnected(x, y - 1) },
    { side: 'left', connected: isConnected(x - 1, y) },
  ]
  const points: TerrainPoint[] = []
  edges.forEach(({ side, connected }) => {
    if (connected) {
      if (side === 'top') points.push({ x: 0, y: 0 }, { x: 1, y: 0 })
      if (side === 'right') points.push({ x: 1, y: 0 }, { x: 1, y: 1 })
      if (side === 'bottom') points.push({ x: 1, y: 1 }, { x: 0, y: 1 })
      if (side === 'left') points.push({ x: 0, y: 1 }, { x: 0, y: 0 })
    } else {
      const edgeCellX = side === 'left' ? x - 1 : x
      const edgeCellY = side === 'bottom' ? y - 1 : y
      points.push(...openEdgePoints(side, edgeCellX, edgeCellY))
    }
  })
  path.moveTo(points[0].x, points[0].y)
  points.slice(1).forEach((point) => path.lineTo(point.x, point.y))
  path.closePath()
  return path
}

export function createTerrainBoundaryPath(
  isConnected: (x: number, y: number) => boolean,
  x: number,
  y: number,
): Path2D {
  const path = new Path2D()
  const edges: Array<{ side: 'top' | 'right' | 'bottom' | 'left'; connected: boolean }> = [
    { side: 'top', connected: isConnected(x, y + 1) },
    { side: 'right', connected: isConnected(x + 1, y) },
    { side: 'bottom', connected: isConnected(x, y - 1) },
    { side: 'left', connected: isConnected(x - 1, y) },
  ]
  edges.forEach(({ side, connected }) => {
    if (connected) return
    const edgeCellX = side === 'left' ? x - 1 : x
    const edgeCellY = side === 'bottom' ? y - 1 : y
    const points = openEdgePoints(side, edgeCellX, edgeCellY)
    path.moveTo(points[0].x, points[0].y)
    points.slice(1).forEach((point) => path.lineTo(point.x, point.y))
  })
  return path
}
