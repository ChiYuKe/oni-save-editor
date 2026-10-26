import { worldSize } from './editor'
import { elementForHash } from './elements'
import { blockTileTextureForTag } from './blockTiles'
import { readSimCell, readSimBackwall } from './sim'
import type { ParsedSave } from './save'

/** A complete navigable silhouette from local save bytes, with no asset requests. */
export function oniMapOverviewPixels(save: ParsedSave) {
  const { width, height } = worldSize(save), sim = save.simData
  const pixels = new Uint8ClampedArray(width * height * 4)
  if (!sim) return { width, height, pixels }
  const view = new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const cell = readSimCell(sim, view, x + 1, y + 1)
    if (!cell) continue
    let element = elementForHash(cell.elementHash), alpha = element.state === 'solid' ? 255 : element.state === 'liquid' && cell.mass > 0 ? 210 : element.state === 'gas' && cell.mass > 0 ? 70 : 0
    if (!alpha) {
      const wall = readSimBackwall(sim, view, x + 1, y + 1)
      if (wall && elementForHash(wall.elementHash).state === 'solid') { element = elementForHash(wall.elementHash); alpha = 100 }
    }
    if (!alpha) continue
    const color = Number.parseInt(element.color.replace('#', ''), 16), i = ((height - 1 - y) * width + x) * 4
    pixels[i] = (color >> 16 & 255) * .65; pixels[i + 1] = (color >> 8 & 255) * .65; pixels[i + 2] = (color & 255) * .65; pixels[i + 3] = alpha
  }
  for (const group of save.manager?.groups ?? []) if (blockTileTextureForTag(group.tag)) for (const object of group.instances) {
    const x = Math.floor(object.position.x), row = height - 1 - Math.floor(object.position.y)
    if (x < 0 || row < 0 || x >= width || row >= height) continue
    pixels.set([135, 159, 159, 255], (row * width + x) * 4)
  }
  return { width, height, pixels }
}
export function createOniMapOverview(save: ParsedSave): HTMLCanvasElement {
  const { width, height, pixels } = oniMapOverviewPixels(save), canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  canvas.getContext('2d')!.putImageData(new ImageData(pixels, width, height), 0, 0)
  return canvas
}
