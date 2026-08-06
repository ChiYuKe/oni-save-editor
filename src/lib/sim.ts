export const SIM_HEADER_SIZE = 29
export const SIM_CELL_SIZE = 16
export const SIM_DISEASE_SIZE = 8
export const SIM_BACKWALL_SIZE = 12
export const SIM_BACKWALL_SIZE_LEGACY = 4

export interface SimCell {
  elementHash: number
  properties: number
  insulation: number
  strengthInfo: number
  temperature: number
  mass: number
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

export type SimElementProfile = Pick<SimCell, 'properties' | 'insulation'>

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
    elementHash: view.getUint16(offset, true),
    properties: data.bytes[offset + 2],
    insulation: data.bytes[offset + 3],
    strengthInfo: data.bytes[offset + 4],
    temperature: view.getFloat32(offset + 8, true),
    mass: view.getFloat32(offset + 12, true),
  }
}

export function getSimCell(data: SimData, x: number, y: number): SimCell | undefined {
  return readSimCell(data, new DataView(data.bytes.buffer, data.bytes.byteOffset, data.bytes.byteLength), x, y)
}

/**
 * Returns the most common per-element property bytes in this save.
 * The SIM format stores these bytes separately from the element hash, and
 * copying them from a known cell keeps a replacement compatible with the
 * game's native cell state.
 */
export function getSimElementProfile(data: SimData, elementHash: number): SimElementProfile | undefined {
  const view = new DataView(data.bytes.buffer, data.bytes.byteOffset, data.bytes.byteLength)
  const profiles = new Map<string, { properties: number; insulation: number; count: number }>()
  for (let index = 0; index < data.cellCount; index++) {
    const offset = data.cellOffset + index * SIM_CELL_SIZE
    if (view.getUint16(offset, true) !== (elementHash & 0xffff)) continue
    const properties = data.bytes[offset + 2]
    const insulation = data.bytes[offset + 3]
    const key = `${properties}:${insulation}`
    const profile = profiles.get(key)
    if (profile) profile.count += 1
    else profiles.set(key, { properties, insulation, count: 1 })
  }
  let best: SimElementProfile | undefined
  let bestCount = -1
  profiles.forEach((profile) => {
    if (profile.count > bestCount) {
      bestCount = profile.count
      best = { properties: profile.properties, insulation: profile.insulation }
    }
  })
  return best
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
    if (patch.elementHash !== undefined) view.setUint16(offset, patch.elementHash & 0xffff, true)
    if (patch.properties !== undefined) bytes[offset + 2] = patch.properties & 0xff
    if (patch.insulation !== undefined) bytes[offset + 3] = patch.insulation & 0xff
    if (patch.strengthInfo !== undefined) bytes[offset + 4] = patch.strengthInfo & 0xff
    if (patch.temperature !== undefined && Number.isFinite(patch.temperature)) view.setFloat32(offset + 8, patch.temperature, true)
    if (patch.mass !== undefined && Number.isFinite(patch.mass)) view.setFloat32(offset + 12, Math.max(0, patch.mass), true)
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
