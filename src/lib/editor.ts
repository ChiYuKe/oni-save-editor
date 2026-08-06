import type {
  MemberValue,
  ObjectValue,
  RawPodValue,
  SavedComponent,
  SavedObjectGroup,
  SavedObjectInstance,
  ScalarValue,
  Value,
} from './model'
import type { ParsedSave } from './save'

export interface WorldSize {
  width: number
  height: number
}

export interface EntityRow {
  index: number
  name: string
  position: { x: number; y: number; z: number }
  components: number
  instance: SavedObjectInstance
}

export function member(object: ObjectValue | null | undefined, name: string): MemberValue | undefined {
  return object?.members.find((item) => item.name === name)
}

export function component(instance: SavedObjectInstance | undefined, typeName: string): SavedComponent | undefined {
  return instance?.components.find((item) => item.typeName === typeName)
}

export function scalarNumber(value: Value | undefined): number | undefined {
  if (!value) return undefined
  switch (value.kind) {
    case 'sbyte':
    case 'byte':
    case 'int16':
    case 'uint16':
    case 'int32':
    case 'uint32':
    case 'single':
    case 'double':
    case 'enum':
      return value.v
    case 'int64':
    case 'uint64':
      return Number(value.v)
    default:
      return undefined
  }
}

export function scalarText(value: Value | undefined): string {
  if (!value) return ''
  switch (value.kind) {
    case 'string': return value.v ?? ''
    case 'boolean': return value.v ? 'true' : 'false'
    case 'int64':
    case 'uint64': return value.v.toString()
    case 'sbyte':
    case 'byte':
    case 'int16':
    case 'uint16':
    case 'int32':
    case 'uint32':
    case 'single':
    case 'double':
    case 'enum': return String(value.v)
    case 'vector2i': return `${value.x}, ${value.y}`
    case 'vector2': return `${value.x.toFixed(2)}, ${value.y.toFixed(2)}`
    case 'vector3': return `${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)}`
    case 'colour': return `rgba(${value.r}, ${value.g}, ${value.b}, ${value.a})`
    case 'null': return 'null'
    case 'object': return value.typeName.split('.').pop() ?? value.typeName
    case 'list': return `${value.items.length} items`
    case 'dict': return `${value.keys.length} entries`
    case 'pair': return 'pair'
    case 'raw-pod': return `${value.count} bytes`
    case 'raw': return 'raw data'
  }
}

export function typeLabel(value: Value | undefined): string {
  if (!value) return 'Unknown'
  if (value.kind === 'object') return value.typeName.split('.').pop() ?? value.typeName
  if (value.kind === 'enum') return 'enum'
  return value.kind
}

export function worldSize(save: ParsedSave): WorldSize {
  const width = scalarNumber(member(save.saveFileRoot, 'WidthInCells')?.value) ?? 0
  const height = scalarNumber(member(save.saveFileRoot, 'HeightInCells')?.value) ?? 0
  return { width, height }
}

export function worldSeed(save: ParsedSave): number | undefined {
  const worldDetail = member(save.gameData, 'worldDetail')?.value
  if (!worldDetail || worldDetail.kind !== 'object') return undefined
  return scalarNumber(member(worldDetail, 'globalWorldSeed')?.value)
    ?? scalarNumber(member(worldDetail, 'globalWorldLayoutSeed')?.value)
    ?? scalarNumber(member(worldDetail, 'globalTerrainSeed')?.value)
}

type CoordinateSetting = {
  id: string
  range: number
  levels: Record<string, number>
}

const OTHER_COORDINATE_SETTINGS: CoordinateSetting[] = [
  { id: 'ImmuneSystem', range: 8, levels: { Default: 0, Strong: 1, Invincible: 2, Weak: 3, Compromised: 4 } },
  { id: 'CalorieBurn', range: 8, levels: { Default: 0, Easy: 1, Disabled: 2, Hard: 3, VeryHard: 4 } },
  { id: 'Morale', range: 8, levels: { Default: 0, Easy: 1, Disabled: 2, Hard: 3, VeryHard: 4 } },
  { id: 'Durability', range: 8, levels: { Default: 0, Reinforced: 1, Indestructible: 2, Flimsy: 3, Threadbare: 4 } },
  { id: 'MeteorShowers', range: 8, levels: { Default: 0, Infrequent: 1, ClearSkies: 2, Intense: 3, Doomed: 4 } },
  { id: 'Radiation', range: 8, levels: { Default: 0, Easier: 1, Easiest: 2, Harder: 3, Hardest: 4 } },
  { id: 'Stress', range: 8, levels: { Default: 0, Optimistic: 1, Indomitable: 2, Pessimistic: 3, Doomed: 4 } },
  { id: 'StressBreaks', range: 5, levels: { Default: 0, Disabled: 1 } },
  { id: 'CarePackages', range: 5, levels: { Enabled: 0, Disabled: 1 } },
  { id: 'Teleporters', range: 5, levels: { Enabled: 0, Disabled: 1 } },
  { id: 'BionicWattage', range: 8, levels: { Default: 0, Easy: 1, VeryEasy: 2, Hard: 3, VeryHard: 4 } },
  { id: 'DemoliorDifficulty', range: 8, levels: { Default: 0, Easy: 1, VeryEasy: 2, Off: 3, Hard: 4, VeryHard: 5 } },
]

const MIXING_COORDINATE_SETTINGS: CoordinateSetting[] = [
  'DLC2_ID',
  'IceCavesMixing',
  'CarrotQuarryMixing',
  'SugarWoodsMixing',
  'CeresAsteroidMixing',
  'DLC3_ID',
  'DLC4_ID',
  'GardenMixing',
  'RaptorMixing',
  'WetlandsMixing',
  'PrehistoricAsteroidMixing',
  'DLC5_ID',
  'BeachMixing',
  'ReefMixing',
  'KelpForestMixing',
  'AbyssMixing',
  'AquaticAsteroidMixing',
].map((id) => ({
  id,
  range: 5,
  levels: id.endsWith('_ID')
    ? ({ Disabled: 0, Enabled: 1 } as Record<string, number>)
    : ({ Disabled: 0, TryMixing: 1, GuranteeMixing: 2, GuaranteeMixing: 2 } as Record<string, number>),
}))

const STORY_COORDINATE_SETTINGS: CoordinateSetting[] = [
  'MegaBrainTank',
  'CreatureManipulator',
  'LonelyMinion',
  'FossilHunt',
  'MorbRoverMaker',
  'HijackHeadquarters',
].map((id) => ({ id, range: 3, levels: { Disabled: 0, Guaranteed: 1 } }))

// Built-in cluster prefixes from the game's worldgen cluster YAML files.
const CLUSTER_COORDINATE_PREFIXES: Record<string, string> = {
  'worldgen::clusters/Badlands': 'BAD-A',
  'worldgen::clusters/BigEmptyCluster': 'BIG-E-A',
  'worldgen::clusters/ForestDefault': 'FRST-A',
  'worldgen::clusters/ForestHot': 'HTFST-A',
  'worldgen::clusters/ForestLush': 'LUSH-A',
  'worldgen::clusters/KleiFest2023': 'KF23-A',
  'worldgen::clusters/Oasis': 'OASIS-A',
  'worldgen::clusters/Oceania': 'OCAN-A',
  'worldgen::clusters/SandstoneDefault': 'SNDST-A',
  'worldgen::clusters/SandstoneFrozen': 'S-FRZ',
  'worldgen::clusters/TinyEmptyCluster': 'TNY-E-A',
  'worldgen::clusters/TinySurface': 'TNY-SURF-A',
  'worldgen::clusters/Volcanic': 'VOLCA',
  'dlc2::clusters/CeresBaseGameCluster': 'CER-A',
  'dlc2::clusters/CeresBaseGameShatteredCluster': 'CERS-A',
  'dlc2::clusters/CeresClassicCluster': 'V-CER-C',
  'dlc2::clusters/CeresClassicShatteredCluster': 'V-CERS-C',
  'dlc2::clusters/CeresSpacedOutCluster': 'CER-C',
  'dlc2::clusters/CeresSpacedOutShatteredCluster': 'M-CERS-C',
  'dlc4::clusters/PrehistoricBaseGameCluster': 'PRE-A',
  'dlc4::clusters/PrehistoricClassicCluster': 'V-PRE-C',
  'dlc4::clusters/PrehistoricShatteredBaseGameCluster': 'PRES-A',
  'dlc4::clusters/PrehistoricShatteredClassicCluster': 'V-PRES-C',
  'dlc4::clusters/PrehistoricSpacedOutCluster': 'PRE-C',
  'dlc5::clusters/AquaticBaseGameCluster': 'AQU-A',
  'dlc5::clusters/AquaticClassicCluster': 'V-AQU-C',
  'dlc5::clusters/AquaticSpacedOutCluster': 'AQU-C',
  'expansion1::clusters/BigEmptyCluster': 'BIG-E-C',
  'expansion1::clusters/ForestStartCluster': 'FRST-C',
  'expansion1::clusters/KleiFest2023Cluster': 'KF23-C',
  'expansion1::clusters/MiniClusterBadlandsStart': 'M-BAD-C',
  'expansion1::clusters/MiniClusterFlippedStart': 'M-FLIP-C',
  'expansion1::clusters/MiniClusterForestFrozenStart': 'M-FRZ-C',
  'expansion1::clusters/MiniClusterMetallicSwampyStart': 'M-SWMP-C',
  'expansion1::clusters/MiniClusterRadioactiveOceanStart': 'M-RAD-C',
  'expansion1::clusters/SandstoneStartCluster': 'SNDST-C',
  'expansion1::clusters/SwampStartCluster': 'SWMP-C',
  'expansion1::clusters/TinyEmptyCluster': 'TNY-E-C',
  'expansion1::clusters/TinyStartCluster': 'TNY-C',
  'expansion1::clusters/TinySurfaceCluster': 'TNY-SURF-C',
  'expansion1::clusters/TwoSmallWorlds': 'TWOWORLD',
  'expansion1::clusters/VanillaArboriaCluster': 'V-FRST-C',
  'expansion1::clusters/VanillaAridioCluster': 'V-HTFST-C',
  'expansion1::clusters/VanillaBadlandsCluster': 'V-BAD-C',
  'expansion1::clusters/VanillaForestCluster': 'V-LUSH-C',
  'expansion1::clusters/VanillaOasisCluster': 'V-OASIS-C',
  'expansion1::clusters/VanillaOceaniaCluster': 'V-OCAN-C',
  'expansion1::clusters/VanillaSandstoneCluster': 'V-SNDST-C',
  'expansion1::clusters/VanillaSandstoneFrozenCluster': 'V-SFRZ-C',
  'expansion1::clusters/VanillaSwampCluster': 'V-SWMP-C',
  'expansion1::clusters/VanillaVolcanicCluster': 'V-VOLCA-C',
}

function objectValue(object: ObjectValue | undefined, name: string): Value | undefined {
  return member(object, name)?.value
}

function stringDictionary(object: ObjectValue | undefined, name: string): Map<string, string> {
  const value = objectValue(object, name)
  if (!value || value.kind !== 'dict') return new Map()
  const entries = new Map<string, string>()
  for (let index = 0; index < value.keys.length; index++) {
    const key = scalarText(value.keys[index])
    const item = scalarText(value.values[index])
    if (key) entries.set(key, item)
  }
  return entries
}

function currentGameSettings(save: ParsedSave): ObjectValue | undefined {
  const value = objectValue(save.gameData, 'customGameSettings')
  return value?.kind === 'object' ? value : undefined
}

function coordinateValue(setting: CoordinateSetting, level: string | undefined): number {
  return setting.levels[level ?? ''] ?? 0
}

function binaryToBase36(input: bigint): string {
  if (input === 0n) return '0'
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let output = ''
  for (let value = input; value > 0n; value /= 36n) {
    output += chars[Number(value % 36n)]
  }
  return output
}

function encodeCoordinate(settings: CoordinateSetting[], levels: Map<string, string>): string {
  let input = 0n
  for (const setting of settings) {
    input *= BigInt(setting.range)
    input += BigInt(coordinateValue(setting, levels.get(setting.id)))
  }
  return binaryToBase36(input)
}

function storyLevels(save: ParsedSave): Map<string, string> {
  const levels = new Map<string, string>()
  const storySettings = objectValue(save.gameData, 'storySetings')
  const stories = storySettings?.kind === 'object' ? objectValue(storySettings, '_stories') : undefined
  if (!stories || stories.kind !== 'dict') return levels

  for (const story of stories.values) {
    if (story.kind !== 'object') continue
    const storyId = scalarText(objectValue(story, 'storyId'))
    const telemetry = objectValue(story, 'telemetry')
    const retrofitted = telemetry?.kind === 'object' ? scalarNumber(objectValue(telemetry, 'Retrofitted')) : undefined
    if (storyId && retrofitted !== undefined && retrofitted < 0) levels.set(storyId, 'Guaranteed')
  }
  return levels
}

function clusterCoordinatePrefix(clusterLayout: string): string | undefined {
  return CLUSTER_COORDINATE_PREFIXES[clusterLayout]
}

/** Returns the same five-part coordinate shown by the game's seed UI. */
export function worldCoordinate(save: ParsedSave): string | undefined {
  const settings = currentGameSettings(save)
  if (!settings) return undefined
  const qualityLevels = stringDictionary(settings, 'CurrentQualityLevelsBySetting')
  const mixingLevels = stringDictionary(settings, 'CurrentMixingLevelsBySetting')
  const clusterLayout = qualityLevels.get('ClusterLayout')
  const worldgenSeed = qualityLevels.get('WorldgenSeed')
  const prefix = clusterLayout ? clusterCoordinatePrefix(clusterLayout) : undefined
  if (!prefix || !worldgenSeed || !/^\d+$/.test(worldgenSeed)) return undefined

  return [
    prefix,
    worldgenSeed,
    encodeCoordinate(OTHER_COORDINATE_SETTINGS, qualityLevels),
    encodeCoordinate(STORY_COORDINATE_SETTINGS, storyLevels(save)),
    encodeCoordinate(MIXING_COORDINATE_SETTINGS, mixingLevels),
  ].join('-')
}

export function worldGrid(save: ParsedSave, name: string): RawPodValue | undefined {
  const streamed = member(save.saveFileRoot, 'streamed')?.value
  if (!streamed || streamed.kind !== 'dict') return undefined
  const index = streamed.keys.findIndex((key) => key.kind === 'string' && key.v === name)
  const value = index >= 0 ? streamed.values[index] : undefined
  return value?.kind === 'raw-pod' ? value : undefined
}

export function setGridCell(save: ParsedSave, name: string, x: number, y: number, enabled: boolean): boolean {
  const { width, height } = worldSize(save)
  const grid = worldGrid(save, name)
  if (!grid || x < 0 || y < 0 || x >= width || y >= height) return false
  const index = y * width + x
  if (index >= grid.bytes.length) return false
  const bytes = grid.bytes.slice()
  bytes[index] = enabled ? 255 : 0
  grid.bytes = bytes
  return true
}

export function groupByTag(save: ParsedSave, tag: string): SavedObjectGroup | undefined {
  return save.manager?.groups.find((group) => group.tag === tag)
}

export function groupRows(group: SavedObjectGroup | undefined): EntityRow[] {
  if (!group) return []
  return group.instances.map((instance, index) => ({
    index,
    name: objectName(group.tag, instance, index),
    position: instance.position,
    components: instance.components.length,
    instance,
  }))
}

export function objectName(tag: string, instance: SavedObjectInstance, index: number): string {
  const identity = component(instance, 'MinionIdentity')
  const name = scalarText(member(identity?.value, 'name')?.value)
  if (name) return name
  const prefab = component(instance, 'KPrefabID')
  const id = scalarNumber(member(prefab?.value, 'InstanceID')?.value)
  return id === undefined ? `${tag} ${index + 1}` : `${tag} #${id}`
}

export function saveGameInstance(save: ParsedSave): SavedObjectInstance | undefined {
  const group = groupByTag(save, 'SaveGame')
  return group?.instances[0]
}

export function gameValue(save: ParsedSave, componentName: string, memberName: string): Value | undefined {
  const instance = saveGameInstance(save)
  return member(instance?.components.find((item) => item.typeName === componentName)?.value, memberName)?.value
}

export function setValueFromText(value: Value, text: string): boolean {
  const parsed = text.trim()
  if (value.kind === 'string') {
    value.v = text
    return true
  }
  if (value.kind === 'boolean') {
    if (!['true', 'false', '1', '0'].includes(parsed.toLowerCase())) return false
    value.v = parsed === 'true' || parsed === '1'
    return true
  }
  if (value.kind === 'int64' || value.kind === 'uint64') {
    try {
      value.v = BigInt(parsed)
      return true
    } catch {
      return false
    }
  }
  if ('v' in value && typeof value.v === 'number') {
    const number = Number(parsed)
    if (!Number.isFinite(number)) return false
    value.v = number
    return true
  }
  return false
}

export function editableMembers(object: ObjectValue | null | undefined): MemberValue[] {
  return object?.members.filter((item) => isEditable(item.value)) ?? []
}

export function isEditable(value: Value): value is ScalarValue {
  return value.kind === 'string' || value.kind === 'boolean' || value.kind === 'sbyte' || value.kind === 'byte' || value.kind === 'int16' || value.kind === 'uint16' || value.kind === 'int32' || value.kind === 'uint32' || value.kind === 'int64' || value.kind === 'uint64' || value.kind === 'single' || value.kind === 'double' || value.kind === 'enum'
}

export function topGroups(save: ParsedSave): Array<{ tag: string; count: number }> {
  return [...(save.manager?.groups ?? [])]
    .filter((group) => group.instances.length > 0)
    .sort((a, b) => b.instances.length - a.instances.length)
    .map((group) => ({ tag: group.tag, count: group.instances.length }))
}

export function formatNumber(value: number | undefined, fractionDigits = 1): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits })
}
