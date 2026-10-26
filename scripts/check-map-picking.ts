import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createOniMapPicker, cycleMapTarget, mapComponentRows } from '../src/lib/oniMapPicking'
import { buildingPlacementCells, oniBuildingDefinitionForSaveTag } from '../src/lib/oniObjectPlacement'
import { parseSave } from '../src/lib/save'
import type { OniChunkLayerVisibility } from '../src/lib/oniWorldChunkRenderer'
const save=parseSave(new Uint8Array(readFileSync(process.argv[2])))
const simBefore=save.simData!.bytes.slice(),picker=createOniMapPicker(save)
const visible:OniChunkLayerVisibility={biome:true,backwall:true,ground:true,gas:true,liquid:true,minions:true,buildings:true,entities:true,geysers:true,power:true,plumbing:true,ventilation:true,automation:true,shipment:true}
const group=save.manager!.groups.find(g=>g.tag==='Headquarters')!,instance=group.instances[0]
const cells=buildingPlacementCells(instance,oniBuildingDefinitionForSaveTag(group.tag))
assert.ok(cells.length>1)
for(const {x,y} of cells)assert.ok(picker(x,y,visible).some(t=>t.instance===instance),'all headquarters footprint cells selectable')
const {x,y}=cells[0],targets=picker(x,y,visible),headquarters=targets.find(t=>t.instance===instance)!
assert.ok(headquarters.inspection.rows.some(([label,value])=>label==='对象 ID'&&value==='Headquarters'))
assert.ok(headquarters.inspection.rows.some(([label,value])=>label==='温度'&&value.includes('°C')))
assert.ok(!headquarters.inspection.rows.some(([label])=>label==='质量'),'do not infer mass from saved units')
assert.equal(targets[0].kind,'object')
let target=cycleMapTarget(targets)!
const ids=[]
for(let i=0;i<targets.length;i++){ids.push(target.id);target=cycleMapTarget(targets,target.id)!}
assert.equal(new Set(ids).size,targets.length);assert.equal(target.id,targets[0].id)
assert.equal(cycleMapTarget([],undefined),undefined)
assert.equal(cycleMapTarget(targets,'stale')!.id,targets[0].id)
assert.ok(!picker(x,y,{...visible,buildings:false}).some(t=>t.instance===instance))
assert.ok(!picker(x,y,{...visible,backwall:false}).some(t=>t.kind==='backwall'))
assert.deepEqual(picker(-1,y,visible),[])
assert.deepEqual(picker(x+.5,y,visible),[])
for(const part of instance.components)assert.ok(mapComponentRows(part.value).length<=100)
assert.deepEqual(save.simData!.bytes,simBefore,'inspection is read-only')
console.log('PASS occupied-cell picking, object-first order, complete cycle, stale selection, visibility, bounds, component limits and unchanged save')
console.log(JSON.stringify({x,y,targets:targets.map(t=>({id:t.id,name:t.inspection.name,layer:t.layer,bounds:t.bounds}))}))

const orientations=[0,1,2,3,5,6]
for(const orientation of orientations){
 const rotated={...instance,components:[{typeName:'Rotatable',length:0,details:null,raw:null,value:{kind:'object' as const,typeName:'Rotatable',members:[{name:'orientation',type:{} as never,value:{kind:'enum' as const,typeName:'Orientation',v:orientation}}]}}]}
 const cells=buildingPlacementCells(rotated,{id:'Test',width:2,height:3,animation:'test',defaultAnim:'off',sceneLayer:'Building',foregroundLayer:'BuildingFront',objectLayer:'Building',source:'test'})
 assert.equal(new Set(cells.map(c=>`${c.x}:${c.y}`)).size,6)
 const width=Math.max(...cells.map(c=>c.x))-Math.min(...cells.map(c=>c.x))+1
 assert.equal(width,orientation===1||orientation===3?3:2)
}
const pipes=save.manager!.groups.filter(g=>/conduit|wire/i.test(g.tag)).flatMap(g=>g.instances.map(instance=>({g,instance})))
let stacked=0
for(const {instance} of pipes){
 const entries=picker(Math.floor(instance.position.x),Math.floor(instance.position.y),visible)
 if(entries.filter(t=>t.kind==='object').length>1){
  stacked++
  assert.equal(new Set(entries.map(t=>t.id)).size,entries.length)
  const hidden=picker(Math.floor(instance.position.x),Math.floor(instance.position.y),{...visible,power:false,plumbing:false,ventilation:false,automation:false,shipment:false})
  assert.ok(!hidden.some(t=>['电线','液体管道','气体管道','自动化','运输轨道'].includes(t.layer)))
 }
}
assert.ok(stacked>0)
console.log(`PASS six building orientations and ${stacked} overlapping utility positions`)
