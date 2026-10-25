import assert from 'node:assert/strict'
import { inspectOniCell } from '../src/lib/oniCellInspection'
import { ONI_SUBSTANCE_MATERIALS } from '../src/lib/oniSubstances.generated'
import { parseSim } from '../src/lib/sim'
import type { ParsedSave } from '../src/lib/save'
const gold = ONI_SUBSTANCE_MATERIALS.find(m => m.name === 'Gold')!
const stone = ONI_SUBSTANCE_MATERIALS.find(m => m.name === 'Sandstone')!
const bytes = new Uint8Array(29 + 9 * 36)
bytes.set(new TextEncoder().encode('SIMSAVE\0'))
const view = new DataView(bytes.buffer)
view.setUint32(8, 15, true); view.setUint32(12, 3, true); view.setUint32(16, 3, true)
const cellOffset = 29 + 4 * 16
view.setInt32(cellOffset, gold.elementId, true)
view.setFloat32(cellOffset + 4, 295.5, true); view.setFloat32(cellOffset + 8, 123.25, true)
const wallOffset = 29 + 9 * 24 + 4 * 12
view.setUint16(wallOffset, stone.hash, true); view.setFloat32(wallOffset + 4, 400, true); view.setFloat32(wallOffset + 8, 300, true)
const simData = parseSim(bytes)
const save = { simData, saveFileRoot: { kind: 'object', typeName: 'SaveFileRoot', members: ['WidthInCells','HeightInCells'].map(name => ({ name, type: { info: 6, subTypes: [] }, value: { kind: 'int32', v: 1 } })) } } as ParsedSave
const before = simData.bytes.slice()
const detail = inspectOniCell(save, 0, 0)!, rows = new Map(detail.rows)
assert.ok(detail.name.includes('Gold')); assert.equal(detail.position, 'X 0 · Y 0 · 固体')
assert.equal(rows.get('温度'), '22.35 °C · 295.50 K'); assert.equal(rows.get('质量'), '123.250 kg')
assert.equal(rows.get('元素 ID'), 'Gold')
assert.equal(rows.get('纹理集'), 'gold'); assert.equal(rows.get('材质'), 'matGold'); assert.equal(rows.get('高光遮罩'), 'gold_mask.png')
assert.ok(rows.get('天然背墙')?.includes('Sandstone')); assert.equal(rows.get('背墙温度'), '26.85 °C · 300.00 K')
for (const [x,y] of [[-1,0],[1,0],[0,1],[.5,0]]) assert.equal(inspectOniCell(save,x,y), undefined)
assert.deepEqual(simData.bytes, before)
for (const [name, expected] of [['Oxygen', 'Oxygen'], ['Sandstone', 'SandStone'], ['Carbon Dioxide', 'CarbonDioxide']]) {
  const material = ONI_SUBSTANCE_MATERIALS.find(m => m.name === name)!
  assert.ok(material, name)
  new DataView(simData.bytes.buffer).setInt32(cellOffset, material.elementId, true)
  assert.equal(new Map(inspectOniCell(save,0,0)!.rows).get('元素 ID'), expected)
}
new DataView(simData.bytes.buffer).setInt32(cellOffset, gold.elementId ^ 0x10000, true)
const unknown = inspectOniCell(save,0,0)!
assert.equal(new Map(unknown.rows).get('元素 ID'), '未识别'); assert.equal(unknown.name, '未知元素'); assert.equal(new Map(unknown.rows).get('纹理集'), '未匹配'); assert.equal(new Map(unknown.rows).get('纹理文件'), '无')
console.log('PASS cell inspection: world/SIM padding, full IDs, Celsius/Kelvin, mass, texture metadata, shine, backwall, bounds, hash collision and read-only inspection')
