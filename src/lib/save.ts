import { unzlibSync, zlibSync } from 'fflate'
import { ByteReader, ByteWriter } from './binary'
import { parseTemplateDirectory } from './template'
import type { TypeTemplate } from './types'
import { readObjectMembers } from './deserialize'
import { writeObjectMembers } from './serialize'
import { parseSim, type SimData } from './sim'
import type {
  ObjectValue,
  SavedComponent,
  SavedObjectGroup,
  SavedObjectInstance,
} from './model'

export interface SaveHeader {
  buildVersion: number
  headerSize: number
  headerVersion: number
  compression: number
}

export interface ParsedSave {
  header: SaveHeader
  gameInfoJson: Record<string, unknown>
  templates: Map<string, TypeTemplate>
  /** Top-level serialized sections, in on-disk order. */
  sections: SaveSection[]
  // ---- UI conveniences ----
  saveFileRoot?: ObjectValue
  settings?: ObjectValue
  simSection?: SectionSim
  simData?: SimData
  manager?: SaveManagerSection
  gameData?: ObjectValue
}

export type SaveSection =
  | SectionWorld
  | SectionSettings
  | SectionSim
  | SaveManagerSection
  | SectionGameData

export interface SectionWorld {
  kind: 'world'
  value: ObjectValue
}
export interface SectionSettings {
  kind: 'settings'
  value: ObjectValue
}
export interface SectionSim {
  kind: 'sim'
  bytes: Uint8Array
}
export interface SectionGameData {
  kind: 'game-data'
  value: ObjectValue
}

/** SaveManager block: KSAV header + version + tag groups. */
export interface SaveManagerSection {
  kind: 'manager'
  saveHeader: string // "KSAV"
  majorVersion: number
  minorVersion: number
  groups: SavedObjectGroup[]
  /** The SaveGame singleton group is written first by the game. */
  saveGameGroupIndex: number
}

/**
 * Reads a typed top-level object (KleiString type-name + SerializeData) as the
 * game's Serializer.Serialize writes it. The trailing raw-remainder handling is
 * unnecessary for the known root types, so we require a template match.
 */
function readTypedObject(reader: ByteReader, templates: Map<string, TypeTemplate>): ObjectValue {
  const typeName = reader.readKleiString()!
  if (!templates.has(typeName)) throw new Error(`Top-level type ${typeName} not in template directory`)
  return readObjectMembers(reader, typeName, templates)
}

/** Reads the SaveManager prefab block. */
function readManager(reader: ByteReader, templates: Map<string, TypeTemplate>): SaveManagerSection {
  const saveHeader = readAscii(reader.readRaw(4))
  const majorVersion = reader.readI32()
  const minorVersion = reader.readI32()
  const count = reader.readI32()
  const groups: SavedObjectGroup[] = []
  let saveGameGroupIndex = -1
  for (let i = 0; i < count; i++) {
    const tag = reader.readKleiString()
    if (tag === null) break
    const n = reader.readI32()
    const byteLength = reader.readI32()
    if (tag === 'SaveGame') saveGameGroupIndex = groups.length
    const instances: SavedObjectInstance[] = []
    for (let k = 0; k < n; k++) {
      instances.push(readInstance(reader, templates))
    }
    groups.push({ tag, count: n, byteLength, instances })
  }
  return { kind: 'manager', saveHeader, majorVersion, minorVersion, groups, saveGameGroupIndex }
}

function readInstance(reader: ByteReader, templates: Map<string, TypeTemplate>): SavedObjectInstance {
  const position = { x: reader.readF32(), y: reader.readF32(), z: reader.readF32() }
  const rotation = { x: reader.readF32(), y: reader.readF32(), z: reader.readF32(), w: reader.readF32() }
  const scale = { x: reader.readF32(), y: reader.readF32(), z: reader.readF32() }
  const flag = reader.readU8()
  const nComponents = reader.readI32()
  const components: SavedComponent[] = []
  for (let i = 0; i < nComponents; i++) {
    const typeName = reader.readKleiString()!
    const length = reader.readI32()
    const start = reader.position
    const template = templates.get(typeName)
    if (!template) {
      const raw = reader.readBytes(length)
      components.push({ typeName, length, value: null, details: null, raw })
      continue
    }
    const value = readObjectMembers(reader, typeName, templates)
    const consumed = reader.position - start
    const details = reader.readBytes(length - consumed)
    components.push({ typeName, length, value, details, raw: null })
  }
  return { position, rotation, scale, flag, components }
}

function readAscii(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i])
  return out
}

function writeAscii(s: string): Uint8Array {
  const b = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff
  return b
}

/** Top-level parse entry. Reads all 5 sections strictly in order. */
export function parseSave(buffer: Uint8Array): ParsedSave {
  const r = new ByteReader(buffer)
  const buildVersion = r.readU32()
  const headerSize = r.readI32()
  const headerVersion = r.readU32()
  const compression = r.readI32()
  const headerBytes = r.readBytes(headerSize)
  const gameInfoJson = JSON.parse(new TextDecoder().decode(headerBytes))

  const templates = parseTemplateDirectory(r)

  let stream: ByteReader
  const remainingStart = r.position
  if (compression === 1) {
    const compressed = r.readBytes(r.length - remainingStart)
    const raw = unzlibSync(compressed)
    stream = new ByteReader(raw)
  } else {
    stream = new ByteReader(buffer.subarray(remainingStart))
  }

  const sections: SaveSection[] = []
  const result: ParsedSave = { header: { buildVersion, headerSize, headerVersion, compression }, gameInfoJson, templates, sections }

  const worldTag = stream.readKleiString()
  if (worldTag !== 'world') throw new Error(`Expected 'world' tag, got '${worldTag}'`)
  const world = readTypedObject(stream, templates)
  result.saveFileRoot = world
  sections.push({ kind: 'world', value: world })

  const settings = readTypedObject(stream, templates)
  result.settings = settings
  sections.push({ kind: 'settings', value: settings })

  const simLen = stream.readI32()
  const simBytes = stream.readBytes(simLen)
  result.simSection = { kind: 'sim', bytes: simBytes }
  result.simData = parseSim(simBytes)
  sections.push({ kind: 'sim', bytes: simBytes })

  const manager = readManager(stream, templates)
  result.manager = manager
  sections.push(manager)

  const gameData = readTypedObject(stream, templates)
  result.gameData = gameData
  sections.push({ kind: 'game-data', value: gameData })

  if (stream.remaining !== 0) {
    throw new Error(`Trailing data: ${stream.remaining} bytes unparsed after game data`)
  }
  return result
}

/** Serialize a full save file back to bytes. */
export function buildSave(save: ParsedSave): Uint8Array {
  const w = new ByteWriter()
  w.writeU32(save.header.buildVersion)
  w.writeI32(save.header.headerSize)
  w.writeU32(save.header.headerVersion)
  w.writeI32(save.header.compression)
  const headerBytes = new TextEncoder().encode(JSON.stringify(save.gameInfoJson))
  if (headerBytes.length !== save.header.headerSize) {
    // headerSize must reflect the JSON byte-length (it did originally)
    save.header.headerSize = headerBytes.length
  }
  w.writeRaw(headerBytes)

  // Template directory
  w.writeI32(save.templates.size)
  for (const template of save.templates.values()) {
    w.writeKleiString(template.typeName)
    w.writeI32(template.fields.length)
    w.writeI32(template.properties.length)
    for (const f of template.fields) {
      w.writeKleiString(f.name)
      writeTypeEncoding(w, f.type)
    }
    for (const p of template.properties) {
      w.writeKleiString(p.name)
      writeTypeEncoding(w, p.type)
    }
  }

  // Body
  const body = new ByteWriter()
  body.writeKleiString('world')
  body.writeKleiString(save.saveFileRoot!.typeName)
  writeObjectMembers(body, save.saveFileRoot!)
  body.writeKleiString(save.settings!.typeName)
  writeObjectMembers(body, save.settings!)
  const simBytes = save.simData?.bytes ?? save.simSection!.bytes
  save.simSection!.bytes = simBytes
  body.writeI32(simBytes.length)
  body.writeRaw(simBytes)
  writeManager(body, save.manager!)
  body.writeKleiString(save.gameData!.typeName)
  writeObjectMembers(body, save.gameData!)

  if (save.header.compression === 1) {
    const deflated = zlibSync(body.bytes, { level: 9 })
    w.writeRaw(deflated)
  } else {
    w.writeRaw(body.bytes)
  }
  return w.bytes
}

function writeTypeEncoding(w: ByteWriter, type: { info: number; typeName?: string; subTypes: Array<{ info: number; typeName?: string; subTypes: Array<any> }> }): void {
  const base = type.info & 0x3f
  w.writeU8(type.info)
  if ((type.info & 0x80) !== 0) {
    if (base === 0) w.writeKleiString(type.typeName!)
    w.writeU8(type.subTypes.length)
    for (const sub of type.subTypes) writeTypeEncoding(w, sub)
    return
  }
  if (base === 17 /* Array */) {
    writeTypeEncoding(w, type.subTypes[0])
    return
  }
  if (base === 0 || base === 13) {
    w.writeKleiString(type.typeName!)
  }
}

function writeManager(w: ByteWriter, m: SaveManagerSection): void {
  w.writeRaw(writeAscii(m.saveHeader))
  w.writeI32(m.majorVersion)
  w.writeI32(m.minorVersion)
  w.writeI32(m.groups.length)
  for (const g of m.groups) {
    w.writeKleiString(g.tag)
    w.writeI32(g.instances.length)
    const pos = w.length
    w.writeI32(0) // byteLength placeholder
    for (const inst of g.instances) writeInstance(w, inst)
    w.writeI32At(pos, w.length - (pos + 4))
  }
}

function writeInstance(w: ByteWriter, inst: SavedObjectInstance): void {
  w.writeF32(inst.position.x).writeF32(inst.position.y).writeF32(inst.position.z)
  w.writeF32(inst.rotation.x).writeF32(inst.rotation.y).writeF32(inst.rotation.z).writeF32(inst.rotation.w)
  w.writeF32(inst.scale.x).writeF32(inst.scale.y).writeF32(inst.scale.z)
  w.writeU8(inst.flag)
  w.writeI32(inst.components.length)
  for (const c of inst.components) {
    w.writeKleiString(c.typeName)
    const pos = w.length
    w.writeI32(0) // length placeholder
    if (c.value) writeObjectMembers(w, c.value)
    if (c.details) w.writeRaw(c.details)
    if (c.raw) w.writeRaw(c.raw)
    w.writeI32At(pos, w.length - (pos + 4))
  }
}

/** Recount a group's declared count/byteLength from its instances. */
export function recountGroup(g: SavedObjectGroup): void {
  g.count = g.instances.length
  g.byteLength = lengthOfGroup(g)
}

function lengthOfGroup(g: SavedObjectGroup): number {
  const w = new ByteWriter()
  for (const inst of g.instances) writeInstance(w, inst)
  return w.length
}
