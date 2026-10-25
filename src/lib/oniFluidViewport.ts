export interface FluidCameraRect { x: number; y: number; width: number; height: number; scale: number }

/** Visible cells plus a small gutter, bounded to roughly 3 million fluid pixels. */
export function fluidViewportForCamera(rect: FluidCameraRect, worldWidth: number, worldHeight: number, nativeCellSize: number, pixelRatio = 1) {
  if (!(rect.width > 0 && rect.height > 0 && rect.scale > 0)) return undefined
  const x = Math.max(0, Math.floor(rect.x / nativeCellSize) - 2)
  const row = Math.max(0, Math.floor(rect.y / nativeCellSize) - 2)
  const right = Math.min(worldWidth, Math.ceil((rect.x + rect.width) / nativeCellSize) + 2)
  const bottom = Math.min(worldHeight, Math.ceil((rect.y + rect.height) / nativeCellSize) + 2)
  const widthCells = right - x, heightCells = bottom - row
  if (widthCells <= 0 || heightCells <= 0) return undefined
  const cellSize = Math.max(1, Math.min(64, Math.ceil(nativeCellSize * rect.scale * Math.min(2, Math.max(1, pixelRatio))), Math.floor(2048 / widthCells), Math.floor(1536 / heightCells)))
  return { x, row, widthCells, heightCells, cellSize }
}
