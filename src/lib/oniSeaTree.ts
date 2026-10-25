import { ByteReader } from './binary'
import { component, member } from './editor'
import type { SavedObjectInstance } from './model'
import type { ParsedSave } from './save'
import { readOniMachineData, readOniStateMachines } from './oniStateMachines'
import type { SpaceTreeVisual } from './oniSpaceTree'

function maturities(instance: SavedObjectInstance): [number, number] {
  const result: [number, number] = [0, 0]
  const bytes = component(instance, 'Klei.AI.Modifiers')?.details
  if (!bytes) return result
  try {
    const r = new ByteReader(bytes), count = r.readI32()
    if (count < 0 || count > 1024) return result
    for (let i = 0; i < count; i++) {
      const name = r.readKleiString(), data = r.readBytes(r.readI32())
      if ((name === 'Maturity' || name === 'Maturity2') && data.length === 4) {
        const value = new ByteReader(data).readF32() / 3 // Native branch and fruit both take three cycles.
        result[name === 'Maturity' ? 0 : 1] = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
      }
    }
  } catch { /* Missing amounts retain the initial growth frame. */ }
  return result
}
const wilt = (p: number) => p < .75 ? 1 : p < 1 ? 2 : 3
const growthFrame = (p: number) => Math.min(4, Math.floor(p * 5))
// MeterController.MinMaxStepLerp reserves the first and last frames for endpoints.
const fruitFrame = (p: number) => p <= 0 ? 0 : p >= 1 ? 4 : Math.floor(1 + p * 3)

/** SeaTree branches remain at their own cell; fruit follows bulb_meter_target. */
export function seaTreeVisuals(save: ParsedSave): Map<SavedObjectInstance, SpaceTreeVisual | null> {
  const result = new Map<SavedObjectInstance, SpaceTreeVisual | null>()
  const roots = new Set<number>()
  const machines = (o: SavedObjectInstance) => readOniStateMachines(component(o, 'StateMachineController')?.details)
  const visual = (bank: string): SpaceTreeVisual => ({ key: `sea_fairy_plant__${bank}`, offsetX: 0, offsetY: 0 })
  for (const root of save.manager?.groups.find(g => g.tag === 'SeaTree')?.instances ?? []) {
    const id = member(component(root, 'KPrefabID')?.value, 'InstanceID')?.value
    const state = machines(root).find(m => m.typeName === 'SeaTreeRoot+Instance')?.currentState ?? ''
    if (/(?:^|\.)dead(?:\.|$)/.test(state)) { result.set(root, null); continue }
    if (id?.kind === 'int32') roots.add(id.v)
    result.set(root, visual(state.includes('.wilt') ? 'wilt3' : state.includes('.grown') ? 'idle_full' : state.endsWith('.growing_pst') ? 'grow_pst' : 'grow__15'))
  }
  for (const branch of save.manager?.groups.find(g => g.tag === 'SeaTreeBranch')?.instances ?? []) {
    result.set(branch, null)
    const machine = machines(branch).find(m => m.typeName === 'SeaTreeBranch+Instance')
    if (!machine || /(?:^|\.)dead(?:\.|$)/.test(machine.currentState)) continue
    const parameters = readOniMachineData(machine, save.templates).parameters
    const int = (name: string) => { const b = parameters.get(name); return b?.length === 4 ? new ByteReader(b).readI32() : 0 }
    if (!roots.has(int('Root')) || parameters.get('MarkedForDeath')?.[0]) continue
    const prefix = int('BranchNumber') >= 8 ? 'end_branch_' : 'branch_'
    const [growth, fruit] = maturities(branch), state = machine.currentState
    const mature = state.startsWith('root.mature.')
    const wilted = state.includes('.wilted')
    let bank = prefix + (wilted ? `wilted${wilt(growth)}` : mature ? 'idle' : `grow__${growthFrame(growth)}`)
    if (mature) {
      bank += '__' + (wilted ? `bulb_meter_wilt${wilt(fruit)}` : state.endsWith('.harvestReady') ? 'bulb_meter_ready' : /\.(harvest|selfHarvestFromOld)$/.test(state) ? 'bulb_meter_birth' : `bulb_meter_grow__${fruitFrame(fruit)}`)
    }
    result.set(branch, visual(bank))
  }
  return result
}
