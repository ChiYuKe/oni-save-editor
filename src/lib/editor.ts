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
