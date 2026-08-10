import { readFileSync } from 'node:fs'
import { parseSave } from '../src/lib/save'
import type { Value } from '../src/lib/model'
import { oniLightDefinitionForTag } from '../src/lib/oniLighting'
import { oniStateMachineState, readOniStateMachines } from '../src/lib/oniStateMachines'

const summaryOnly = process.argv.includes('--summary')
const tagIndex = process.argv.indexOf('--tag')
const tagFilter = tagIndex >= 0 ? process.argv[tagIndex + 1]?.toLowerCase() : undefined
const paths = process.argv.slice(2).filter((argument, index, all) => argument !== '--summary' && argument !== '--tag' && all[index - 1] !== '--tag')
if (paths.length === 0) {
  console.error('Usage: npx tsx scripts/inspect-oni-light-state.ts <save.sav> [...]')
  process.exit(1)
}

const candidates = /light|lamp|bulb|bubble|fallingwater|campfire|headquarters|megabrain|pinkrock|techunlock|artifact|glow|sun|mercury/i

function printable(value: Value, depth = 0): unknown {
  if (depth > 4) return '…'
  if ('v' in value) return typeof value.v === 'bigint' ? value.v.toString() : value.v
  if (value.kind === 'vector2' || value.kind === 'vector2i') return { x: value.x, y: value.y }
  if (value.kind === 'vector3') return { x: value.x, y: value.y, z: value.z }
  if (value.kind === 'colour') return { r: value.r, g: value.g, b: value.b, a: value.a }
  if (value.kind === 'object') return Object.fromEntries(value.members.map((item) => [item.name, printable(item.value, depth + 1)]))
  if (value.kind === 'list') return value.items.map((item) => printable(item, depth + 1))
  if (value.kind === 'dict') return value.keys.map((key, index) => [printable(key, depth + 1), printable(value.values[index], depth + 1)])
  return value.kind
}

function scalar(value: Value | undefined): number | undefined {
  return value && 'v' in value && typeof value.v === 'number' ? value.v : undefined
}

function activeTime(instance: NonNullable<ReturnType<typeof parseSave>['manager']>['groups'][number]['instances'][number]): number {
  const operational = instance.components.find((component) => component.typeName.split(/[.+]/).pop()?.toLowerCase() === 'operational')?.value
  return scalar(operational?.members.find((item) => item.name === 'activeTime')?.value) ?? 0
}

function lightEnabled(instance: NonNullable<ReturnType<typeof parseSave>['manager']>['groups'][number]['instances'][number], requiresActive: boolean): boolean {
  if (!requiresActive) return true
  const controller = instance.components.find((component) => component.typeName.split(/[.+]/).pop()?.toLowerCase() === 'statemachinecontroller')
  const state = oniStateMachineState(controller?.details, 'LightController')
  return state ? /(?:^|\.)on$/i.test(state) : activeTime(instance) > 0
}

for (const path of paths) {
  const save = parseSave(readFileSync(path))
  if (summaryOnly) {
    const lights = (save.manager?.groups ?? []).flatMap((group) => {
      const definition = oniLightDefinitionForTag(group.tag)
      if (!definition) return []
      return group.instances.map((instance) => ({
        tag: group.tag,
        enabled: lightEnabled(instance, definition.requiresActive),
        x: instance.position.x,
        y: instance.position.y,
        shape: definition.shape,
      }))
    })
    const counts = new Map<string, { total: number; enabled: number }>()
    for (const light of lights) {
      const count = counts.get(light.tag) ?? { total: 0, enabled: 0 }
      count.total++
      if (light.enabled) count.enabled++
      counts.set(light.tag, count)
    }
    console.log(JSON.stringify({
      path,
      total: lights.length,
      enabled: lights.filter((light) => light.enabled).length,
      tags: Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right))),
    }))
    continue
  }
  console.log(`\n# ${path}`)
  for (const group of save.manager?.groups ?? []) {
    if (tagFilter && group.tag.toLowerCase() !== tagFilter) continue
    const matching = group.instances.filter((instance) => candidates.test(group.tag)
      || instance.components.some((component) => candidates.test(component.typeName)))
    if (matching.length === 0) continue
    console.log(`\n${group.tag} (${matching.length}/${group.instances.length})`)
    matching.slice(0, 4).forEach((instance, index) => {
      const interesting = instance.components.filter((component) => /light|bubble|fallingwater|operational|controller|artifact|campfire|states|kprefabid|energyconsumer|buildingcomplete/i.test(component.typeName))
      console.log(JSON.stringify({
        index,
        position: instance.position,
        components: interesting.map((component) => ({ type: component.typeName, value: component.value ? printable(component.value) : null, states: component.typeName.endsWith('StateMachineController') ? readOniStateMachines(component.details) : undefined })),
      }, null, 2))
    })
  }
}
