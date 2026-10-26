import { ONI_PREVIEW_ATLAS } from './oniPreviewAtlas.generated'
import { loadRenderImage } from './oniRenderAssets'
const extracted = new Map<string, Promise<HTMLImageElement | null>>()
const rects: Readonly<Record<string, readonly number[]>> = ONI_PREVIEW_ATLAS.rects
export async function loadOniPreviewImages(paths: Iterable<string>): Promise<Record<string, HTMLImageElement>> {
  const url = `${import.meta.env.BASE_URL.replace(/\/$/, '')}${ONI_PREVIEW_ATLAS.path}`
  const atlas = await loadRenderImage(url, 120000)
  if (!atlas) return {}
  const result = await Promise.all([...new Set(paths)].map(async path => {
    const rect = rects[path]
    if (!rect) return [path, null] as const
    let promise = extracted.get(path)
    if (!promise) {
      const [x, y, w, h] = rect, canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(atlas, x, y, w, h, 0, 0, w, h)
      promise = loadRenderImage(canvas.toDataURL('image/png'))
      extracted.set(path, promise)
    }
    return [path, await promise] as const
  }))
  return Object.fromEntries(result.flatMap(([path, image]) => image ? [[path, image]] : []))
}
