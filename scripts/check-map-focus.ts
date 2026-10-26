import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { printingPodFocus, printingPodViewport, mapLoadOrigin, resizeMapViewport } from '../src/lib/oniMapFocus'
import { OniDetailQueue } from '../src/lib/oniDetailQueue'
import { worldSize } from '../src/lib/editor'
import { parseSave } from '../src/lib/save'
const queue=new OniDetailQueue(1),order:string[]=[]
let releaseFar!:()=>void,startedFar!:()=>void
const farStarted=new Promise<void>(resolve=>{startedFar=resolve})
const far=queue.enqueue(()=>new Promise<void>(resolve=>{order.push('far');releaseFar=resolve;startedFar()}),100)
const pod=queue.enqueue(async()=>{order.push('pod')},-1000)
const nearby=queue.enqueue(async()=>{order.push('nearby')},1)
await Promise.all([pod,nearby]);await farStarted
assert.deepEqual(order,['pod','nearby','far'])
releaseFar();await far
let active=0,peak=0
const pool=new OniDetailQueue(4)
await Promise.all(Array.from({length:16},(_,i)=>pool.enqueue(async()=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2));active--;return i},i)))
assert.equal(peak,4)
console.log('PASS detail queue: printing pod first, near-to-far ordering, independent completion and bounded concurrency')
if(process.argv[2]){
 const save=parseSave(new Uint8Array(readFileSync(process.argv[2]))),before=save.simData!.bytes.slice(),size=worldSize(save)
 const focus=printingPodFocus(save)!
 assert.ok(focus)
 for(const [w,h] of [[1280,671],[1920,900],[768,600]]){
  const camera=printingPodViewport(save,w,h),fit=Math.min(1,w/(size.width*32),h/(size.height*32)),scale=fit*(1+15*camera.zoomPercent/100)
  const x=(w-size.width*32*scale)/2+camera.pan.x+focus.x*32*scale
  const y=(h-size.height*32*scale)/2+camera.pan.y+focus.row*32*scale
  assert.ok(Math.abs(x-w/2)<1e-6);assert.ok(Math.abs(y-h/2)<1e-6)
  assert.ok(camera.zoomPercent>0&&camera.zoomPercent<=100)
 }
 const desktop=printingPodViewport(save,1280,671)
 const oldFit=Math.min(1,1280/(size.width*32),671/(size.height*32)),newFit=Math.min(1,709/(size.width*32),1172/(size.height*32))
 const resized=resizeMapViewport(desktop,oldFit,newFit),scale=newFit*(1+15*resized.zoomPercent/100)
 assert.ok(Math.abs((709-size.width*32*scale)/2+resized.pan.x+focus.x*32*scale-709/2)<1e-6)
 assert.ok(Math.abs((1172-size.height*32*scale)/2+resized.pan.y+focus.row*32*scale-1172/2)<1e-6)
 assert.deepEqual(mapLoadOrigin(save,focus.x-10,focus.row-10,20,20),focus)
 assert.deepEqual(mapLoadOrigin(save,500,200,20,20),{x:510,row:210})
 const absent={...save,manager:{...save.manager!,groups:[]}}
 assert.equal(printingPodFocus(absent),undefined)
 assert.deepEqual(printingPodViewport(absent,1280,720),{zoomPercent:0,pan:{x:0,y:0}})
 assert.deepEqual(save.simData!.bytes,before)
 console.log('PASS warehouse printing pod focus:',focus,'centred at three viewport sizes, stable fallback, viewport loading origin, SIM unchanged')
}
