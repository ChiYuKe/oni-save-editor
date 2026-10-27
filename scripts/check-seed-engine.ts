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
const native=JSON.parse(readFileSync(path.join(directory,'native-geysers.json'),'utf8'))
const save=parseSave(new Uint8Array(readFileSync(path.join(directory,'generated.sav'))))
const data=resourceStatistics(save),size=worldSize(save)
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
 const other=resourceStatistics(parseSave(new Uint8Array(readFileSync(path.join(process.argv[3],'generated.sav')))))
 const signature=(s:typeof data)=>s.geysers.map(g=>[g.typeId,g.x,g.y,g.emitRate,g.eruptDuration,g.idleDuration,g.activeDuration,g.dormantDuration]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 assert.deepEqual(signature(data),signature(other),'Repeated seed must reproduce actual geyser positions and parameters')
 console.log('PASS repeated native generation: identical geyser placement and parameters')
}
