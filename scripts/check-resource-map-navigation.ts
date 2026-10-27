import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseSave} from '../src/lib/save'
import {worldSize} from '../src/lib/editor'
import {resourceStatistics} from '../src/lib/oniResourceStatistics'
import {objectMapViewport} from '../src/lib/oniMapFocus'
import {createOniMapPicker} from '../src/lib/oniMapPicking'
const save=parseSave(new Uint8Array(readFileSync(process.argv[2])))
const data=resourceStatistics(save),size=worldSize(save),pick=createOniMapPicker(save)
for(const g of data.geysers){
 const instance=save.manager?.groups.find(group=>group.tag===g.tag)?.instances[g.index]
 assert.ok(pick(Math.floor(g.x),Math.floor(g.y),{biome:true,backwall:true,ground:true,gas:true,liquid:true}).some(target=>target.instance===instance),`exact saved geyser selectable: ${g.id}`)
 for(const [width,height] of [[1440,900],[900,700],[390,740]]){
  const camera=objectMapViewport(save,width,height,g),fit=Math.min(1,width/(size.width*32),height/(size.height*32)),scale=fit*(1+15*camera.zoomPercent/100)
  const x=(width-size.width*32*scale)/2+camera.pan.x+g.x*32*scale
  const y=(height-size.height*32*scale)/2+camera.pan.y+(size.height-g.y-.5)*32*scale
  const reserve=Math.min(width*.7,width>600?352:272)
  assert.ok(Math.abs(x-(width-reserve)/2)<.001)
  assert.ok(Math.abs(y-height/2)<.001)
  assert.ok(camera.zoomPercent>=0&&camera.zoomPercent<=100)
 }
}
console.log(`PASS ${data.geysers.length} saved geysers: exact instance selection, global coordinates and three viewport sizes`)
