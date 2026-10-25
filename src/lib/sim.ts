import { ONI_SUBSTANCE_BY_HASH } from './oniSubstances.generated'

export const SIM_HEADER_SIZE = 29
export const SIM_CELL_SIZE = 16
export const SIM_DISEASE_SIZE = 8
export const SIM_BACKWALL_SIZE = 12
export const SIM_BACKWALL_SIZE_LEGACY = 4

export interface SimCell {
  elementHash: number
  /** Full signed SimHash stored on disk. elementHash is its UI-compatible low 16 bits. */
  elementId?: number
  /** Optional runtime hints for standalone lighting fixtures; absent from SIMSAVE. */
  properties?: number
  insulation?: number
  strengthInfo?: number
  /** Uninterpreted final float. Its bytes are preserved on every edit. */
  auxiliary?: number
  temperature: number
  mass: number
}

export interface SimBackwallCell {
  elementHash: number
  mass: number
  temperature: number
}

export interface SimData {
  version: number
  width: number
  height: number
  cellCount: number
  cellOffset: number
  diseaseOffset: number
  backwallOffset: number
  backwallSize: number
  bytes: Uint8Array
}

const SIM_MAGIC = [0x53, 0x49, 0x4d, 0x53, 0x41, 0x56, 0x45, 0x00]

export function parseSim(bytes: Uint8Array): SimData {
  if (bytes.length < SIM_HEADER_SIZE) throw new Error('SIMSAVE 区块头部不完整。')
  if (!SIM_MAGIC.every((value, index) => bytes[index] === value)) throw new Error('SIMSAVE 区块标识不正确。')

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const version = view.getUint32(8, true)
  const width = view.getUint32(12, true)
  const height = view.getUint32(16, true)
  const cellCount = width * height
  const cellOffset = SIM_HEADER_SIZE
  const diseaseOffset = cellOffset + cellCount * SIM_CELL_SIZE
  const backwallOffset = diseaseOffset + cellCount * SIM_DISEASE_SIZE
  // v14 stores only the legacy backwall index block. v15 added mass and
  // temperature, expanding the per-cell backwall record from 4 to 12 bytes.
  const backwallSize = version >= 15 ? SIM_BACKWALL_SIZE : SIM_BACKWALL_SIZE_LEGACY
  const requiredLength = backwallOffset + cellCount * backwallSize

  if (!width || !height || !Number.isSafeInteger(cellCount) || requiredLength > bytes.length) {
    throw new Error(`SIMSAVE 网格尺寸无效：${width} × ${height}（版本 ${version}，需要 ${requiredLength} 字节，实际 ${bytes.length} 字节）。`)
  }

  return {
    version,
    width,
    height,
    cellCount,
    cellOffset,
    diseaseOffset,
    backwallOffset,
    backwallSize,
    bytes: bytes.slice(),
  }
}

export function simCellOffset(data: SimData, x: number, y: number): number | undefined {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= data.width || y >= data.height) return undefined
  return data.cellOffset + (y * data.width + x) * SIM_CELL_SIZE
}

export function readSimCell(data: SimData, view: DataView, x: number, y: number): SimCell | undefined {
  const offset = simCellOffset(data, x, y)
  if (offset === undefined) return undefined
  return {
    // Disk records are NOT the packed in-memory Sim.Cell struct:
    // int32 SimHash, float temperature(K), float mass(kg), preserved float.
    elementHash: view.getUint32(offset, true) & 0xffff,
    elementId: view.getInt32(offset, true),
    temperature: view.getFloat32(offset + 4, true),
    mass: view.getFloat32(offset + 8, true),
    auxiliary: view.getFloat32(offset + 12, true),
  }
}

export function getSimCell(data: SimData, x: number, y: number): SimCell | undefined {
  return readSimCell(data, new DataView(data.bytes.buffer, data.bytes.byteOffset, data.bytes.byteLength), x, y)
}

export function readSimBackwall(data: SimData, view: DataView, x: number, y: number): SimBackwallCell | undefined {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= data.width || y >= data.height) return undefined
  const offset = data.backwallOffset + (y * data.width + x) * data.backwallSize
  if (data.backwallSize < SIM_BACKWALL_SIZE) {
    return { elementHash: view.getUint16(offset, true), mass: 0, temperature: 0 }
  }
  // SIMSAVE's BackwallData is 12 bytes: ushort element hash, two bytes
  // of alignment, then mass and temperature floats.
  return {
    elementHash: view.getUint16(offset, true),
    mass: view.getFloat32(offset + 4, true),
    temperature: view.getFloat32(offset + 8, true),
  }
}

export function worldCellCoordinates(x: number, y: number): { x: number; y: number } {
  return { x: x + 1, y: y + 1 }
}

export function getWorldCell(data: SimData, x: number, y: number): SimCell | undefined {
  const coordinates = worldCellCoordinates(x, y)
  return getSimCell(data, coordinates.x, coordinates.y)
}

export function setSimCell(data: SimData, x: number, y: number, patch: Partial<SimCell>): SimData | undefined {
  return setSimCells(data, [{ x, y, patch }])
}

export function setSimCells(data: SimData, cells: Array<{ x: number; y: number; patch: Partial<SimCell> }>): SimData | undefined {
  if (cells.length === 0) return data
  const offsets = cells.map((cell) => ({ offset: simCellOffset(data, cell.x, cell.y), patch: cell.patch }))
  if (offsets.some(({ offset }) => offset === undefined)) return undefined
  const bytes = data.bytes.slice()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  offsets.forEach(({ offset, patch }) => {
    if (offset === undefined) return
    if (patch.properties !== undefined || patch.insulation !== undefined || patch.strengthInfo !== undefined) {
      throw new Error('运行时属性不在 SIMSAVE 格子记录中，不能写入。')
    }
    if (patch.elementHash !== undefined || patch.elementId !== undefined) {
      const hash = patch.elementHash ?? (patch.elementId! & 0xffff)
      let id = patch.elementId ?? ONI_SUBSTANCE_BY_HASH.get(hash & 0xffff)?.elementId
      if (id === undefined && (view.getUint32(offset, true) & 0xffff) === hash) id = view.getInt32(offset, true)
      if (id === undefined || !Number.isInteger(id) || (id & 0xffff) !== (hash & 0xffff)) {
        throw new Error('无法确定元素的完整 SimHash；已取消写入。')
      }
      view.setInt32(offset, id, true)
    }
    if (patch.temperature !== undefined) {
      if (!Number.isFinite(patch.temperature) || patch.temperature < 0) throw new Error('温度必须为不小于 0 的开尔文值。')
      view.setFloat32(offset + 4, patch.temperature, true)
    }
    if (patch.mass !== undefined) {
      if (!Number.isFinite(patch.mass) || patch.mass < 0) throw new Error('质量必须为不小于 0 的数值。')
      view.setFloat32(offset + 8, patch.mass, true)
    }
  })
  return { ...data, bytes }
}

export function setWorldCell(data: SimData, x: number, y: number, patch: Partial<SimCell>): SimData | undefined {
  return setWorldCells(data, [{ x, y, patch }])
}

export function setWorldCells(data: SimData, cells: Array<{ x: number; y: number; patch: Partial<SimCell> }>): SimData | undefined {
  return setSimCells(data, cells.map((cell) => {
    const coordinates = worldCellCoordinates(cell.x, cell.y)
    return { x: coordinates.x, y: coordinates.y, patch: cell.patch }
  }))
}

export function getSimDisease(data: SimData, x: number, y: number): Uint8Array | undefined {
  const offset = simCellOffset(data, x, y)
  if (offset === undefined) return undefined
  return data.bytes.slice(data.diseaseOffset + (y * data.width + x) * SIM_DISEASE_SIZE, data.diseaseOffset + (y * data.width + x + 1) * SIM_DISEASE_SIZE)
}

export function getSimBackwall(data: SimData, x: number, y: number): Uint8Array | undefined {
  const offset = simCellOffset(data, x, y)
  if (offset === undefined) return undefined
  return data.bytes.slice(data.backwallOffset + (y * data.width + x) * data.backwallSize, data.backwallOffset + (y * data.width + x + 1) * data.backwallSize)
}
