/**
 * Single source of truth for the Klei shaders ported to WebGL2.
 *
 * Every value below is transcribed from the Unity project at
 * `E:\Unity\NOI1018\ExportedProject`, and the comment above each group names
 * the file that owns it. When the Unity project changes, update this file
 * instead of editing numbers inside the individual renderers: the renderers
 * must never hand-write a Klei constant again.
 *
 * Reference paths (relative to `ExportedProject/Assets`):
 *   Shaders/World/Resources/substance.shader   Klei/Substance
 *   Shaders/World/Resources/gastest.shader     Klei/GasTest
 *   Shaders/World/Resources/liquid.shader      Klei/Liquid
 *   Scripts/Assembly-CSharp/Lighting.cs        global shader uniforms
 *   MonoBehaviour/LightingSettings.asset       LightingSettings values
 *   Material/GasTest.mat                       GasTest material instance
 */

/** TerrainBG.Render: last background layer uses BackgroundUVScale=1.1.
 * SubworldZoneRenderData maps biome IDs to slices of bgarray.
 */
export const ONI_BACKGROUND_SETTINGS = { uvScale: 1.1 } as const
export const ONI_ZONE_TEXTURE_ARRAY_INDICES = [
  0, 1, 2, 3, 4, 5, 5, 3, 6, 7, 8, 9, 10, 11, 12, 7, 3, 13, 0, 0,
  0, 14, 15, 16, 4, 6, 18, 17,
] as const

export type UnityColor = readonly [number, number, number, number]
export type UnityVector4 = readonly [number, number, number, number]

/**
 * `LightingSettings.asset` -> `Lighting.UpdateLighting()`.
 *
 * Lighting.cs packs these fields into global vectors, so the shader uniform
 * layouts are reproduced here with the same component order as the C# code.
 */
export const ONI_LIGHTING_SETTINGS = {
  /**
   * `substanceEdgeParameters` -> `_SubstanceParameters`
   * = (intensity, edgeIntensity, directSunlightScale, power).
   * Lighting.cs line 199.
   */
  substanceEdgeParameters: {
    intensity: .2,
    edgeIntensity: 1.7,
    directSunlightScale: .5,
    power: 3,
  },
  /** `DigMapColour` + `DigMapScale` -> `_DigMapMapParameters` (rgb = colour, a = scale). */
  digMapColour: [.6764706, .6764706, .6764706] as const,
  digMapScale: .125,
  /** `StateTransitionColor` and `1f / StateTransitionUVScale` + `UVOffsetRate`. */
  stateTransitionColor: [.5344828, .5344828, .5344828, .516] as const,
  stateTransitionUvScale: 5,
  stateTransitionUvOffsetRate: [0, .05] as const,
  /** `FallingSolidColor` and `1f / FallingSolidUVScale` + `UVOffsetRate`. */
  fallingSolidColor: [.53333336, .53333336, .53333336, .5176471] as const,
  fallingSolidUvScale: 5,
  fallingSolidUvOffsetRate: [.3, .025] as const,
  /** `GasMinOpacity` / `GasMaxOpacity` -> `_GasOpacity`. */
  gasMinOpacity: 1,
  gasMaxOpacity: 1,
  /** `DarkenTints[0]` -> `_DarkenTintBackground`. */
  darkenTintBackground: [.8455882, .8455882, .8455882, 1] as const,
  /** `WorldZoneForegroundBlend` / `WorldZoneGasBlend`, Lighting.cs lines 235-237. */
  worldZoneForegroundBlend: .4,
  worldZoneGasBlend: .1,
  /**
   * `PropertyTextures.cs` line 555 sets `_ClusterWorldSizeInfo` to the camera's
   * visible cluster, and Substance.shader clips every fragment with
   * `vs_TEXCOORD5.y > 1`. The browser renders the whole known world in one
   * pass, so the cluster covers the complete world.
   */
  clusterWorldSize: [1, 1, 0, 0] as const,
} as const

/**
 * `substance.shader` -> `_SubstanceParameters`.
 * Lighting.cs line 199 packs `substanceEdgeParameters` in this order; the
 * OPAQUE variant uses intensity; natural-ground ALPHA/MATTE and ALPHA/SHINY
 * additionally use `pow((1 - dig) * edgeIntensity, power)`. Sunlight contributes
 * `exposure * timeOfDay * directSunlightScale` only when that runtime input exists.
 */
export function substanceParameters(): UnityVector4 {
  const edge = ONI_LIGHTING_SETTINGS.substanceEdgeParameters
  return [edge.intensity, edge.edgeIntensity, edge.directSunlightScale, edge.power]
}

/** `_StateTransitionParameters` = (1 / uvScale, offsetX, offsetY, 0). Lighting.cs line 177. */
export function stateTransitionParameters(): UnityVector4 {
  const [offsetX, offsetY] = ONI_LIGHTING_SETTINGS.stateTransitionUvOffsetRate
  return [1 / ONI_LIGHTING_SETTINGS.stateTransitionUvScale, offsetX, offsetY, 0]
}

/** `_FallingSolidParameters` = (1 / uvScale, offsetX, offsetY, 0). Lighting.cs line 180. */
export function fallingSolidParameters(): UnityVector4 {
  const [offsetX, offsetY] = ONI_LIGHTING_SETTINGS.fallingSolidUvOffsetRate
  return [1 / ONI_LIGHTING_SETTINGS.fallingSolidUvScale, offsetX, offsetY, 0]
}

/** `_DigMapMapParameters` = (colour.rgb, scale). Lighting.cs line 172. */
export function digMapMapParameters(): UnityVector4 {
  const [r, g, b] = ONI_LIGHTING_SETTINGS.digMapColour
  return [r, g, b, ONI_LIGHTING_SETTINGS.digMapScale]
}

/**
 * `Material/GasTest.mat` -> the uniforms Klei/GasTest declares but leaves to the
 * material instance.
 *
 * PropertyTextures.cs is the only code that creates the GasTest material and it
 * never overrides these values, so the serialised material values are what the
 * game renders with.
 */
export const ONI_GAS_TEST_MATERIAL = {
  /** `_Alpha` in GasTest.mat: final `SV_Target0.w * _Alpha`. */
  alpha: .5,
  /** `_SpaceAlphaScale` in GasTest.mat: the `min(alpha * scale, 1)` clamp on space. */
  spaceAlphaScale: 2,
  /** `_BGUVScaleOffset` in GasTest.mat: `.xx` is the world-units detail tiling. */
  backgroundUvScale: 17,
  /** `_FGUVScaleOffset` in GasTest.mat: `.xx` is the world-units detail tiling. */
  foregroundUvScale: 25,
  /**
   * `_GasParameters.x` is not serialised in PropertyTextures.cs, which only
   * creates the material. GasTest's flow phase is produced by
   * FlowOffsetRenderer's transient RT, so it is not recoverable from a save.
   * `abs(x - .5) * 2` therefore stays at the deterministic zero phase, which
   * selects the background detail plane for this deterministic still frame.
   */
  flowPhase: .5,
} as const

/**
 * `liquid.shader` -> the Properties block defaults.
 *
 * These are the shader defaults. PropertyTextures.cs instantiates matLiquid
 * without overriding any Liquid property, so the material falls back to them.
 */
export const ONI_LIQUID_DEFAULTS = {
  /** `_LiquidSelectStart` / `_LiquidSelectRangeNear` / `_LiquidSelectRangeFar`. */
  liquidSelectStart: .438,
  liquidSelectRangeNear: .438,
  liquidSelectRangeFar: .438,
  /** `_LiquidSelectRangeNearOrthoSize` / `_LiquidSelectRangeFarOrthoSize`. */
  liquidSelectRangeNearOrthoSize: .438,
  liquidSelectRangeFarOrthoSize: .438,
  /** LightingSettings.asset: LiquidMaxMass used by PropertyTextures.UpdateLiquid. */
  maxMassKg: 1000,
  /** Visibility. */
  opacity: .77,
  opaqueLiquidsOpacity: .95,
  zoomedOutOpacity: .6,
  zoomedInOpacity: .3,
  zoomedOutOpacityInfluenceRadius: 20,
  zoomedInOpacityInfluenceRadius: 10,
  /** Caustics. */
  causticSpeed: 1.21,
  causticFrequency: .5,
  causticCount: 5,
  causticScale: 1.4,
  /** Surface waves. */
  waveSpeed: 1,
  waveFrequency: 1,
  waveCount: 5,
  waveHeight: 5,
  /** Distortion. */
  distortionStrength: .018,
  distortionFrequency: 1,
  distortionSpeed: 1,
  /** Temperature effects; `_EnableFreezingSqr` = 1 selects the non-linear branch. */
  boilingThreshold: .94,
  freezingThreshold: .1,
  boilOverrideDistortionStrength: .048,
  boilOverrideDistortionFrequency: .84,
  boilOverrideDistortionSpeed: 1.002,
  freezeOverrideSolidColorStrength: .4,
  freezeOverrideOpacityStrength: .6,
  freezeOverrideDistortionStrength: 0,
  freezeOverrideDistortionFrequency: 0,
  freezeOverrideDistortionSpeed: 0,
  /** Molten metals. */
  moltenMetalColor: [1, 1, .3, 1] as const,
  /** Boiling bubbles. */
  airBubbleMinBoilingPointRequired: .7,
  airBubbleLargeMinBoilingPointRequired: .85,
  bubbleDistortionStrengthModifier: 7,
  distortionBubblesSample1SizeModifier: 1,
  distortionBubblesSample1SpeedModifier: .9,
  distortionBubblesSample2SizeModifier: 5,
  distortionBubblesSample2SpeedModifier: .3,
  airBubblesSample1MaxOpacity: 1,
  airBubblesSample2MaxOpacity: 1,
  airBubblesSample1SizeModifier: .83333,
  airBubblesSample1SpeedModifier: 1,
  airBubblesSample2SizeModifier: 1.25,
  airBubblesSample2SpeedModifier: 1.1,
} as const

/**
 * `LiquidShaderProperties.asset` -> the `_TextureScrollSpeeds[64]` uniform.
 *
 * liquid.shader indexes `_TextureScrollSpeeds[layer]`, so entry i is the scroll
 * speed of substance texture layer i. Layers past the eleven serialised entries
 * stay at zero, which is what a freshly allocated float[64] holds in the game.
 */
export const ONI_LIQUID_TEXTURE_SCROLL_SPEEDS: readonly number[] = (() => {
  const speeds = new Array<number>(64).fill(0)
  const serialised = [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.01, -0.01, -0.02, -0.02, -0.02]
  serialised.forEach((speed, index) => { speeds[index] = speed })
  return speeds
})()

/**
 * `substance.shader` alpha-test branch: `0.600000024 >= alpha` discards.
 * The constant is the same in both the MATTE and SHINY variants.
 */
export const ONI_SUBSTANCE_ALPHA_TEST_THRESHOLD = .600000024

/**
 * `gasSteam01.png` / `skullgas.png` are the textures `GasTest.mat` binds to
 * `_GasDetailTex` and `_BadGasTex`. Both use `m_Scale = (2, 2)`, which the
 * shader applies through the `v_world / _FGUVScaleOffset.xx` tiling.
 */
export const ONI_GAS_DETAIL_TEXTURE_KEY = '/assets/render/gasSteam01.png'
export const ONI_GAS_BAD_GAS_TEXTURE_KEY = '/assets/render/skullgas.png'

/** Substance.shader's `_MainTex`/`_AlphaTestMap` neighbours, keyed by renderer input. */
export const ONI_MELT_TEXTURE_KEY = '/assets/render/melt.png'
export const ONI_MUD_MELT_TEXTURE_KEY = '/assets/render/mudmelt.png'
export const ONI_CRACK_ALPHA_TEXTURE_KEY = '/assets/render/crackAlpha.png'
