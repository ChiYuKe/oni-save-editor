import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ByteWriter } from '../src/lib/binary'
import { seaTreeVisuals } from '../src/lib/oniSeaTree'
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
    ? [entry('SeaTreeRoot+Instance', state, [])]
    : [entry('SeaTreeBranch+Instance', state, [['Root', parent, false], ['BranchNumber', fullness, false]])]
  const body = new ByteWriter().writeI32(entries.length)
  for (const bytes of entries) body.writeRaw(bytes)
  const details = new ByteWriter().writeI32(20).writeI32(body.length).writeRaw(body.bytes).bytes
  return { position: { x, y, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 }, flag: 0, components: [
    { typeName: 'KPrefabID', length: 0, details: null, raw: null, value: { kind: 'object', typeName: 'KPrefabID', members: [{ name: 'InstanceID', type: { info: 6, subTypes: [] }, value: { kind: 'int32', v: id } }] } },
    { typeName: 'StateMachineController', length: 0, value: null, raw: null, details },
  ] }
}
const root=instance(10.5,20.01,1,'root.grown.idle')
const normal=instance(10.5,22.01,2,'root.mature.healthy.harvestReady',1,1)
const tip=instance(10.5,29.01,3,'root.mature.healthy.harvestReady',1,8)
const orphan=instance(10.5,22.01,4,'root.mature.healthy.harvestReady',999,1)
const growing=instance(10.5,23.01,5,'root.undevelopedBranch.growing.wild',1,2)
const wilted=instance(10.5,24.01,6,'root.mature.wilted',1,3)
const dead=instance(10.5,25.01,7,'root.dead',1,4)
function amounts(object: SavedObjectInstance, branch: number, fruit: number) {
 const w=new ByteWriter().writeI32(2)
 for(const [name,value] of [['Maturity',branch],['Maturity2',fruit]] as [string,number][]) w.writeKleiString(name).writeI32(4).writeF32(value)
 object.components.push({typeName:'Klei.AI.Modifiers',length:0,value:null,raw:null,details:w.bytes})
}
amounts(growing,1.5,0);amounts(wilted,3,1.5)
const fruit=instance(10.5,26.01,8,'root.mature.healthy.growing.wild',1,5);amounts(fruit,3,1.5)
const save={templates:new Map(),manager:{groups:[{tag:'SeaTree',instances:[root]},{tag:'SeaTreeBranch',instances:[normal,tip,orphan,growing,wilted,dead,fruit]}]}} as ParsedSave
const visuals=seaTreeVisuals(save)
assert.equal(visuals.get(root)?.key,'sea_fairy_plant__idle_full')
assert.deepEqual(visuals.get(normal),{key:'sea_fairy_plant__branch_idle__bulb_meter_ready',offsetX:0,offsetY:0})
assert.equal(visuals.get(tip)?.key,'sea_fairy_plant__end_branch_idle__bulb_meter_ready')
assert.equal(visuals.get(growing)?.key,'sea_fairy_plant__branch_grow__2')
assert.equal(visuals.get(wilted)?.key,'sea_fairy_plant__branch_wilted3__bulb_meter_wilt1')
assert.equal(visuals.get(fruit)?.key,'sea_fairy_plant__branch_idle__bulb_meter_grow__2')
assert.equal(visuals.get(orphan),null);assert.equal(visuals.get(dead),null)
console.log('PASS SeaTree: root, branch, tip, independent branch/fruit maturity, meter frame interpolation, wilt, orphan and dead')
if(process.argv[2]) {
 const real=parseSave(new Uint8Array(readFileSync(process.argv[2])))
 const manifest=JSON.parse(readFileSync(new URL('../public/assets/buildings/manifest.json',import.meta.url),'utf8'))
 const before=real.simData!.bytes.slice(),resolved=seaTreeVisuals(real)
 assert.equal(resolved.size,243)
 const counts: Record<string,number>={}
 for(const [object,visual] of resolved) {
  assert.ok(visual,JSON.stringify(object.position));assert.ok(manifest[visual.key],visual.key)
  assert.ok(readFileSync(new URL('../public'+manifest[visual.key].path,import.meta.url)).length>0)
  counts[visual.key]=(counts[visual.key]??0)+1
 }
 assert.deepEqual(real.simData!.bytes,before)
 console.log('PASS warehouse: all 50 roots and 193 branches resolved, sprites exist, SIM unchanged',counts)
 console.log('Root coordinates:',real.manager?.groups.find(g=>g.tag==='SeaTree')?.instances.map(o=>[o.position.x,o.position.y]))
}
