import assert from 'node:assert/strict'
import { OniFluidFrameClock, ONI_FLUID_TARGET_FPS } from '../src/lib/oniFluidFrameClock'
function simulate(refreshRate: number, cost = 1) {
  const clock = new OniFluidFrameClock()
  let frames = 0
  for (let i = 0; i < refreshRate * 10; i++) {
    if (clock.shouldRender(i * 1000 / refreshRate)) { frames++; clock.recordCost(cost) }
  }
  return frames / 10
}
for (const hz of [60, 114, 120, 144, 165, 240]) {
  const fps = simulate(hz)
  assert.ok(Math.abs(fps - Math.min(hz, ONI_FLUID_TARGET_FPS)) < .3, `${hz} Hz: ${fps} fps`)
  console.log(`PASS ${hz} Hz display: ${fps} fps`)
}
assert.ok(simulate(144, 20) < 45, 'Expensive frames must leave room for interactions')
const clock = new OniFluidFrameClock()
assert.equal(clock.shouldRender(0), true)
assert.equal(clock.shouldRender(0), false)
assert.equal(clock.shouldRender(60000), true)
assert.equal(clock.shouldRender(60000), false)
assert.equal(clock.shouldRender(Number.NaN), false)
console.log('PASS workload adaptation, background resume, duplicate and invalid timestamps')
