import { ONI_SUBSTANCE_GRADIENTS } from './oniSubstanceGradients.generated'

/** The sim receives all gradient keys (including their quantised key times). */
export function liquidGradientColour(hash: number, temperatureRatio: number, fallback: readonly number[]): readonly number[] {
  const keys = ONI_SUBSTANCE_GRADIENTS.get(hash & 0xffff)
  if (!keys?.length) return fallback
  const ratio = Math.max(0, Math.min(1, temperatureRatio))
  for (let i = 1; i < keys.length; i++) {
    if (ratio > keys[i].time) continue
    const a = keys[i - 1], b = keys[i]
    const blend = Math.max(0, Math.min(1, (ratio - a.time) / Math.max(1 / 255, b.time - a.time)))
    return a.rgb.map((v, c) => Math.round(v + (b.rgb[c] - v) * blend))
  }
  return keys[keys.length - 1].rgb
}
