import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ByteWriter } from '../src/lib/binary'
import { spaceTreeVisuals } from '../src/lib/oniSpaceTree'
import { parseSave, type ParsedSave } from '../src/lib/save'
import type { SavedObjectInstance } from '../src/lib/model'

function instance(x: number, y: number, id: number, state: string, parent?: number, fullness = 0): SavedObjectInstance {
  const entry = (type: string, state: string, parameters: [string, number, boolean][]) => {
    const payload = new ByteWriter().writeI32(parameters.length)
    for (const [name, value, float] of parameters) {
      const context = new ByteWriter().writeKleiString('Context').writeKleiString(name)
      if (float) context.writeF32(value); else context.writeI32(value)
      payload.writeI32(context.length).writeRaw(context.bytes)
    }
    return new ByteWriter().writeI32(0).writeKleiString(type).writeKleiString(null).writeKleiString(state).writeI32(payload.length).writeRaw(payload.bytes).bytes
  }
  const entries = parent === undefined
    ? [entry('SpaceTreePlant+Instance', state, [['Fullness', fullness, true]])]
    : [entry('PlantBranch+Instance', 'root', [['Trunk', parent, false]]), entry('SpaceTreeBranch+Instance', state, [])]
  const body = new ByteWriter().writeI32(entries.length)
  for (const bytes of entries) body.writeRaw(bytes)
  const details = new ByteWriter().writeI32(20).writeI32(body.length).writeRaw(body.bytes).bytes
  return { position: { x, y, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 }, flag: 0, components: [
    { typeName: 'KPrefabID', length: 0, details: null, raw: null, value: { kind: 'object', typeName: 'KPrefabID', members: [{ name: 'InstanceID', type: { info: 6, subTypes: [] }, value: { kind: 'int32', v: id } }] } },
    { typeName: 'StateMachineController', length: 0, value: null, raw: null, details },
  ] }
}
const trunks = [instance(10.5, 20.01, 1, 'root.harvest.prevented', undefined, 1), instance(12.5, 20.01, 2, 'root.production.producing', undefined, .25)]
const branches = [instance(11.5, 22.01, 3, 'root.grown.healthy.filling', 2), instance(11.5, 22.01, 4, 'root.grown.healthy.trunkReadyForHarvest.idle', 1), instance(10.5, 22.01, 5, 'root.growing.wild.hidden', 1), instance(9.5, 21.01, 6, 'root.grown.trunkWilted.wilted', 1), instance(10.5, 22.01, 7, 'root.grown.healthy.filling', 999)]
const sapling = instance(20.5, 20.01, 8, 'root.growing.idle')
const amounts = new ByteWriter().writeI32(1).writeKleiString('Maturity').writeI32(4).writeF32(2.25)
sapling.components.push({ typeName: 'Klei.AI.Modifiers', length: amounts.length, value: null, raw: null, details: amounts.bytes })
trunks.push(sapling)
const save = { templates: new Map(), manager: { groups: [{ tag: 'SpaceTree', instances: trunks }, { tag: 'SpaceTreeBranch', instances: branches }] } } as ParsedSave
const visuals = spaceTreeVisuals(save)
assert.equal(visuals.get(sapling)?.key, 'syrup_tree__grow__30')
assert.equal(visuals.get(trunks[0])?.key, 'syrup_tree__harvest_ready')
assert.equal(visuals.get(trunks[1])?.key, 'syrup_tree__grow_fill__10')
assert.deepEqual(visuals.get(branches[0]), { key: 'syrup_tree__grow_fill_branch_c__10', offsetX: 1, offsetY: 2 })
assert.deepEqual(visuals.get(branches[1]), { key: 'syrup_tree__harvest_ready_branch_e', offsetX: -1, offsetY: 2 })
assert.equal(visuals.get(branches[2]), null)
assert.equal(visuals.get(branches[3])?.key, 'syrup_tree__branch_b_wilt')
assert.equal(visuals.get(branches[4]), null)
console.log('PASS saved parent references distinguish overlapping branches, fullness frames, offsets, harvest, wilt, hidden and orphan states')
if (process.argv[2]) {
  const real = parseSave(new Uint8Array(readFileSync(process.argv[2])))
  const manifest = JSON.parse(readFileSync(new URL('../public/assets/buildings/manifest.json', import.meta.url), 'utf8'))
  const resolved = spaceTreeVisuals(real)
  let visible = 0, hidden = 0
  for (const [object, visual] of resolved) {
    if (!visual) { hidden++; continue }
    assert.ok(manifest[visual.key], `Missing sprite ${visual.key}`)
    assert.ok(Number.isFinite(visual.offsetX + visual.offsetY))
    if (visual.offsetY) assert.ok([1, 2].includes(visual.offsetY), JSON.stringify(object.position))
    visible++
  }
  assert.equal(resolved.size, real.manager!.groups.filter(g => ['SpaceTree', 'SpaceTreeBranch'].includes(g.tag)).reduce((sum, g) => sum + g.instances.length, 0))
  console.log(`PASS actual save: ${resolved.size} tree objects, ${visible} visible, ${hidden} hidden; every selected frame exists`)
}

