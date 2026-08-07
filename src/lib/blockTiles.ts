export type BlockTileTextureDefinition = {
  path: string
}

// BlockTileRenderer stores one 4x4 set of connection variants in each atlas.
// These bit values match Rendering.BlockTileRenderer.Bits in the game DLL.
export const BLOCK_TILE_BITS = {
  upLeft: 0x80,
  up: 0x40,
  upRight: 0x20,
  left: 0x10,
  right: 0x08,
  downLeft: 0x04,
  down: 0x02,
  downRight: 0x01,
} as const

const CARDINAL_BITS = BLOCK_TILE_BITS.up | BLOCK_TILE_BITS.left | BLOCK_TILE_BITS.right | BLOCK_TILE_BITS.down
const ATLAS_PADDING = 8
const ATLAS_STEP = 208
const ATLAS_VARIANT_SIZE = 192
const ATLAS_TRIM = 32

export const BLOCK_TILE_TEXTURES: Record<string, BlockTileTextureDefinition> = {
  tile: { path: '/assets/buildings/tiles/tiles_solid.png' },
  tilepoi: { path: '/assets/buildings/tiles/tiles_POI.png' },
  meshtile: { path: '/assets/buildings/tiles/tiles_mesh.png' },
  glasstile: { path: '/assets/buildings/tiles/tiles_glass.png' },
  carpettile: { path: '/assets/buildings/tiles/tiles_carpet.png' },
  metaltile: { path: '/assets/buildings/tiles/tiles_metal.png' },
  bunkertile: { path: '/assets/buildings/tiles/tiles_bunker.png' },
  insulatedtile: { path: '/assets/buildings/tiles/tiles_insulated.png' },
  plastictile: { path: '/assets/buildings/tiles/tiles_plastic.png' },
  woodtile: { path: '/assets/buildings/tiles/tiles_wood.png' },
  rubbertile: { path: '/assets/buildings/tiles/tiles_rubber.png' },
  snowtile: { path: '/assets/buildings/tiles/tiles_snow.png' },
  mouldingtile: { path: '/assets/buildings/tiles/tiles_moulding.png' },
}

export function blockTileTextureForTag(tag: string): BlockTileTextureDefinition | undefined {
  return BLOCK_TILE_TEXTURES[tag.trim().toLowerCase()]
}

export function blockTileCellKey(x: number, y: number): string {
  return `${x}:${y}`
}

export function blockTileConnectionBits(
  isConnected: (x: number, y: number) => boolean,
  x: number,
  y: number,
): number {
  let bits = 0
  if (isConnected(x - 1, y + 1)) bits |= BLOCK_TILE_BITS.upLeft
  if (isConnected(x, y + 1)) bits |= BLOCK_TILE_BITS.up
  if (isConnected(x + 1, y + 1)) bits |= BLOCK_TILE_BITS.upRight
  if (isConnected(x - 1, y)) bits |= BLOCK_TILE_BITS.left
  if (isConnected(x + 1, y)) bits |= BLOCK_TILE_BITS.right
  if (isConnected(x - 1, y - 1)) bits |= BLOCK_TILE_BITS.downLeft
  if (isConnected(x, y - 1)) bits |= BLOCK_TILE_BITS.down
  if (isConnected(x + 1, y - 1)) bits |= BLOCK_TILE_BITS.downRight
  return bits
}

function atlasVariantPosition(connectionBits: number): { column: number; row: number } {
  const cardinal = connectionBits & CARDINAL_BITS
  const column = (cardinal & BLOCK_TILE_BITS.down ? 1 : 0) | (cardinal & BLOCK_TILE_BITS.right ? 2 : 0)
  const row = (cardinal & BLOCK_TILE_BITS.left ? 1 : 0) | (cardinal & BLOCK_TILE_BITS.up ? 2 : 0)
  return { column, row }
}

/**
 * Reproduces BlockTileRenderer.AddVertexInfo: open edges grow by 0.25 world
 * cells, while connected edges trim 32 atlas pixels to hide duplicate borders.
 */
export function drawBlockTile(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  connectionBits: number,
  px: number,
  py: number,
  cellSize: number,
): void {
  const { column, row } = atlasVariantPosition(connectionBits)
  const connectedLeft = (connectionBits & BLOCK_TILE_BITS.left) !== 0
  const connectedRight = (connectionBits & BLOCK_TILE_BITS.right) !== 0
  const connectedUp = (connectionBits & BLOCK_TILE_BITS.up) !== 0
  const connectedDown = (connectionBits & BLOCK_TILE_BITS.down) !== 0
  const sourceX = ATLAS_PADDING + column * ATLAS_STEP + (connectedLeft ? ATLAS_TRIM : 0)
  const sourceY = ATLAS_PADDING + row * ATLAS_STEP + (connectedUp ? ATLAS_TRIM : 0)
  const sourceWidth = ATLAS_VARIANT_SIZE - (connectedLeft ? ATLAS_TRIM : 0) - (connectedRight ? ATLAS_TRIM : 0)
  const sourceHeight = ATLAS_VARIANT_SIZE - (connectedUp ? ATLAS_TRIM : 0) - (connectedDown ? ATLAS_TRIM : 0)
  const extendLeft = connectedLeft ? 0 : cellSize * .25
  const extendRight = connectedRight ? 0 : cellSize * .25
  const extendUp = connectedUp ? 0 : cellSize * .25
  const extendDown = connectedDown ? 0 : cellSize * .25

  context.save()
  // The exported atlas has transparent white padding around several variants.
  // Nearest sampling matches the game's UV trim and prevents white seams when
  // a variant is scaled to a map cell.
  context.imageSmoothingEnabled = false
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    px - extendLeft,
    py - extendUp,
    cellSize + extendLeft + extendRight,
    cellSize + extendUp + extendDown,
  )
  context.restore()
}
