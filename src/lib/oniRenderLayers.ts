/** Painter order from Grid.SceneLayer: Gas=2, objects=3..27, Liquid=28, Ground=29.
 * Used by the retained map scene and its layer lifecycle.
 */
export const ONI_CHUNK_LAYERS = [
  'background', 'gas', 'entitiesBack', 'liquid', 'terrain', 'entitiesFront', 'particles', 'light',
] as const
