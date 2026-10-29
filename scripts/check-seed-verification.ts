import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {parseSave} from '../src/lib/save'
import {verifyNativeSeed,type NativeSeedSnapshot} from '../src/lib/oniSeedVerification'
const directory=process.argv[2]
const save=parseSave(new Uint8Array(readFileSync(path.join(directory,'generated.sav'))))
const native=JSON.parse(readFileSync(path.join(directory,'native-geysers.json'),'utf8')) as NativeSeedSnapshot
verifyNativeSeed(save,native)
function reject(change:(copy:NativeSeedSnapshot)=>void){const copy=structuredClone(native);change(copy);assert.throws(()=>verifyNativeSeed(save,copy),/核验失败/)}
reject(copy=>{copy.coordinate+='X'})
reject(copy=>{copy.worlds!.pop()})
reject(copy=>{copy.worlds![0].width++})
reject(copy=>{copy.worlds![0].source+='X'})
reject(copy=>{copy.geysers.pop()})
reject(copy=>{copy.geysers[0].temperature+=100})
reject(copy=>{copy.geysers[0].x+=1})
console.log('PASS verification rejects mismatched coordinates, world count/dimensions/type, geyser count/temperature/position')
