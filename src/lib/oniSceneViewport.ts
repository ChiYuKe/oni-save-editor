import type { FluidCameraRect } from './oniFluidViewport'

/** Rasterize visible static artwork at screen density, never enlarge a 32px snapshot. */
export function sceneViewportForCamera(rect: FluidCameraRect, worldWidth: number, worldHeight: number, nativeCellSize: number, pixelRatio: number) {
  if (!(rect.width > 0 && rect.height > 0 && rect.scale > 0)) return undefined
  const tile = 32
  const x = Math.max(0, Math.floor(rect.x / nativeCellSize / tile) * tile)
  const row = Math.max(0, Math.floor(rect.y / nativeCellSize / tile) * tile)
  const right = Math.min(worldWidth, Math.ceil((rect.x + rect.width) / nativeCellSize / tile) * tile)
  const bottom = Math.min(worldHeight, Math.ceil((rect.y + rect.height) / nativeCellSize / tile) * tile)
  if (right <= x || bottom <= row) return undefined
  const pixels = nativeCellSize * rect.scale * Math.min(2, Math.max(1, pixelRatio))
  const cellSize = Math.min(96, Math.max(4, Math.ceil(pixels / 4) * 4))
  return { x, row, right, bottom, cellSize, tile, key: `${x}:${row}:${right}:${bottom}:${cellSize}` }
}
