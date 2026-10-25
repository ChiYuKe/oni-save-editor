const ATLAS_TILE_SIZE = 176
const MASK_SAMPLE_SIZE = 64

type MaskRect = { x: number; y: number }

// Exported directly from GroundMasks/mask_atlas.asset. The game selects one
// of these sets from SubWorld.ZoneType and falls back to sandstone when a DLC
// biome has no dedicated mask set.
const SOURCE_MASK_RECTS_BY_BIOME: Record<string, Record<number, MaskRect[]>> = {
  boggy_marsh: {
    8: [{ x: 32, y: 3888 }], 9: [{ x: 272, y: 3888 }, { x: 512, y: 3888 }],
    12: [{ x: 752, y: 3888 }, { x: 992, y: 3888 }], 14: [{ x: 1232, y: 3888 }, { x: 1472, y: 3888 }], 15: [{ x: 1712, y: 3888 }],
  },
  crystal_caverns: {
    8: [{ x: 1952, y: 3888 }], 9: [{ x: 2192, y: 3888 }], 12: [{ x: 2432, y: 3888 }],
    14: [{ x: 2672, y: 3888 }], 15: [{ x: 2912, y: 3888 }],
  },
  forest: {
    8: [{ x: 3152, y: 3888 }, { x: 3392, y: 3888 }], 9: [{ x: 3632, y: 3888 }],
    12: [{ x: 3872, y: 3888 }, { x: 32, y: 3648 }, { x: 32, y: 3408 }],
    14: [{ x: 32, y: 3168 }, { x: 32, y: 2928 }], 15: [{ x: 32, y: 2688 }],
  },
  frozen_wastes: {
    8: [{ x: 32, y: 2448 }, { x: 32, y: 2208 }], 9: [{ x: 32, y: 1968 }, { x: 32, y: 1728 }],
    12: [{ x: 32, y: 1488 }, { x: 32, y: 1248 }], 14: [{ x: 32, y: 1008 }, { x: 32, y: 768 }], 15: [{ x: 32, y: 528 }],
  },
  magma_core: {
    8: [{ x: 32, y: 288 }], 9: [{ x: 32, y: 48 }], 12: [{ x: 272, y: 3648 }],
    14: [{ x: 512, y: 3648 }], 15: [{ x: 752, y: 3648 }],
  },
  ocean: {
    8: [{ x: 992, y: 3648 }, { x: 1232, y: 3648 }], 9: [{ x: 1472, y: 3648 }],
    12: [{ x: 1712, y: 3648 }, { x: 1952, y: 3648 }, { x: 2192, y: 3648 }],
    14: [{ x: 2432, y: 3648 }, { x: 2672, y: 3648 }], 15: [{ x: 2912, y: 3648 }],
  },
  oil_field: {
    8: [{ x: 3152, y: 3648 }, { x: 3392, y: 3648 }], 9: [{ x: 3632, y: 3648 }, { x: 3872, y: 3648 }],
    12: [{ x: 272, y: 3408 }, { x: 272, y: 3168 }, { x: 272, y: 2928 }],
    14: [{ x: 272, y: 2688 }, { x: 272, y: 2448 }], 15: [{ x: 272, y: 2208 }],
  },
  prehistoric_garden: {
    8: [{ x: 272, y: 1728 }, { x: 272, y: 1488 }], 9: [{ x: 272, y: 1248 }, { x: 272, y: 1008 }],
    12: [{ x: 272, y: 768 }, { x: 272, y: 528 }, { x: 272, y: 288 }],
    14: [{ x: 272, y: 48 }, { x: 512, y: 3408 }], 15: [{ x: 752, y: 3408 }],
  },
  prehistoric_raptor: {
    8: [{ x: 1232, y: 3408 }, { x: 1472, y: 3408 }], 9: [{ x: 1712, y: 3408 }, { x: 1952, y: 3408 }],
    12: [{ x: 2192, y: 3408 }, { x: 2432, y: 3408 }, { x: 2672, y: 3408 }],
    14: [{ x: 2912, y: 3408 }, { x: 3152, y: 3408 }], 15: [{ x: 3392, y: 3408 }],
  },
  prehistoric_wetlands: {
    8: [{ x: 3872, y: 3408 }, { x: 512, y: 3168 }], 9: [{ x: 512, y: 2928 }, { x: 512, y: 2688 }],
    12: [{ x: 512, y: 2448 }, { x: 512, y: 2208 }, { x: 512, y: 1968 }],
    14: [{ x: 512, y: 1728 }, { x: 512, y: 1488 }], 15: [{ x: 512, y: 1248 }],
  },
  radioactive: {
    8: [{ x: 512, y: 768 }, { x: 512, y: 528 }], 9: [{ x: 512, y: 288 }, { x: 512, y: 48 }],
    12: [{ x: 752, y: 3168 }, { x: 992, y: 3168 }, { x: 1232, y: 3168 }],
    14: [{ x: 1472, y: 3168 }, { x: 1712, y: 3168 }], 15: [{ x: 1952, y: 3168 }],
  },
  reef: {
    8: [{ x: 2432, y: 3168 }, { x: 2672, y: 3168 }], 9: [{ x: 2912, y: 3168 }, { x: 3152, y: 3168 }],
    12: [{ x: 3392, y: 3168 }, { x: 3632, y: 3168 }, { x: 3872, y: 3168 }],
    14: [{ x: 752, y: 2928 }, { x: 752, y: 2688 }], 15: [{ x: 752, y: 2448 }],
  },
  rust: {
    8: [{ x: 752, y: 2208 }, { x: 752, y: 1968 }], 9: [{ x: 752, y: 1728 }],
    12: [{ x: 752, y: 1488 }, { x: 752, y: 1248 }, { x: 752, y: 1008 }],
    14: [{ x: 752, y: 768 }, { x: 752, y: 528 }], 15: [{ x: 752, y: 288 }],
  },
  sand_stone: {
    8: [{ x: 752, y: 48 }, { x: 992, y: 2928 }], 9: [{ x: 1232, y: 2928 }, { x: 1472, y: 2928 }],
    12: [{ x: 1712, y: 2928 }, { x: 1952, y: 2928 }, { x: 2192, y: 2928 }],
    14: [{ x: 2432, y: 2928 }, { x: 2672, y: 2928 }], 15: [{ x: 2912, y: 2928 }],
  },
  space: {
    8: [{ x: 3152, y: 2928 }, { x: 3392, y: 2928 }], 9: [{ x: 3632, y: 2928 }, { x: 3872, y: 2928 }],
    12: [{ x: 992, y: 2688 }, { x: 992, y: 2448 }, { x: 992, y: 2208 }],
    14: [{ x: 992, y: 1968 }, { x: 992, y: 1728 }], 15: [{ x: 992, y: 1488 }],
  },
  swamp: {
    8: [{ x: 992, y: 1008 }, { x: 992, y: 768 }], 9: [{ x: 992, y: 528 }, { x: 992, y: 288 }],
    12: [{ x: 992, y: 48 }, { x: 1232, y: 2688 }, { x: 1472, y: 2688 }],
    14: [{ x: 1712, y: 2688 }, { x: 1952, y: 2688 }], 15: [{ x: 2192, y: 2688 }],
  },
  toxic_jungle: {
    8: [{ x: 2432, y: 2688 }, { x: 2672, y: 2688 }], 9: [{ x: 2912, y: 2688 }],
    12: [{ x: 3152, y: 2688 }, { x: 3392, y: 2688 }, { x: 3632, y: 2688 }],
    14: [{ x: 3872, y: 2688 }, { x: 1232, y: 2448 }], 15: [{ x: 1232, y: 2208 }],
  },
  wasteland: {
    8: [{ x: 1232, y: 1728 }, { x: 1232, y: 1488 }], 9: [{ x: 1232, y: 1248 }, { x: 1232, y: 1008 }],
    12: [{ x: 1232, y: 768 }, { x: 1232, y: 528 }, { x: 1232, y: 288 }],
    14: [{ x: 1232, y: 48 }, { x: 1472, y: 2448 }], 15: [{ x: 1712, y: 2448 }],
  },
}

const ZONE_MASK_BIOMES: Record<number, string> = {
  0: 'frozen_wastes', 1: 'crystal_caverns', 2: 'boggy_marsh', 3: 'sand_stone',
  4: 'toxic_jungle', 5: 'magma_core', 6: 'oil_field', 7: 'space', 8: 'ocean',
  9: 'rust', 10: 'forest', 11: 'radioactive', 12: 'swamp', 13: 'wasteland',
  21: 'prehistoric_garden', 22: 'prehistoric_raptor', 23: 'prehistoric_wetlands', 25: 'reef',
}

export const TERRAIN_MASK_ATLAS_URL = '/assets/elements/mask_atlas.png'
export type TerrainMaskVariant = {
  path: Path2D
  image: HTMLCanvasElement
}
export type TerrainMaskPaths = Map<number, TerrainMaskVariant[]>
export type TerrainMaskSets = Map<number, TerrainMaskPaths>

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

function createTerrainMaskPathsForRects(atlas: HTMLImageElement, sourceRects: Record<number, MaskRect[]>): TerrainMaskPaths {
  const paths: TerrainMaskPaths = new Map([[0, []]])
  const sourcePaths = new Map<number, TerrainMaskVariant[]>()
  Object.entries(sourceRects).forEach(([maskText, rects]) => {
    const mask = Number(maskText)
    sourcePaths.set(mask, rects.map((rect) => {
      const image = createMaskCanvas(atlas, rect)
      return { image, path: pathFromMask(image) }
    }))
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
    paths.set(mask, source.map((variant) => {
      if (turns === 0) return variant
      const image = rotateCanvas(variant.image, turns)
      return { image, path: pathFromMask(image) }
    }))
  }
  return paths
}

export function createTerrainMaskPaths(atlas: HTMLImageElement): TerrainMaskPaths {
  return createTerrainMaskPathsForRects(atlas, SOURCE_MASK_RECTS_BY_BIOME.sand_stone)
}

const maskSetsCache = new WeakMap<HTMLImageElement, TerrainMaskSets>()
export function createTerrainMaskSets(atlas: HTMLImageElement): TerrainMaskSets {
  const cached = maskSetsCache.get(atlas)
  if (cached) return cached
  const byName = new Map(Object.entries(SOURCE_MASK_RECTS_BY_BIOME).map(([name, rects]) => [name, createTerrainMaskPathsForRects(atlas, rects)]))
  const fallback = byName.get('sand_stone') ?? new Map<number, TerrainMaskVariant[]>()
  const result = new Map(Array.from({ length: 28 }, (_, zoneType) => [zoneType, byName.get(ZONE_MASK_BIOMES[zoneType]) ?? fallback]))
  maskSetsCache.set(atlas, result)
  return result
}

export function terrainMaskForCell(
  isConnected: (x: number, y: number) => boolean,
  x: number,
  y: number,
): number {
  // GroundRenderer bits: top-left 8, top-right 4, bottom-left 2,
  // bottom-right 1. This cell is the top-right corner of its vertex quad.
  return 4
    | (isConnected(x - 1, y) ? 8 : 0)
    | (isConnected(x - 1, y - 1) ? 2 : 0)
    | (isConnected(x, y - 1) ? 1 : 0)
}

export function pickTerrainMaskPath(paths: TerrainMaskPaths, mask: number, x: number, y: number): Path2D | undefined {
  return pickTerrainMaskVariant(paths, mask, x, y)?.path
}

export function pickTerrainMaskVariant(paths: TerrainMaskPaths, mask: number, x: number, y: number): TerrainMaskVariant | undefined {
  const variants = paths.get(mask)
  if (!variants || variants.length === 0) return undefined
  // GroundRenderer.GetStaticRandom calls Klei's PerlinSimplexNoise.noise(x,y)
  // and chooses floor(variationCount * noise). Keep the same fixed permutation
  // table so adjacent cells select the same atlas variants as the game.
  const variation = Math.min(variants.length - 1, Math.floor(variants.length * oniSimplexNoise2D(x, y)))
  return variants[variation]
}

const SIMPLEX_GRADIENTS = [
  [1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0, 1], [0, -1],
] as const
const SIMPLEX_PERMUTATION_SOURCE = [
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,
  247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,
  74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,
  65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,
  52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,
  119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,
  218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,
  184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,
] as const
const SIMPLEX_PERMUTATION = Array.from({ length: 512 }, (_, index) => SIMPLEX_PERMUTATION_SOURCE[index & 255])

function oniFastFloor(value: number): number {
  // Matches the game's implementation, including its negative-integer quirk.
  return value <= 0 ? Math.trunc(value) - 1 : Math.trunc(value)
}

function oniSimplexNoise2D(x: number, y: number): number {
  const skew = .5 * (Math.sqrt(3) - 1)
  const unskew = (3 - Math.sqrt(3)) / 6
  const s = (x + y) * skew
  const i = oniFastFloor(x + s)
  const j = oniFastFloor(y + s)
  const t = (i + j) * unskew
  const x0 = x - (i - t)
  const y0 = y - (j - t)
  const i1 = x0 > y0 ? 1 : 0
  const j1 = x0 > y0 ? 0 : 1
  const x1 = x0 - i1 + unskew
  const y1 = y0 - j1 + unskew
  const x2 = x0 - 1 + 2 * unskew
  const y2 = y0 - 1 + 2 * unskew
  const ii = i & 255
  const jj = j & 255
  const gradientIndices = [
    SIMPLEX_PERMUTATION[ii + SIMPLEX_PERMUTATION[jj]] % 12,
    SIMPLEX_PERMUTATION[ii + i1 + SIMPLEX_PERMUTATION[jj + j1]] % 12,
    SIMPLEX_PERMUTATION[ii + 1 + SIMPLEX_PERMUTATION[jj + 1]] % 12,
  ]
  const contribution = (px: number, py: number, gradientIndex: number) => {
    let amount = .5 - px * px - py * py
    if (amount < 0) return 0
    amount *= amount
    const gradient = SIMPLEX_GRADIENTS[gradientIndex]
    return amount * amount * (gradient[0] * px + gradient[1] * py)
  }
  const value = contribution(x0, y0, gradientIndices[0])
    + contribution(x1, y1, gradientIndices[1])
    + contribution(x2, y2, gradientIndices[2])
  return (70 * value + 1) * .5
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
