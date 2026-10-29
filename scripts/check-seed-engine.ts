import {verifyNativeSeed} from '../src/lib/oniSeedVerification'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {parseSave} from '../src/lib/save'
import {resourceStatistics} from '../src/lib/oniResourceStatistics'
import {worldSize} from '../src/lib/editor'

const directory=process.argv[2]
const expected=JSON.parse(readFileSync(path.join(directory,'request.json'),'utf8'))
const status=JSON.parse(readFileSync(path.join(directory,'progress.json'),'utf8'))
assert.equal(status.status,'complete')
if(expected.options){
 const snapshot=JSON.parse(readFileSync(path.join(directory,'native-geysers.json'),'utf8'))
 for(const group of ['quality','stories','mixing'])for(const choice of expected.options[group]??[]){
  assert.equal(snapshot.appliedOptions[group].find((item:{id:string})=>item.id===choice.id)?.value,choice.value,`Native engine must apply ${group}.${choice.id}`)
 }
 console.log('PASS requested options match applied native settings')
}
const native=JSON.parse(readFileSync(path.join(directory,'native-geysers.json'),'utf8'))
const save=parseSave(new Uint8Array(readFileSync(path.join(directory,'generated.sav'))))
const data=resourceStatistics(save),size=worldSize(save)
if(native.worlds) {verifyNativeSeed(save,native);console.log('PASS native world manifest: every planet position, size and source matches the save')}
assert.equal(data.seed,expected.seed||Number(native.coordinate.match(/-(\d+)-/)?.[1]))
assert.equal(data.coordinate,native.coordinate)
assert.equal(data.planets.length,status.worldCount)
assert.ok(size.width>0&&size.height>0&&save.simData)
assert.equal(data.geysers.filter(g=>g.kind==='geyser').length,native.geysers.length,'Every native geyser must be included')
for(const g of native.geysers){
 const match=data.geysers.find(item=>item.typeId===g.typeId&&Math.abs(item.x-g.x)<.001&&Math.abs(item.y-g.y)<.001)
 assert.ok(match,`native geyser ${g.typeId} at ${g.x},${g.y}`)
 assert.notEqual(match.planetId,-1)
 for(const field of ['emitRate','eruptDuration','idleDuration','activeDuration','dormantDuration','temperature'] as const){
   assert.ok(Math.abs(match[field]!-g[field])<=Math.max(.001,Math.abs(g[field])*1e-5),`${field}: parsed ${match[field]} vs native API ${g[field]}`)
 }
}
console.log(`PASS native engine ${data.seed}: ${size.width}x${size.height}, ${data.planets.length} planets, ${native.geysers.length} geysers; all positions, yields, dormancy and temperatures match game API`)
if(process.argv[3]){
 const otherSave=parseSave(new Uint8Array(readFileSync(path.join(process.argv[3],'generated.sav'))))
 const other=resourceStatistics(otherSave)
 const signature=(s:typeof data)=>s.geysers.map(g=>[g.typeId,g.x,g.y,g.emitRate,g.eruptDuration,g.idleDuration,g.activeDuration,g.dormantDuration,g.temperature]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 assert.deepEqual(signature(data),signature(other),'Repeated seed must reproduce actual geyser positions and parameters')
 console.log('PASS repeated native generation: identical geyser placement and parameters')
 if(process.argv.includes('--report-grid')){
   const a=save.simData!,b=otherSave.simData!
   assert.equal(a.cellCount,b.cellCount)
   // Compare actual terrain and fluids, not timestamps, object IDs or random names.
   const av=new DataView(a.bytes.buffer,a.bytes.byteOffset,a.bytes.byteLength),bv=new DataView(b.bytes.buffer,b.bytes.byteOffset,b.bytes.byteLength)
   let changedElements=0,changedTemperature=0,changedMass=0
   for(let i=0;i<a.cellCount;i++){
     const ao=a.cellOffset+i*16,bo=b.cellOffset+i*16
     if(av.getInt32(ao,true)!==bv.getInt32(bo,true))changedElements++
     if(av.getFloat32(ao+4,true)!==bv.getFloat32(bo+4,true))changedTemperature++
     if(av.getFloat32(ao+8,true)!==bv.getFloat32(bo+8,true))changedMass++
   }
   // Native Sim settling can differ between fresh runs even before optimization.
   // Report these diagnostics separately; do not claim bitwise fluid determinism.
   console.log('Native grid diagnostics (not an equivalence assertion):', {cells:a.cellCount,changedElements,changedTemperature,changedMass})
 }
}
