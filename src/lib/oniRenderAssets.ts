/** Shared decoded artwork with bounded retention; failures remain retryable. */
const images = new Map<string, { promise: Promise<HTMLImageElement | null>; bytes: number }>()
const maxBytes = 256 * 1024 * 1024
const maxImages = 256
let retainedBytes = 0
export function loadRenderImage(url: string): Promise<HTMLImageElement | null> {
  const cached = images.get(url)
  if (cached) { images.delete(url); images.set(url, cached); return cached.promise }
  const entry = { promise: Promise.resolve<HTMLImageElement | null>(null), bytes: 0 }
  entry.promise = new Promise<HTMLImageElement | null>(resolve => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  }).then(image => {
    if (!image) { images.delete(url); return null }
    entry.bytes = image.naturalWidth * image.naturalHeight * 4
    retainedBytes += entry.bytes
    for (const [key, value] of images) {
      if (retainedBytes <= maxBytes && images.size <= maxImages) break
      if (key === url || value.bytes === 0) continue
      images.delete(key); retainedBytes -= value.bytes
    }
    return image
  })
  images.set(url, entry)
  return entry.promise
}
