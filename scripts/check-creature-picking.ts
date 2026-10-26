import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createOniMapPicker, spriteSelectionCells, cycleMapTarget } from '../src/lib/oniMapPicking'
import { isCreatureInstance, mapObjectSceneLayer, buildingPlacementCells, oniBuildingDefinitionForSaveTag } from '../src/lib/oniObjectPlacement'
import { buildingTextureForInstance, geyserTextureForTag, isGeyserInstance } from '../src/lib/oniObjectVisuals'
import { ONI_BUILDING_SPRITES } from '../src/lib/oniBuildingSprites.generated'
import { worldSize } from '../src/lib/editor'
import { parseSave } from '../src/lib/save'
import type { SavedObjectInstance } from '../src/lib/model'
const save=parseSave(new Uint8Array(readFileSync(process.argv[2]))),pick=createOniMapPicker(save),size=worldSize(save)
const before=save.simData!.bytes.slice()
const visible={biome:true,backwall:true,ground:true,gas:true,liquid:true,entities:true,buildings:true,minions:true,geysers:true}
let animals=0,geysers=0,edgeCells=0
const examples: unknown[]=[]
for(const group of save.manager!.groups)for(const instance of group.instances){
 const animal=isCreatureInstance(group.tag,instance)&&group.tag!=='Minion',geyser=geyserTextureForTag(group.tag),spring=isGeyserInstance(group.tag,instance,geyser)
 if(!animal&&!spring)continue
 if(animal)animals++;if(spring)geysers++
 const building=buildingTextureForInstance(group.tag,instance,ONI_BUILDING_SPRITES),sprite=building??geyser
 if(!sprite)continue
 const cells=spriteSelectionCells(instance,sprite,!building && spring ? .5 : 0)
 const occupied=new Set(buildingPlacementCells(instance,oniBuildingDefinitionForSaveTag(group.tag)).map(c=>`${c.x}:${c.y}`))
 if(!occupied.size)occupied.add(`${Math.floor(instance.position.x)}:${Math.floor(instance.position.y)}`)
 for(const {x,y} of cells){
  if(x<0||y<0||x>=size.width||y>=size.height)continue
  const targets=pick(x,y,visible),target=targets.find(t=>t.instance===instance)
  assert.ok(target,`${group.tag} artwork cell ${x},${y} must select the object`)
  assert.ok(target.bounds.minX<=x&&target.bounds.maxX>=x&&target.bounds.minY<=y&&target.bounds.maxY>=y)
  assert.equal(target.layer,spring?'间歇泉':'生物 / 复制人')
  assert.ok(!pick(x,y,{...visible,[spring?'geysers':'entities']:false}).some(t=>t.instance===instance))
  assert.ok(pick(x,y,{...visible,buildings:false}).some(t=>t.instance===instance),'fauna is not controlled by building visibility')
  if(!occupied.has(`${x}:${y}`)){
   edgeCells++
   if(examples.length<8&&!examples.some((e:any)=>e.tag===group.tag))examples.push({tag:group.tag,x,y,bounds:target.bounds})
   let current=cycleMapTarget(targets),seen=new Set()
   for(let i=0;i<targets.length;i++){seen.add(current!.id);current=cycleMapTarget(targets,current!.id)}
   assert.ok(seen.has(target.id))
  }
 }
}
assert.ok(animals>0&&geysers>0&&edgeCells>0)
const sample=save.manager!.groups.flatMap(g=>g.instances).find(i=>i.components.some(c=>c.typeName==='CreatureBrain'))!
const modded={...sample,components:sample.components.filter(c=>c.typeName==='CreatureBrain')} as SavedObjectInstance
assert.ok(isCreatureInstance('UnlistedModCritter',modded))
assert.equal(mapObjectSceneLayer({tag:'UnlistedModCritter',instances:[modded],count:1,byteLength:0},modded),24)
const fountain={...modded,components:[]} as SavedObjectInstance
assert.equal(geyserTextureForTag('HarvestableSpacePOI_DLC5AquaticOreField'),undefined)
assert.equal(geyserTextureForTag('Brackene'),undefined)
assert.ok(isGeyserInstance('AquaticBrackeneFountain',fountain,geyserTextureForTag('AquaticBrackeneFountain')))
assert.ok(isGeyserInstance('UnknownSpring',{...fountain,components:[{typeName:'Mod.Geyser',value:null,length:0,raw:null,details:null}]},undefined))
assert.deepEqual(spriteSelectionCells(sample,{path:'bad',widthCells:NaN}),[])
assert.deepEqual(save.simData!.bytes,before)
console.log(`PASS ${animals} animals, ${geysers} geysers/fountains, ${edgeCells} visual cells beyond old hitboxes, layer visibility and cyclic selection`)
console.log(JSON.stringify(examples))
