import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { oniMapOverviewPixels } from '../src/lib/oniMapOverview'
import { ONI_BUILDING_SPRITES } from '../src/lib/oniBuildingSprites.generated'
import { ONI_PREVIEW_ATLAS } from '../src/lib/oniPreviewAtlas.generated'
import { parseSave } from '../src/lib/save'
const manifest=JSON.parse(readFileSync(new URL('../public/assets/buildings/manifest.json',import.meta.url),'utf8'))
for(const [key,value] of Object.entries(ONI_BUILDING_SPRITES)){ for(const [field,data] of Object.entries(value)) assert.deepEqual(manifest[key][field],data,key+':'+field) }
assert.equal(Object.keys(manifest).length,Object.keys(ONI_BUILDING_SPRITES).length)
const roots=['/assets/elements/mask_atlas.png','/assets/render/bgarray_liquids.png','/assets/render/bgarray_liquids_specular.png']
const rects=ONI_PREVIEW_ATLAS.rects as Record<string,readonly number[]>
assert.equal(rects[roots[0]],undefined,'full masks retain their native coordinates')
for(const path of roots.slice(1))assert.deepEqual(rects[path].slice(2),[128,128],'preview arrays retain a 4x4 layer layout')
assert.ok(statSync(new URL('../public'+ONI_PREVIEW_ATLAS.path,import.meta.url)).size<1024*1024,'single first-view image must remain under 1 MB')
if(process.argv[2]){
 const save=parseSave(new Uint8Array(readFileSync(process.argv[2]))),before=save.simData!.bytes.slice()
 const start=performance.now(),overview=oniMapOverviewPixels(save),elapsed=performance.now()-start
 assert.equal(overview.width,736);assert.equal(overview.height,304)
 assert.equal(overview.pixels.length,736*304*4)
 assert.ok(overview.pixels.some((v,i)=>i%4===3&&v>0),'map has visible geography without fetching any assets')
 assert.ok(overview.pixels.some((v,i)=>i%4===3&&v===0),'space stays transparent')
 assert.deepEqual(save.simData!.bytes,before)
 console.log('PASS save-only map overview:',elapsed.toFixed(1),'ms, correct bounds, visible geography, transparent space, SIM unchanged')
}
console.log('PASS preview atlas: <1MB, retained mask coordinates, 16-layer liquid layout')
