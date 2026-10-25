export type GridCellPoint = { x: number; y: number }
export type GridSelection = { start: GridCellPoint; end: GridCellPoint }
export type GridOutlineRect = { x: number; y: number; width: number; height: number }

/** Inclusive SIM cells to top-origin display pixels; cell (0,0) is bottom-left. */
export function gridSelectionRect(selection: GridSelection, worldHeight: number, cellSize: number, originX: number, originY: number): GridOutlineRect {
  const minX = Math.min(selection.start.x, selection.end.x)
  const maxX = Math.max(selection.start.x, selection.end.x)
  const minY = Math.min(selection.start.y, selection.end.y)
  const maxY = Math.max(selection.start.y, selection.end.y)
  return { x: originX + minX * cellSize, y: originY + (worldHeight - 1 - maxY) * cellSize,
    width: (maxX - minX + 1) * cellSize, height: (maxY - minY + 1) * cellSize }
}
