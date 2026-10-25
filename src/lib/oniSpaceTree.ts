import { ByteReader } from './binary'
import { component, member } from './editor'
import type { SavedObjectInstance } from './model'
import type { ParsedSave } from './save'
import { readOniMachineData, readOniStateMachines } from './oniStateMachines'

export interface SpaceTreeVisual {
  key: string
  offsetX: number
  offsetY: number
}
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
const frameKey = (bank: string, progress?: number) => `syrup_tree__${bank}${progress === undefined ? '' : `__${Math.min(bank === 'grow' ? 60 : 41, Math.floor(clamp(progress) * (bank === 'grow' ? 61 : 42)))}`}`

function maturity(instance: SavedObjectInstance): number {
  const details = component(instance, 'Klei.AI.Modifiers')?.details
  if (!details) return 0
  try {
    const reader = new ByteReader(details)
    const count = reader.readI32()
    if (count < 0 || count > 1024) return 0
    for (let i = 0; i < count; i++) {
      const name = reader.readKleiString()
      const bytes = reader.readBytes(reader.readI32())
      // Native SpaceTree and SpaceTreeBranch both have 2700 s / 600 = 4.5 maturity.
      if (name === 'Maturity' && bytes.length === 4) return clamp(new ByteReader(bytes).readF32() / 4.5)
    }
  } catch { /* Missing amounts display the first growth frame. */ }
  return 0
}

/** Native SpaceTreeBranchConfig composes all five branches at the trunk origin. */
export function spaceTreeVisuals(save: ParsedSave): Map<SavedObjectInstance, SpaceTreeVisual | null> {
  const result = new Map<SavedObjectInstance, SpaceTreeVisual | null>()
  const trunks = new Map<number, { instance: SavedObjectInstance; fullness: number }>()
  const states = (instance: SavedObjectInstance) => readOniStateMachines(component(instance, 'StateMachineController')?.details)
  for (const instance of save.manager?.groups.find(group => group.tag === 'SpaceTree')?.instances ?? []) {
    const machine = states(instance).find(item => item.typeName === 'SpaceTreePlant+Instance')
    const data = machine ? readOniMachineData(machine, save.templates) : undefined
    const bytes = data?.parameters.get('Fullness')
    const fullness = bytes?.length === 4 ? clamp(new ByteReader(bytes).readF32()) : 0
    const id = member(component(instance, 'KPrefabID')?.value, 'InstanceID')?.value
    if (id?.kind === 'int32') trunks.set(id.v, { instance, fullness })
    const state = machine?.currentState ?? ''
    const growing = state.startsWith('root.growing')
    const bank = growing ? state.includes('wilted') ? `wilt${Math.min(3, Math.floor(maturity(instance) * 3) + 1)}` : state.endsWith('complete') ? 'grow_pst' : 'grow'
      : state.includes('wilted') ? 'idle_empty' : state.startsWith('root.harvest.') ? 'harvest_ready' : 'grow_fill'
    result.set(instance, { key: frameKey(bank, bank === 'grow' ? maturity(instance) : bank === 'grow_fill' ? fullness : undefined), offsetX: 0, offsetY: 0 })
  }
  for (const instance of save.manager?.groups.find(group => group.tag === 'SpaceTreeBranch')?.instances ?? []) {
    const machines = states(instance)
    const parentMachine = machines.find(item => item.typeName === 'PlantBranch+Instance')
    const reference = parentMachine ? readOniMachineData(parentMachine, save.templates).parameters.get('Trunk') : undefined
    const parent = reference?.length === 4 ? trunks.get(new ByteReader(reference).readI32()) : undefined
    // An unresolved branch must never fall back to the shared trunk sprite.
    result.set(instance, null)
    if (!parent) continue
    const dx = Math.round(instance.position.x - parent.instance.position.x)
    const dy = Math.round(instance.position.y - parent.instance.position.y)
    const letter = ({ '-1,1': 'b', '-1,2': 'c', '0,2': 'd', '1,2': 'e', '1,1': 'f' } as Record<string, string>)[`${dx},${dy}`]
    if (!letter) continue
    const state = machines.find(item => item.typeName === 'SpaceTreeBranch+Instance')?.currentState ?? ''
    if (!state || /hidden|shaking|selfDelete/.test(state)) continue
    let bank: string
    let progress: number | undefined
    if (state.startsWith('root.growing.')) { bank = `grow_${letter}_healthy_short`; progress = maturity(instance) }
    else if (state === 'root.halt.wilted') { bank = `grow_${letter}_wilt_short`; progress = maturity(instance) }
    else if (state === 'root.halt.trunkWilted') bank = `branch_${letter}_wilt_short`
    else if (state.includes('trunkWilted')) bank = `branch_${letter}_wilt`
    else if (state.includes('trunkReadyForHarvest')) {
      const phase = state.match(/harvestInProgress\.(pre|loop|pst)$/)?.[1]
      bank = phase ? `syrup_harvest_branch_${letter}_${phase}` : `harvest_ready_branch_${letter}`
    }
    else if (state.endsWith('.spawn')) bank = `branch_${letter}_grow`
    else if (state.endsWith('.spawnPST')) bank = `branch_${letter}_grow_pst`
    else if (/harvestedForWood|die.entering/.test(state)) bank = `branch_${letter}_harvest`
    else { bank = `grow_fill_branch_${letter}`; progress = parent.fullness }
    result.set(instance, { key: frameKey(bank, progress), offsetX: -dx, offsetY: dy })
  }
  return result
}
