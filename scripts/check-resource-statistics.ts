import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {parseSave,buildSave} from '../src/lib/save'
import {component,member,scalarNumber,scalarText} from '../src/lib/editor'
import {resourceStatistics,resampleGeyserRoll,geyserSeason} from '../src/lib/oniResourceStatistics'
import {ONI_GEYSER_TYPES} from '../src/lib/oniResourceData.generated'
import type {SavedObjectInstance,ObjectValue,Value} from '../src/lib/model'
const save=parseSave(new Uint8Array(readFileSync(process.argv[2])))
const digest=()=>createHash('sha256').update(buildSave(save)).digest('hex'),before=digest()
const data=resourceStatistics(save)
assert.ok(data.planets.length>0);assert.ok(data.geysers.length>0)
for(const p of data.planets){assert.ok(p.name);assert.ok(!p.name.includes('STRINGS.'));assert.ok(!p.type.includes('STRINGS.'))}
let known=0
for(const g of data.geysers){
 const p=data.planets.find(p=>p.id===g.planetId)!
 assert.ok(p,'every spring is assigned to a planet')
 if(g.planetId!==-1){assert.ok(g.x>=p.x&&g.x<p.x+p.width);assert.ok(g.y>=p.y&&g.y<p.y+p.height)}
 if(g.kind==='circulator'){assert.equal(g.averageRate,undefined);assert.equal(g.massPerCycle,undefined);continue}
 const o=save.manager!.groups.find(group=>group.tag===g.tag)!.instances[g.index]
 const c=member(component(o,'Geyser')?.value,'configuration')?.value as ObjectValue
 const n=(name:string)=>scalarNumber(member(c,name)?.value)!
 if(g.parameterSource==='saved'){
  known++;assert.ok(Math.abs(g.emitRate!-n('scaledRate')/600/n('scaledIterationPercent'))<1e-9)
  assert.ok(Math.abs(g.averageRate!-n('scaledRate')/600*n('scaledYearPercent'))<1e-9)
  assert.ok(Math.abs(g.eruptDuration!+g.idleDuration!-g.iterationLength!)<1e-8)
  assert.ok(Math.abs(g.activeDuration!+g.dormantDuration!-g.yearLength!)<1e-8)
 }
}
assert.ok(known>0)
assert.ok(!data.geysers.some(g=>g.tag==='OilWell'),'oil reservoirs are not geysers')
const w=save.manager!.groups.flatMap(g=>g.instances).find(i=>component(i,'AsteroidGridEntity'))
if(w){const n=scalarText(member(component(w,'AsteroidGridEntity')?.value,'m_name')?.value);assert.equal(data.planets[0].name,n)}
assert.deepEqual(geyserSeason(10,100,60),{activity:'active',remainingSeason:50})
assert.deepEqual(geyserSeason(60,100,60),{activity:'dormant',remainingSeason:40})
assert.deepEqual(geyserSeason(100,100,60),{activity:'active',remainingSeason:60})
assert.deepEqual(geyserSeason(50,100,0),{activity:'dormant',remainingSeason:undefined})
assert.deepEqual(geyserSeason(50,100,100),{activity:'active',remainingSeason:undefined})
assert.equal(resampleGeyserRoll(.5,1000,2000),1500)
assert.ok(Math.abs(resampleGeyserRoll(0,1000,2000)-1000)<.01)
assert.ok(Math.abs(resampleGeyserRoll(1,1000,2000)-2000)<.01)
assert.ok(Math.abs(resampleGeyserRoll(.2,1000,2000)-1200)>100,'native rolls must not use a linear interpolation')
const object=(fields:Record<string,Value>):ObjectValue=>({kind:'object',typeName:'Test',members:Object.entries(fields).map(([name,value])=>({name,value,type:{} as never}))})
const single=(v:number):Value=>({kind:'single',v})
const steam=ONI_GEYSER_TYPES.find(t=>t.id==='steam')!
const conf=object({typeId:object({hash:{kind:'int32',v:steam.hash}}),scaledRate:single(1800),scaledIterationLength:single(600),scaledIterationPercent:single(.5),scaledYearLength:single(60000),scaledYearPercent:single(.6)})
const instance:SavedObjectInstance={position:{x:data.planets[0].x+10,y:data.planets[0].y+10,z:0},rotation:{x:0,y:0,z:0,w:1},scale:{x:1,y:1,z:1},flag:0,components:[{typeName:'Geyser',value:object({configuration:conf,serializedTimeShift:single(0)}),length:0,details:null,raw:null}]}
const synthetic=()=>({...save,manager:{...save.manager!,groups:[...save.manager!.groups.filter(g=>g.tag==='Asteroid'||g.tag==='SaveGame'),{tag:'TestModSpring',count:1,byteLength:0,instances:[instance]}]}})
let g=resourceStatistics(synthetic()).geysers[0]
assert.equal(g.emitRate,6);assert.ok(Math.abs(g.averageRate!-1.8)<1e-12);assert.equal(g.massPerCycle,1080)
conf.members=object({typeId:object({hash:{kind:'int32',v:steam.hash}}),rateRoll:single(.5),iterationLengthRoll:single(.5),iterationPercentRoll:single(.5),yearLengthRoll:single(.5),yearPercentRoll:single(.5)}).members
g=resourceStatistics(synthetic()).geysers[0];assert.equal(g.parameterSource,'rolls');assert.ok(Math.abs(g.averageRate!-1.5)<1e-9)
conf.members=object({typeId:object({hash:{kind:'int32',v:123}})}).members
g=resourceStatistics(synthetic()).geysers[0];assert.equal(g.averageRate,undefined);assert.equal(g.temperature,undefined);assert.equal(g.activity,'unknown')
assert.equal(digest(),before,'resource inspection must not modify the save')
console.log(`PASS ${data.planets.length} saved planet names, ${data.geysers.length} springs, ${known} instance-specific yields, native sampling, dormancy boundaries, unknown mods, circulation exclusion and read-only save`)
console.log(JSON.stringify({seed:data.seed,planets:data.planets.map(p=>({name:p.name,type:p.type,count:data.geysers.filter(g=>g.planetId===p.id).length})),sample:data.geysers.find(g=>g.kind==='geyser')}))
