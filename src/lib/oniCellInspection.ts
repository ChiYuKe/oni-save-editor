import { ONI_ELEMENT_IDS } from './oniElementIds.generated'
import { worldSize } from './editor'
import { elementForHash } from './elements'
import { ONI_SUBSTANCE_BY_HASH } from './oniSubstances.generated'
import { ONI_SHINE_MATERIALS } from './oniShineMaterials.generated'
import type { ParsedSave } from './save'
import { getWorldCell, readSimBackwall } from './sim'

export interface OniCellInspection {
  name: string
  position: string
  rows: Array<[string, string]>
}
const filename = (path: string) => path.split(/[\\/]/).pop() ?? path
const fixed = (value: number, digits: number) => Number.isFinite(value) ? value.toFixed(digits) : '—'
const temperature = (kelvin: number) => `${fixed(kelvin - 273.15, 2)} °C · ${fixed(kelvin, 2)} K`

/** Read the saved cell, rather than estimating material or temperature from pixels. */
export function inspectOniCell(save: ParsedSave, x: number, y: number): OniCellInspection | undefined {
  const size = worldSize(save)
  if (!save.simData || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size.width || y >= size.height) return undefined
  const cell = getWorldCell(save.simData, x, y)
  if (!cell) return undefined
  const candidate = ONI_SUBSTANCE_BY_HASH.get(cell.elementHash)
  const material = cell.elementId === undefined || candidate?.elementId === cell.elementId ? candidate : undefined
  const element = elementForHash(cell.elementHash)
  const id = cell.elementId ?? material?.elementId ?? cell.elementHash
  const known = !candidate || Boolean(material)
  const name = known ? element.name : '未知元素'
  const state = known ? ({ solid: '固体', liquid: '液体', gas: '气体', vacuum: '真空', special: '特殊' } as Record<string, string>)[element.state] : '未知'
  const shine = material && ONI_SHINE_MATERIALS.get(material.hash)
  const texture = material?.texture || (known ? element.texture : undefined)
  const rows: Array<[string, string]> = [
    ['元素 ID', ONI_ELEMENT_IDS.get(id) ?? '未识别'],
    ['单元索引', String(y * size.width + x)],
    ['温度', temperature(cell.temperature)],
    ['质量', `${fixed(cell.mass, 3)} kg`],
    ['纹理集', material ? filename(material.texture).replace(/\.[^.]+$/, '') || '无' : '未匹配'],
    ['纹理文件', texture ? filename(texture) : '无'],
    ['材质', material ? filename(material.material).replace(/\.mat$/i, '') : '未匹配'],
  ]
  if (material) {
    rows.push(['材质序号 / 纹理层', `${material.substanceIndex} / ${material.substanceTexture}`])
    rows.push(['UV 缩放', String(material.worldUvScale)])
    rows.push(['高光遮罩', shine ? filename(shine.maskUrl) : '无'])
  }
  const sim = save.simData
  const wall = readSimBackwall(sim, new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength), x + 1, y + 1)
  if (wall && wall.mass > 0 && elementForHash(wall.elementHash).state === 'solid') {
    rows.push(['天然背墙', elementForHash(wall.elementHash).name])
    rows.push(['背墙温度', temperature(wall.temperature)])
  }
  return { name, position: `X ${x} · Y ${y} · ${state}`, rows }
}
