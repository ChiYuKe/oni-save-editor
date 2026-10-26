import assert from 'node:assert/strict'
import {OniRenderStats} from '../src/lib/oniRenderStats'
const stats=new OniRenderStats()
stats.sample(1)
for(let n=0;n<144;n++)stats.record(2)
assert.equal(stats.sample(1001).fps,144)
assert.equal(stats.sample(1001).renderMs,2)
assert.equal(stats.sample(2001).fps,0,'no draws must not masquerade as high FPS')
for(let n=0;n<60;n++)stats.record(3)
assert.equal(stats.sample(3001).fps,60)
assert.equal(stats.sample(3001).renderMs,3)
stats.record(5)
assert.equal(stats.sample(60001).fps,0,'background gap resets the rate window')
console.log('PASS actual draw counting, idle, mean cost and background gap')
