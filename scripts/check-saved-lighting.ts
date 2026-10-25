import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ByteWriter } from '../src/lib/binary'
import { savedOniLights } from '../src/lib/oniSavedLighting'
import { parseSave, type ParsedSave } from '../src/lib/save'
import type { SavedObjectInstance } from '../src/lib/model'
function instance(state?: string): SavedObjectInstance {
  const body = new ByteWriter().writeI32(state ? 1 : 0)
  if (state) body.writeI32(0).writeKleiString('LightController+Instance').writeKleiString(null).writeKleiString(state).writeI32(0)
  const details = new ByteWriter().writeI32(20).writeI32(body.length).writeRaw(body.bytes).bytes
  return { position:{x:4.5,y:5.5,z:0}, rotation:{x:0,y:0,z:0,w:1},scale:{x:1,y:1,z:1},flag:0,
    components:[{typeName:'StateMachineController',length:details.length,value:null,raw:null,details}] }
}
const save = {manager:{groups:[{tag:'FloorLamp',instances:[instance('root.on'),instance('root.off'),instance()]},{tag:'LightBug',instances:[instance()]},{tag:'LightBugBlack',instances:[instance()]}]}} as ParsedSave
const lights = savedOniLights(save)
assert.equal(lights.length,2)
assert.equal(lights[0].definition.range,4);assert.equal(lights[1].definition.range,5)
assert.deepEqual([lights[0].x,lights[0].y],[4.5,5.5])
console.log('PASS saved lamps: on/off controller states, missing power state, self-lit creatures, dark variant and position')
if(process.argv[2]) {
 const actual=parseSave(new Uint8Array(readFileSync(process.argv[2])))
 const before=actual.simData!.bytes.slice()
 const resolved=savedOniLights(actual)
 assert.equal(resolved.length,36)
 assert.deepEqual(actual.simData!.bytes,before)
 console.log('PASS warehouse save: 36 enabled sources, disabled fossil light excluded, SIM unchanged')
}
