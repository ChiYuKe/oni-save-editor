import type { FluidCameraRect } from './oniFluidViewport'

/** Unity's camera uses upward world Y, whereas the map viewport uses downward rows. */
export function shineCameraForRect(rect: FluidCameraRect, worldHeight: number, cellSize = 32) {
  return { x: (rect.x + rect.width / 2) / cellSize,
    y: worldHeight - (rect.y + rect.height / 2) / cellSize,
    orthoSize: rect.height / (2 * cellSize), aspect: rect.width / rect.height }
}

export function shineCameraKey(camera: ReturnType<typeof shineCameraForRect>) {
  return [camera.x, camera.y, camera.orthoSize, camera.aspect].join(':')
}

/** Keep native screen density; broad overviews use the ordinary tile scheduler. */
export function shineViewportForCamera(rect: FluidCameraRect, width: number, height: number, cellSize = 32, ratio = 1) {
  const x = Math.max(0, Math.floor(rect.x / cellSize) - 1)
  const row = Math.max(0, Math.floor(rect.y / cellSize) - 1)
  const right = Math.min(width, Math.ceil((rect.x + rect.width) / cellSize) + 1)
  const bottom = Math.min(height, Math.ceil((rect.y + rect.height) / cellSize) + 1)
  const density = Math.min(96, Math.max(4, Math.ceil(cellSize * rect.scale * Math.min(2, Math.max(1, ratio)) / 4) * 4))
  const w = right - x, h = bottom - row
  if (w <= 0 || h <= 0 || w * h > 8192 || (w + 2) * density > 4096 || (h + 2) * density > 4096) return undefined
  return { x, row, widthCells: w, heightCells: h, cellSize: density }
}
