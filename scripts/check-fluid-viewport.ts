import assert from 'node:assert/strict'
import { fluidViewportForCamera } from '../src/lib/oniFluidViewport'
const world = [736, 304, 32] as const
const overview = fluidViewportForCamera({ x: -100, y: -100, width: 24000, height: 10000, scale: .04 }, ...world)!
assert.equal(overview.x, 0); assert.equal(overview.row, 0)
assert.equal(overview.widthCells, 736); assert.equal(overview.heightCells, 304)
assert.ok(overview.widthCells * overview.cellSize <= 1536)
assert.ok(overview.heightCells * overview.cellSize <= 1024)
const closeup = fluidViewportForCamera({ x: 5120, y: 800, width: 960, height: 720, scale: 1 }, ...world)!
assert.equal(closeup.x, 158); assert.equal(closeup.row, 23)
assert.ok(closeup.x * 32 <= 5120 && (closeup.x + closeup.widthCells) * 32 >= 6080)
assert.ok(closeup.row * 32 <= 800 && (closeup.row + closeup.heightCells) * 32 >= 1520)
assert.equal(closeup.cellSize, 32)
assert.equal(fluidViewportForCamera({ x: 30000, y: 800, width: 960, height: 720, scale: 1 }, ...world), undefined)
assert.equal(fluidViewportForCamera({ x: 0, y: 0, width: 0, height: 720, scale: 1 }, ...world), undefined)
assert.equal(fluidViewportForCamera({ x: 0, y: 0, width: 960, height: 720, scale: 0 }, ...world), undefined)
console.log('PASS fluid viewport: overview resolution budget, close-up coverage, panning outside map, zero-sized and uninitialized camera')
