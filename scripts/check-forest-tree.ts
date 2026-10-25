import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ByteWriter } from '../src/lib/binary'
import { forestTreeVisuals } from '../src/lib/oniForestTree'
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
    ? [entry('StandardCropPlant+StatesInstance', state, [['Fullness', fullness, true]])]
    : [entry('PlantBranch+Instance', 'root', [['Trunk', parent, false]]), entry('StandardCropPlant+StatesInstance', state, [])]
  const body = new ByteWriter().writeI32(entries.length)
  for (const bytes of entries) body.writeRaw(bytes)
  const details = new ByteWriter().writeI32(20).writeI32(body.length).writeRaw(body.bytes).bytes
  return { position: { x, y, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 }, flag: 0, components: [
    { typeName: 'KPrefabID', length: 0, details: null, raw: null, value: { kind: 'object', typeName: 'KPrefabID', members: [{ name: 'InstanceID', type: { info: 6, subTypes: [] }, value: { kind: 'int32', v: id } }] } },
    { typeName: 'StateMachineController', length: 0, value: null, raw: null, details },
  ] }
}
const trunks=[instance(10.5,20.01,1,'root.alive.fruiting'),instance(12.5,20.01,2,'root.alive.fruiting')]
const branches=[instance(11.5,22.01,3,'root.alive.fruiting',2),instance(11.5,22.01,4,'root.alive.fruiting',1),instance(9.5,20.01,5,'root.alive.wilting',1),instance(10.5,22.01,6,'root.alive.fruiting',999),instance(11.5,21.01,7,'root.dead',1)]
const save={templates:new Map(),manager:{groups:[{tag:'ForestTree',instances:trunks},{tag:'ForestTreeBranch',instances:branches}]}} as ParsedSave
const visuals=forestTreeVisuals(save)
assert.equal(visuals.get(trunks[0])?.key,'tree__idle_full')
assert.deepEqual(visuals.get(branches[0]),{key:'tree__branch_c_idle_full',offsetX:1,offsetY:2})
assert.deepEqual(visuals.get(branches[1]),{key:'tree__branch_e_idle_full',offsetX:-1,offsetY:2})
assert.equal(visuals.get(branches[2])?.key,'tree__branch_a_wilt1')
assert.equal(visuals.get(branches[3]),null);assert.equal(visuals.get(branches[4]),null)
console.log('PASS ForestTree: trunk state, saved references for overlapping branches, native offsets, wilt, orphan and dead states')
if(process.argv[2]) {
 const real=parseSave(new Uint8Array(readFileSync(process.argv[2])))
 const manifest=JSON.parse(readFileSync(new URL('../public/assets/buildings/manifest.json',import.meta.url),'utf8'))
 const before=real.simData!.bytes.slice()
 const resolved=forestTreeVisuals(real)
 assert.equal(resolved.size,94)
 let visible=0
 for(const [object,visual] of resolved) {
  assert.ok(visual,JSON.stringify(object.position))
  assert.ok(manifest[visual.key],visual.key)
  assert.notEqual(visual.key,'tree')
  visible++
 }
 assert.deepEqual(real.simData!.bytes,before)
 console.log(`PASS warehouse save: ${visible} tree objects, all branches resolved and all state sprites present, SIM unchanged`)
}
