import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { parseSim, getSimCell, setSimCell, getWorldCell, readSimBackwall } from '../src/lib/sim'
import { parseSave, buildSave } from '../src/lib/save'
import { ONI_SUBSTANCE_BY_HASH } from '../src/lib/oniSubstances.generated'
import { buildOniPropertyTextures } from '../src/lib/oniPropertyTextures'

const WATER = 0x6d796197, OXYGEN = 0xa4e0b340 | 0
let checks = 0
function check(name: string, body: () => void) { body(); checks++; console.log(`PASS ${name}`) }

function fixture(version: number) {
  const bytes = new Uint8Array(29 + 9 * (16 + 8 + (version >= 15 ? 12 : 4)))
  const view = new DataView(bytes.buffer)
  bytes.set(new TextEncoder().encode('SIMSAVE\0'))
  view.setUint32(8, version, true); view.setUint32(12, 3, true); view.setUint32(16, 3, true)
  for (let cell = 0; cell < 9; cell++) {
    const offset = 29 + cell * 16
    // Disk contract, written independently of implementation offset helpers.
    view.setInt32(offset, WATER, true)
    view.setFloat32(offset + 4, 297.15, true)
    view.setFloat32(offset + 8, 1000, true)
    view.setUint32(offset + 12, 0x7fc01234, true) // preserve even noncanonical NaN payloads
  }
  bytes.fill(0xa5, 29 + 9 * 16)
  if (version >= 15) {
    const wall = 29 + 9 * 24 + 4 * 12
    view.setInt32(wall, 493438017, true); view.setFloat32(wall + 4, 800, true); view.setFloat32(wall + 8, 301.15, true)
  }
  return parseSim(bytes)
}
function unchangedOutside(before: Uint8Array, after: Uint8Array, start: number, size: number) {
  assert.deepEqual(after.slice(0, start), before.slice(0, start))
  assert.deepEqual(after.slice(start + size), before.slice(start + size))
}
for (const version of [14, 15]) {
  const sim = fixture(version), offset = 29 + 4 * 16
  check(`v${version} disk temperature/mass/full hash`, () => {
    const cell = getWorldCell(sim, 0, 0)!
    assert.equal(cell.elementId, WATER); assert.equal(cell.elementHash, 0x6197)
    assert.ok(Math.abs(cell.temperature - 297.15) < .0001); assert.equal(cell.mass, 1000)
    assert.equal(cell.properties, undefined); assert.equal(cell.insulation, undefined); assert.equal(cell.strengthInfo, undefined)
  })
  check(`v${version} temperature edit changes only its four bytes`, () => {
    const next = setSimCell(sim, 1, 1, { temperature: 310.15 })!
    assert.ok(Math.abs(getSimCell(next, 1, 1)!.temperature - 310.15) < .0001)
    assert.equal(getSimCell(next, 1, 1)!.mass, 1000)
    unchangedOutside(sim.bytes, next.bytes, offset + 4, 4)
  })
  check(`v${version} mass edit preserves temperature and unknown payload`, () => {
    const next = setSimCell(sim, 1, 1, { mass: 12.5 })!
    assert.equal(getSimCell(next, 1, 1)!.mass, 12.5)
    unchangedOutside(sim.bytes, next.bytes, offset + 8, 4)
  })
  check(`v${version} element edit writes the complete signed SimHash`, () => {
    const next = setSimCell(sim, 1, 1, { elementHash: 0xb340 })!
    assert.equal(getSimCell(next, 1, 1)!.elementId, OXYGEN)
    unchangedOutside(sim.bytes, next.bytes, offset, 4)
    const restored = setSimCell(next, 1, 1, getSimCell(sim, 1, 1)!)!
    assert.deepEqual(restored.bytes, sim.bytes)
  })
  check(`v${version} unknown full hash is preserved`, () => {
    const next = setSimCell(sim, 1, 1, { elementId: 0xfedc1234 | 0, elementHash: 0x1234 })!
    assert.equal(getSimCell(next, 1, 1)!.elementId, 0xfedc1234 | 0)
    assert.throws(() => setSimCell(sim, 1, 1, { elementHash: 0xffff }))
  })
  check(`v${version} invalid runtime/physical edits cannot corrupt disk bytes`, () => {
    assert.throws(() => setSimCell(sim, 1, 1, { properties: 0x80 }))
    assert.throws(() => setSimCell(sim, 1, 1, { temperature: -1 }))
    assert.throws(() => setSimCell(sim, 1, 1, { mass: Number.NaN }))
  })
  if (version === 15) check('v15 backwall layout remains mass then temperature', () => {
    const wall = readSimBackwall(sim, new DataView(sim.bytes.buffer), 1, 1)!
    assert.equal(wall.mass, 800); assert.ok(Math.abs(wall.temperature - 301.15) < .0001)
  })
  check(`v${version} stored water data reaches fluid property textures`, () => {
    const properties = buildOniPropertyTextures({
      width: 1, height: 1, cellSize: 32, originX: 0, originY: 0,
      range: { minX: 0, maxX: 0, minRow: 0, maxRow: 0 }, worldZones: new Uint8Array([3]),
      textures: {}, maskSets: null, context: undefined!, zoneColors: { 3: { r: 242, g: 187, b: 71 } },
      cellAt: (x, y) => x === 0 && y === 0 ? getWorldCell(sim, x, y) : undefined,
      isTerrainMaskedAt: () => false,
    })
    const pixel = (1 * 3 + 1) * 4
    assert.equal(properties.liquid[pixel + 3], 255) // 1000kg at LiquidMaxMass=1000kg
    assert.equal(properties.solidLiquidGasMass[pixel + 1], 255)
    assert.equal(properties.materialData[pixel + 3], 0) // Water: SubstanceTexture.None, not invented slice 13
    assert.ok(properties.liquidData[pixel + 3] < 128) // ordinary-temperature water, not false boiling
  })
}

function saveFiles(input: string): string[] {
  return statSync(input).isDirectory() ? readdirSync(input, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(input, entry.name)
    return entry.isDirectory() ? saveFiles(file) : /\.sav$/i.test(file) ? [file] : []
  }) : [input]
}
let files = 0, cells = 0
for (const file of process.argv.slice(2).flatMap(saveFiles)) {
  const save = parseSave(readFileSync(file)), sim = save.simData!
  const original = sim.bytes.slice(), view = new DataView(original.buffer)
  let sample: { x: number; y: number } | undefined
  for (let index = 0; index < sim.cellCount; index++) {
    const offset = 29 + index * 16
    const id = view.getInt32(offset, true), material = ONI_SUBSTANCE_BY_HASH.get(id & 0xffff)
    if (material) assert.equal(material.elementId, id, `${path.basename(file)}: full SimHash mismatch at ${index}`)
    const temperature = view.getFloat32(offset + 4, true), mass = view.getFloat32(offset + 8, true)
    assert.ok(Number.isFinite(temperature) && temperature >= 0, `${path.basename(file)}: invalid temperature at ${index}`)
    assert.ok(Number.isFinite(mass) && mass >= 0, `${path.basename(file)}: invalid mass at ${index}`)
    if (!sample && mass > 0 && temperature > 0) sample = { x: index % sim.width, y: Math.floor(index / sim.width) }
  }
  assert.ok(sample)
  const before = getSimCell(sim, sample.x, sample.y)!
  const edited = setSimCell(sim, sample.x, sample.y, { temperature: before.temperature + 1 })!
  unchangedOutside(sim.bytes, edited.bytes, 29 + (sample.y * sim.width + sample.x) * 16 + 4, 4)
  assert.deepEqual(sim.bytes, original)
  save.simData = edited
  const reparsed = parseSave(buildSave(save))
  assert.deepEqual(reparsed.simData!.bytes, edited.bytes)
  files++; cells += sim.cellCount
  console.log(`PASS real save v${sim.version}: ${path.basename(file)} (${sim.cellCount} cells, read/edit/export/reparse)`)
}
console.log(JSON.stringify({ checks, files, cells, result: 'PASS' }))
