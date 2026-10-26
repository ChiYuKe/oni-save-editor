import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {ONI_OBJECT_ICONS} from '../src/lib/oniObjectIcons.generated'
import {objectGroupIcon} from '../src/lib/oniObjectIcon'
import {parseSave} from '../src/lib/save'
const tags=['WormBasicFruit','PlanktonCoral','Bulbloom','Oxyfern','Pacu','SmallReefGeyser','ToePlant','Squid','FruitCake','Lime','DivergentBeetle','BasicSingleHarvestPlant','RationBox','EvilFlower','Squirrel','BeanPlant','SaltySticksFood','WaterCups','OxyCoral','GravitasPedestal','Moo','SetLocker']
for(const tag of tags){
 const path=objectGroupIcon(tag)
 assert.ok(path,`native icon: ${tag}`)
 assert.equal(objectGroupIcon(tag.toLowerCase()),path)
 assert.ok(readFileSync(new URL('../public'+path,import.meta.url)).length>0)
}
for(const path of new Set(Object.values(ONI_OBJECT_ICONS))){
 const bytes=readFileSync(new URL('../public'+path,import.meta.url))
 assert.equal(bytes.subarray(8,12).toString(),'WEBP')
}
assert.equal(objectGroupIcon('UnknownModObject_IconTest'),undefined)
if(process.argv[2]){
 const save=parseSave(new Uint8Array(readFileSync(process.argv[2])))
 const groups=save.manager?.groups??[]
 console.log(JSON.stringify({groups:groups.length,withIcons:groups.filter(g=>objectGroupIcon(g.tag)).length,withoutIcons:groups.filter(g=>!objectGroupIcon(g.tag)).map(g=>g.tag)}))
}
console.log(`PASS: ${tags.length} requested groups, ${Object.keys(ONI_OBJECT_ICONS).length} native mappings, assets and unknown fallback`)
