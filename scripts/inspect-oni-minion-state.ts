import { readFileSync } from 'node:fs'
import { parseSave } from '../src/lib/save'
import type { Value } from '../src/lib/model'

const savePath = process.argv[2]
if (!savePath) throw new Error('Usage: npx tsx scripts/inspect-oni-minion-state.ts <save.sav>')

function jsonValue(value: Value, depth = 0): unknown {
  if (depth > 8) return '<depth-limit>'
  if (value.kind === 'object') return Object.fromEntries(value.members.map((member) => [member.name, jsonValue(member.value, depth + 1)]))
  if (value.kind === 'list') return value.items.map((item) => jsonValue(item, depth + 1))
  if (value.kind === 'dict') return value.keys.map((key, index) => ({ key: jsonValue(key, depth + 1), value: jsonValue(value.values[index], depth + 1) }))
  if (value.kind === 'pair') return { key: jsonValue(value.key, depth + 1), value: jsonValue(value.value, depth + 1) }
  if (value.kind === 'raw-pod') return `<raw-pod:${value.count}>`
  if (value.kind === 'raw') return `<raw:${value.bytes.length}>`
  if (value.kind === 'null') return null
  if (value.kind === 'vector2i' || value.kind === 'vector2' || value.kind === 'vector3' || value.kind === 'colour') return value
  return typeof value.v === 'bigint' ? value.v.toString() : value.v
}

const save = parseSave(new Uint8Array(readFileSync(savePath)))
const minions = save.manager?.groups.find((group) => group.tag === 'Minion')?.instances ?? []
if (process.argv.includes('--wearables')) {
  const names = new Set<string>()
  for (const instance of minions) {
    const wearable = instance.components.find((component) => component.typeName.split(/[.+]/).at(-1) === 'WearableAccessorizer')?.value
    const dictionary = wearable?.members.find((item) => item.name === 'wearables')?.value
    if (dictionary?.kind !== 'dict') continue
    for (const value of dictionary.values) {
      if (value.kind !== 'object') continue
      const animNames = value.members.find((item) => item.name === 'animNames')?.value
      if (animNames?.kind !== 'list') continue
      for (const item of animNames.items) if (item.kind === 'string' && item.v) names.add(item.v)
    }
  }
  console.log(JSON.stringify([...names].sort()))
  process.exit(0)
}
if (process.argv.includes('--accessories')) {
  const guids = new Set<string>()
  for (const instance of minions) {
    const accessorizer = instance.components.find((component) => component.typeName.split(/[.+]/).at(-1) === 'Accessorizer')?.value
    const accessories = accessorizer?.members.find((item) => item.name === 'accessories')?.value
    if (accessories?.kind !== 'list') continue
    for (const item of accessories.items) {
      if (item.kind !== 'object') continue
      const guidRef = item.members.find((member) => member.name === 'guid')?.value
      if (guidRef?.kind !== 'object') continue
      const guid = guidRef.members.find((member) => member.name === 'Guid')?.value
      if (guid?.kind === 'string' && guid.v) guids.add(guid.v)
    }
  }
  console.log(JSON.stringify([...guids].sort()))
  process.exit(0)
}
const interesting = new Set(['MinionIdentity', 'Accessorizer', 'WearableAccessorizer', 'Equipment', 'Facing'])
console.log(JSON.stringify(minions.map((instance, index) => ({
  index,
  position: instance.position,
  components: Object.fromEntries(instance.components
    .filter((component) => interesting.has(component.typeName.split(/[.+]/).at(-1) ?? ''))
    .map((component) => [component.typeName.split(/[.+]/).at(-1), component.value ? jsonValue(component.value) : '<opaque>'])),
})), null, 2))
