import { ByteReader } from './binary'
import { component, member } from './editor'
import type { SavedObjectInstance } from './model'
import type { ParsedSave } from './save'
import { readOniMachineData, readOniStateMachines } from './oniStateMachines'
import type { SpaceTreeVisual } from './oniSpaceTree'

function growth(instance: SavedObjectInstance): number {
  const bytes = component(instance, 'Klei.AI.Modifiers')?.details
  if (!bytes) return 0
  try {
    const reader = new ByteReader(bytes), count = reader.readI32()
    if (count < 0 || count > 1024) return 0
    for (let i = 0; i < count; i++) {
      const name = reader.readKleiString(), data = reader.readBytes(reader.readI32())
      // TUNING.CROPS.WoodLog: 2700 seconds / 600 seconds per cycle.
      if (name === 'Maturity' && data.length === 4) return Math.max(0, Math.min(1, new ByteReader(data).readF32() / 4.5))
    }
  } catch { /* Missing growth data uses the beginning of the grow bank. */ }
  return 0
}

/** ForestTreeBranchConfig assigns one of seven directional banks at the trunk origin. */
export function forestTreeVisuals(save: ParsedSave): Map<SavedObjectInstance, SpaceTreeVisual | null> {
  const result = new Map<SavedObjectInstance, SpaceTreeVisual | null>()
  const trunks = new Map<number, SavedObjectInstance>()
  const machines = (instance: SavedObjectInstance) => readOniStateMachines(component(instance, 'StateMachineController')?.details)
  const visual = (instance: SavedObjectInstance, prefix: string, state: string, offsetX = 0, offsetY = 0): SpaceTreeVisual | null => {
    if (/(?:^|\.)dead(?:\.|$)/.test(state)) return null
    const progress = growth(instance)
    let bank: string
    let frame = ''
    if (/wilting|wiltRecover|blighted/.test(state)) bank = `${prefix}wilt${progress < .75 ? 1 : progress < 1 ? 2 : 3}`
    else if (state.endsWith('.fruiting')) bank = `${prefix}idle_full`
    else if (state.endsWith('.pre_fruiting')) bank = `${prefix}grow_pst`
    else if (state.endsWith('.harvest')) bank = `${prefix}harvest`
    else {
      bank = `${prefix}grow`
      const count = prefix ? 37 : 61
      const grown = machines(instance).some(machine => machine.typeName === 'Growing+StatesInstance' && machine.currentState.startsWith('root.grown.'))
      frame = `__${Math.min(count - 1, Math.floor((grown ? 1 : progress) * count))}`
    }
    return { key: `tree__${bank}${frame}`, offsetX, offsetY }
  }
  for (const instance of save.manager?.groups.find(group => group.tag === 'ForestTree')?.instances ?? []) {
    const id = member(component(instance, 'KPrefabID')?.value, 'InstanceID')?.value
    if (id?.kind === 'int32') trunks.set(id.v, instance)
    const state = machines(instance).find(machine => machine.typeName === 'StandardCropPlant+StatesInstance')?.currentState ?? ''
    result.set(instance, visual(instance, '', state))
  }
  for (const instance of save.manager?.groups.find(group => group.tag === 'ForestTreeBranch')?.instances ?? []) {
    result.set(instance, null)
    const states = machines(instance)
    const machine = states.find(machine => machine.typeName === 'PlantBranch+Instance')
    const reference = machine ? readOniMachineData(machine, save.templates).parameters.get('Trunk') : undefined
    const parent = reference?.length === 4 ? trunks.get(new ByteReader(reference).readI32()) : undefined
    if (!parent) continue
    const dx = Math.round(instance.position.x - parent.position.x), dy = Math.round(instance.position.y - parent.position.y)
    const letter = ({ '-1,0': 'a', '-1,1': 'b', '-1,2': 'c', '0,2': 'd', '1,2': 'e', '1,1': 'f', '1,0': 'g' } as Record<string, string>)[`${dx},${dy}`]
    if (!letter) continue
    const state = states.find(machine => machine.typeName === 'StandardCropPlant+StatesInstance')?.currentState ?? ''
    result.set(instance, visual(instance, `branch_${letter}_`, state, -dx, dy))
  }
  return result
}
