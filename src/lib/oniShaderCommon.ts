/**
 * Shared GLSL ES 3.0 helpers for the ported Klei shaders.
 *
 * Klei's shaders are compiled from HLSLCC output, which inlines the
 * RGB<->HSL conversion into every pass. The ports share one readable
 * implementation instead, so the conversion can only be wrong in one place.
 *
 * Substance/GasTest/Liquid all perform the same saturation formula
 * (`delta / (1 - |2L - 1|)`) and the same hue wrap (`h < 0 ? h + 1 : h`), which
 * matches HLSLCC's inlined code. The hue offsets for individual RGB channels
 * must also wrap, as in the
 * compiled shader's per-channel +/- 1 branches.
 */
export const GLSL_HSL = `
vec3 rgb2hsl(vec3 c) {
  float hi = max(c.r, max(c.g, c.b));
  float lo = min(c.r, min(c.g, c.b));
  float d = hi - lo;
  float l = (hi + lo) * 0.5;
  float s = d == 0.0 ? 0.0 : d / (1.0 - abs(2.0 * l - 1.0));
  float h = 0.0;
  if (d != 0.0) {
    if (hi == c.r) h = mod((c.g - c.b) / d, 6.0);
    else if (hi == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h = h / 6.0;
    if (h < 0.0) h += 1.0;
  }
  return vec3(h, s, l);
}

float hue2channel(float p, float q, float t) {
  // HSL normalizes H, but the red/blue channel offsets can leave [0, 1].
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  if (hsl.y == 0.0) return vec3(hsl.z);
  float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
  float p = 2.0 * hsl.z - q;
  return vec3(
    hue2channel(p, q, hsl.x + 1.0 / 3.0),
    hue2channel(p, q, hsl.x),
    hue2channel(p, q, hsl.x - 1.0 / 3.0)
  );
}
`

/**
 * Klei shaders rebuild the world-zone tint by reusing only the hue and
 * saturation of the zone colour with the source luminance. `_WorldZoneForegroundBlend`
 * then cross-fades between them (Substance.shader / GasTest.shader).
 */
export const GLSL_WORLD_ZONE_TINT = `
vec3 worldZoneTinted(vec3 sourceRgb, vec3 zoneRgb) {
  vec3 sourceHsl = rgb2hsl(sourceRgb);
  vec3 zoneHsl = rgb2hsl(zoneRgb);
  return hsl2rgb(vec3(zoneHsl.xy, sourceHsl.z));
}
`

export const GLSL_HEADER = `#version 300 es
precision highp float;
precision highp int;
`
