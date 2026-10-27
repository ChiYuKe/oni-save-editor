import type { ParsedSave } from './save'
import { worldSize } from './editor'
export function printingPodFocus(save: ParsedSave) {
  const groups = save.manager?.groups ?? []
  const pod = (groups.find(g => g.tag === 'Headquarters') ?? groups.find(g => g.tag === 'ExobaseHeadquarters'))?.instances.find(o => Number.isFinite(o.position.x) && Number.isFinite(o.position.y))
  if (!pod) return undefined
  return { x: pod.position.x, row: worldSize(save).height - pod.position.y - 1.5 }
}
export function mapLoadOrigin(save: ParsedSave, x: number, row: number, width: number, height: number) {
  const pod = printingPodFocus(save)
  return pod && pod.x >= x && pod.x <= x + width && pod.row >= row && pod.row <= row + height ? pod : { x: x + width / 2, row: row + height / 2 }
}
export function printingPodViewport(save: ParsedSave, width: number, height: number) {
  const size = worldSize(save), focus = printingPodFocus(save)
  if (!focus || width <= 0 || height <= 0) return { zoomPercent: 0, pan: { x: 0, y: 0 } }
  const fit = Math.min(1, width / (size.width * 32), height / (size.height * 32))
  const cellPixels = Math.max(12, Math.min(32, width / 42, height / 26))
  const zoom = Math.max(1, Math.min(16, cellPixels / (32 * fit))), scale = fit * zoom
  return { zoomPercent: (zoom - 1) / 15 * 100, pan: { x: (size.width / 2 - focus.x) * 32 * scale, y: (size.height / 2 - focus.row) * 32 * scale } }
}

/** Pan is stored in screen pixels, so resize it with the map fit scale. */
export function resizeMapViewport(camera: { zoomPercent: number; pan: { x: number; y: number } }, oldFit: number, newFit: number) {
  const ratio = oldFit > 0 ? newFit / oldFit : 1
  return { ...camera, pan: { x: camera.pan.x * ratio, y: camera.pan.y * ratio } }
}

/** Focus a saved object in global grid coordinates, leaving room for its inspector. */
export function objectMapViewport(save: ParsedSave, width: number, height: number, point: {x:number;y:number}) {
  const size=worldSize(save)
  if(width<=0||height<=0||!Number.isFinite(point.x)||!Number.isFinite(point.y))return {zoomPercent:0,pan:{x:0,y:0}}
  const reserved=Math.min(width*.7,width>600?352:272)
  const usable=Math.max(1,width-reserved)
  const fit=Math.min(1,width/(size.width*32),height/(size.height*32))
  const pixels=Math.max(12,Math.min(32,usable/30,height/24))
  const zoom=Math.max(1,Math.min(16,pixels/(32*fit))),scale=fit*zoom
  return {zoomPercent:(zoom-1)/15*100,pan:{x:(size.width/2-point.x)*32*scale-reserved/2,y:(size.height/2-(size.height-point.y-.5))*32*scale}}
}
