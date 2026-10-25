import assert from 'node:assert/strict'
import { liquidGradientColour } from '../src/lib/oniLiquidColour'
import { ONI_SUBSTANCE_MATERIALS } from '../src/lib/oniSubstances.generated'
import { ONI_SUBSTANCE_GRADIENTS } from '../src/lib/oniSubstanceGradients.generated'
import { buildOniPropertyTextures } from '../src/lib/oniPropertyTextures'
const salt=ONI_SUBSTANCE_MATERIALS.find(m=>m.name==='Salt Water')!
const ratio=(307.04-salt.lowTemp)/(salt.highTemp-salt.lowTemp)
const colour=liquidGradientColour(salt.hash,ratio,salt.colour)
assert.ok(colour[1]-colour[0]>70 && colour[2]>colour[1],String(colour))
assert.ok(salt.colour[0]>200, 'The fixed UI colour must stay intact')
assert.deepEqual(liquidGradientColour(salt.hash,0,salt.colour),[61,164,180])
assert.deepEqual(liquidGradientColour(salt.hash,1,salt.colour),[14,101,130])
assert.deepEqual(liquidGradientColour(0xffff,ratio,[1,2,3]),[1,2,3])
for(const keys of ONI_SUBSTANCE_GRADIENTS.values()) {
 let previous=-1
 for(const key of keys) {
  assert.ok(key.time>=previous && key.time>=0 && key.time<=1);previous=key.time
  assert.ok(key.rgb.every(v=>Number.isFinite(v)&&v>=0&&v<=255))
 }
}
const properties=buildOniPropertyTextures({context:undefined!,width:1,height:1,cellSize:32,originX:0,originY:0,range:{minX:0,maxX:0,minRow:0,maxRow:0},worldZones:new Uint8Array(1),textures:{},maskSets:null,cellAt:()=>({elementHash:salt.hash,elementId:salt.elementId,temperature:307.04,mass:1100}),isTerrainMaskedAt:()=>false,zoneColors:{0:{r:128,g:128,b:128}}})
const centre=16
assert.deepEqual([...properties.liquid.slice(centre,centre+3)],colour)
assert.equal(properties.liquid[centre+3],255)
assert.equal(properties.materialData[centre+3],7)
assert.ok(properties.liquidData[centre+3]>25 && properties.liquidData[centre+3]<240)
console.log('PASS native liquid gradients: saltwater blue-green instead of grey, quantised keys, endpoints, valid ramps, unknown fallback, actual property texture RGB/coverage/layer/temperature')
