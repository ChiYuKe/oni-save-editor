import assert from 'node:assert/strict'
import { loadRenderImage } from '../src/lib/oniRenderAssets'
let requests = 0
class FakeImage {
  naturalWidth = 1024
  naturalHeight = 1024
  onload?: () => void
  onerror?: () => void
  decoding = ''
  set src(url: string) { requests++; queueMicrotask(() => url === 'missing' ? this.onerror?.() : this.onload?.()) }
}
const original = globalThis.Image
Object.defineProperty(globalThis, 'Image', {value: FakeImage, configurable: true, writable: true})
try {
 const a=loadRenderImage('shared'),b=loadRenderImage('shared')
 assert.equal(a,b)
 const [one,two]=await Promise.all([a,b]);assert.equal(one,two);assert.equal(requests,1)
 assert.equal(await loadRenderImage('shared'),one);assert.equal(requests,1)
 assert.equal(await loadRenderImage('missing'),null);assert.equal(await loadRenderImage('missing'),null);assert.equal(requests,3)
 for(let i=0;i<70;i++) await loadRenderImage('art-'+i)
 const count=requests
 await loadRenderImage('shared');assert.equal(requests,count+1,'decoded image budget evicts old artwork')
 const retained=await loadRenderImage('shared');assert.equal(await loadRenderImage('shared'),retained)
 console.log('PASS render assets: pending request deduplication, decoded image identity, failed-load retry, bounded retention and cache reuse')
} finally { Object.defineProperty(globalThis, 'Image', {value:original, configurable:true,writable:true}) }
