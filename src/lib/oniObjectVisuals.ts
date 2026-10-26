import type { SavedObjectInstance } from './model'
import { BUILDING_TAG_ALIASES, oniBuildingDefinitionForSaveTag } from './oniObjectPlacement'
import { ONI_GEYSER_IMAGE_SIZES } from './oniGeyserImageSizes.generated'

export type SpriteDefinition = {
  path: string
  widthCells: number
  heightCells?: number
  anchorOffsetXCells?: number
  anchorOffsetYCells?: number
  verticalOffsetCells?: number
}
function geyserAsset(fileName: string, widthCells: number): SpriteDefinition {
  const isGasGeyser = fileName.startsWith('geyser_gas_') || /^geyser_side_(chlorine|methane|steam)_/.test(fileName)
  const size = ONI_GEYSER_IMAGE_SIZES[fileName]
  return { path: `/assets/geysers/${fileName}`, widthCells, heightCells: size ? widthCells * size[1] / size[0] : widthCells, verticalOffsetCells: isGasGeyser ? 1 : undefined }
}

const GEYSER_TEXTURES: Record<string, SpriteDefinition> = {
  gas_chlorine: geyserAsset('geyser_gas_chlorine_0_ui_False.png', 3.2),
  gas_co2_hot: geyserAsset('geyser_gas_co2_hot_0_ui_False.png', 3.2),
  gas_hydrogen_hot: geyserAsset('geyser_gas_hydrogen_hot_0_ui_False.png', 3.2),
  gas_methane: geyserAsset('geyser_gas_methane_0_ui_False.png', 3.2),
  gas_po2_hot: geyserAsset('geyser_gas_po2_hot_0_ui_False.png', 3.2),
  gas_po2_slimy: geyserAsset('geyser_gas_po2_slimy_0_ui_False.png', 3.2),
  gas_steam: geyserAsset('geyser_gas_steam_0_ui_False.png', 3.2),
  gas_steam_hot: geyserAsset('geyser_gas_steam_hot_0_ui_False.png', 3.2),
  liquid_co2: geyserAsset('geyser_liquid_co2_0_ui_False.png', 4),
  liquid_murky_brine: geyserAsset('geyser_liquid_murkybrine_0_ui_False.png', 4),
  liquid_oil: geyserAsset('geyser_liquid_oil_0_ui_False.png', 4),
  liquid_salt_water: geyserAsset('geyser_liquid_salt_water_0_ui_False.png', 4),
  liquid_salt_water_cool_slush: geyserAsset('geyser_liquid_salt_water_cool_slush_0_ui_False.png', 4),
  liquid_sulfur: geyserAsset('geyser_liquid_sulfur_0_ui_False.png', 4),
  liquid_water_filthy: geyserAsset('geyser_liquid_water_filthy_0_ui_False.png', 4),
  liquid_water_hot: geyserAsset('geyser_liquid_water_hot_0_ui_False.png', 4),
  liquid_water_slush: geyserAsset('geyser_liquid_water_slush_0_ui_False.png', 4),
  molten_aluminum: geyserAsset('geyser_molten_aluminum_0_ui_False.png', 4),
  molten_cobalt: geyserAsset('geyser_molten_cobalt_0_ui_False.png', 4),
  molten_copper: geyserAsset('geyser_molten_copper_0_ui_False.png', 4),
  molten_gold: geyserAsset('geyser_molten_gold_0_ui_False.png', 4),
  molten_iron: geyserAsset('geyser_molten_iron_0_ui_False.png', 4),
  molten_niobium: geyserAsset('geyser_molten_niobium_0_ui_False.png', 4),
  molten_tungsten: geyserAsset('geyser_molten_tungsten_0_ui_False.png', 4),
  molten_volcano_big: geyserAsset('geyser_molten_volcano_big_0_ui_False.png', 4),
  molten_volcano_small: geyserAsset('geyser_molten_volcano_small_0_ui_False.png', 4),
  oil_cap: geyserAsset('geyser_oil_cap_0_ui_False.png', 3.8),
  reef: geyserAsset('geyser_reef_0_ui_False.png', 4.2),
  side_chlorine: geyserAsset('geyser_side_chlorine_0_ui_False.png', 4.4),
  side_methane: geyserAsset('geyser_side_methane_0_ui_False.png', 4.4),
  side_oil: geyserAsset('geyser_side_oil_0_ui_False.png', 4.4),
  side_steam: geyserAsset('geyser_side_steam_0_ui_False.png', 4.4),
  aquatic_brackene_fountain: geyserAsset('aquatic_brackene_fountain_0_ui_False.png', 2.8),
}

const GEYSER_TAG_ALIASES: Record<string, string> = {
  big_volcano: 'molten_volcano_big', chlorine_gas_cool: 'gas_chlorine', chlorine_gas: 'gas_chlorine',
  filthy_water: 'liquid_water_filthy', hot_co2: 'gas_co2_hot', hot_hydrogen: 'gas_hydrogen_hot',
  hot_steam: 'gas_steam_hot', hot_water: 'liquid_water_hot', murky_brine: 'liquid_murky_brine',
  methane: 'gas_methane', oil_drip: 'oil_cap', salt_water_cool_slush: 'liquid_salt_water_cool_slush',
  slush_salt_water: 'liquid_salt_water_cool_slush', slush_water: 'liquid_water_slush', slimy_po2: 'gas_po2_slimy',
  small_volcano: 'molten_volcano_small', steam: 'gas_steam', salt_water: 'liquid_salt_water',
}

export function geyserTextureForTag(tag: string): SpriteDefinition | undefined {
  const normalized = tag.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
  if (normalized === 'smallreefgeyser') return GEYSER_TEXTURES.reef
  if (normalized === 'geyser') return GEYSER_TEXTURES.side_steam
  if (normalized === 'chlorinegeyser') return GEYSER_TEXTURES.side_chlorine
  if (normalized === 'methanegeyser') return GEYSER_TEXTURES.side_methane
  if (normalized === 'oilwell') return GEYSER_TEXTURES.side_oil
  if (normalized === 'niobiumgeyser') return GEYSER_TEXTURES.molten_niobium
  if (/(aquatic|brackene).*(fountain|geyser)|(fountain|geyser).*(aquatic|brackene)/.test(normalized)) return GEYSER_TEXTURES.aquatic_brackene_fountain
  const key = normalized.replace(/^geysergeneric_/, '')
  return GEYSER_TEXTURES[GEYSER_TAG_ALIASES[key] ?? key]
}

export function buildingTextureLookupKeys(tag: string): string[] {
  const key = tag.trim().toLowerCase()
  const alias = BUILDING_TAG_ALIASES[key]
  const definition = oniBuildingDefinitionForSaveTag(tag)
  const animation = definition?.animation.replace(/_kanim$/i, '').toLowerCase()
  return [...new Set([`${key}__prefab`, definition ? `${definition.id.toLowerCase()}__prefab` : undefined, key, alias, definition?.id.toLowerCase(), animation].filter((item): item is string => Boolean(item)))]
}

export function buildingTextureForInstance(tag: string, instance: SavedObjectInstance, manifest: Record<string, SpriteDefinition>): SpriteDefinition | undefined {
  const definition = oniBuildingDefinitionForSaveTag(tag)
  const animation = definition?.animation.replace(/_kanim$/i, '').toLowerCase()
  const door = instance.components.find((item) => item.typeName.split(/[.+]/).pop()?.toLowerCase() === 'door')
  if (animation && door) {
    const controlState = door.value?.members.find((item) => item.name === 'controlState')?.value
    const state = controlState?.kind === 'enum' || controlState?.kind === 'int32' || controlState?.kind === 'uint32'
      ? controlState.v === 1 ? 'open' : controlState.v === 2 ? 'locked' : 'closed'
      : 'closed'
    const stateTexture = manifest[`${animation}__${state}`] ?? (state === 'locked' ? manifest[`${animation}__closed`] : undefined)
    if (stateTexture) return stateTexture
  }
  return buildingTextureLookupKeys(tag).map((key) => manifest[key]).find((item): item is SpriteDefinition => Boolean(item))
}

export function hasSimpleComponent(instance: SavedObjectInstance, typeName: string): boolean {
  const expected = typeName.toLowerCase()
  return instance.components.some((item) => item.typeName.split(/[.+]/).pop()?.toLowerCase() === expected)
}

export function isGeyserInstance(groupTag: string, instance: SavedObjectInstance, texture: SpriteDefinition | undefined): boolean {
  return Boolean(texture) || /geyser|fountain/i.test(groupTag) || instance.components.some((item) => /(?:^|[.+])geyser(?:$|[.+])/i.test(item.typeName))
}

