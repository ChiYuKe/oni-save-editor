import { ByteReader } from './binary'
import { VALUE_MASK } from './binary'
import type { TypeInfo, TypeTemplate } from './types'
import type { ObjectValue, MemberValue, Value } from './model'

export const BASE = {
  UserDefined: 0,
  SByte: 1,
  Byte: 2,
  Boolean: 3,
  Int16: 4,
  UInt16: 5,
  Int32: 6,
  UInt32: 7,
  Int64: 8,
  UInt64: 9,
  Single: 10,
  Double: 11,
  String: 12,
  Enumeration: 13,
  Vector2I: 14,
  Vector2: 15,
  Vector3: 16,
  Array: 17,
  Pair: 18,
  Dictionary: 19,
  List: 20,
  HashSet: 21,
  Queue: 22,
  Colour: 23,
} as const

const POD_SIZE: Record<number, number> = {
  [BASE.SByte]: 1,
  [BASE.Byte]: 1,
  [BASE.Int16]: 2,
  [BASE.UInt16]: 2,
  [BASE.Int32]: 4,
  [BASE.UInt32]: 4,
  [BASE.Int64]: 8,
  [BASE.UInt64]: 8,
  [BASE.Single]: 4,
  [BASE.Double]: 8,
}

function isPOD(info: number): boolean {
  return POD_SIZE[info & VALUE_MASK] !== undefined
}

function isValueType(info: number): boolean {
  // IS_VALUE_TYPE flag (0x40) in the raw byte
  return (info & 0x40) !== 0
}

/** Read POD elements as raw bytes (fast path, preserves bytes exactly). */
function readPodRaw(reader: ByteReader, elementType: TypeInfo, count: number) {
  const size = POD_SIZE[elementType.info & VALUE_MASK]!
  const bytes = reader.readBytes(count * size)
  return { kind: 'raw-pod' as const, elementType, count, bytes }
}

/** Read one value according to TypeInfo (mirrors DeserializationMapping.ReadValue). */
export function readValue(reader: ByteReader, type: TypeInfo, templates: Map<string, TypeTemplate>): Value {
  const base = type.info & VALUE_MASK
  switch (base) {
    case BASE.UserDefined: {
      const len = reader.readI32()
      if (len < 0) return { kind: 'null' }
      return readObjectMembers(reader, type.typeName!, templates)
    }
    case BASE.SByte: return { kind: 'sbyte', v: reader.readI8() }
    case BASE.Byte: return { kind: 'byte', v: reader.readU8() }
    case BASE.Boolean: return { kind: 'boolean', v: reader.readU8() === 1 }
    case BASE.Int16: return { kind: 'int16', v: reader.readI16() }
    case BASE.UInt16: return { kind: 'uint16', v: reader.readU16() }
    case BASE.Int32: return { kind: 'int32', v: reader.readI32() }
    case BASE.UInt32: return { kind: 'uint32', v: reader.readU32() }
    case BASE.Int64: return { kind: 'int64', v: reader.readI64() }
    case BASE.UInt64: return { kind: 'uint64', v: reader.readU64() }
    case BASE.Single: return { kind: 'single', v: reader.readF32() }
    case BASE.Double: return { kind: 'double', v: reader.readF64() }
    case BASE.String: return { kind: 'string', v: reader.readKleiString() }
    case BASE.Enumeration: return { kind: 'enum', typeName: type.typeName ?? 'enum', v: reader.readI32() }
    case BASE.Vector2I: return { kind: 'vector2i', x: reader.readI32(), y: reader.readI32() }
    case BASE.Vector2: return { kind: 'vector2', x: reader.readF32(), y: reader.readF32() }
    case BASE.Vector3: return { kind: 'vector3', x: reader.readF32(), y: reader.readF32(), z: reader.readF32() }
    case BASE.Colour: {
      return { kind: 'colour', r: reader.readU8(), g: reader.readU8(), b: reader.readU8(), a: reader.readU8() }
    }
    case BASE.Array: {
      reader.readI32() // byte length, ignored
      const count = reader.readI32()
      if (count < 0) return { kind: 'null' }
      const elem = type.subTypes[0]
      if (isPOD(elem.info)) return readPodRaw(reader, elem, count)
      if (isValueType(elem.info)) {
        return readObjectElements(reader, elem, count, templates)
      }
      const items: Value[] = []
      for (let i = 0; i < count; i++) items.push(readValue(reader, elem, templates))
      return { kind: 'list', elementType: elem, items }
    }
    case BASE.Pair: {
      const len = reader.readI32()
      if (len < 0) return { kind: 'null' }
      const keyType = type.subTypes[0]
      const valueType = type.subTypes[1]
      const key = readValue(reader, keyType, templates)
      const value = readValue(reader, valueType, templates)
      return { kind: 'pair', keyType, valueType, key, value }
    }
    case BASE.Dictionary: {
      reader.readI32() // byte length, ignored
      const count = reader.readI32()
      if (count < 0) return { kind: 'null' }
      const keyType = type.subTypes[0]
      const valueType = type.subTypes[1]
      const values: Value[] = []
      for (let i = 0; i < count; i++) values.push(readValue(reader, valueType, templates))
      const keys: Value[] = []
      for (let i = 0; i < count; i++) keys.push(readValue(reader, keyType, templates))
      return { kind: 'dict', keyType, valueType, values, keys }
    }
    case BASE.List:
    case BASE.Queue: {
      reader.readI32()
      const count = reader.readI32()
      if (count < 0) return { kind: 'null' }
      const elem = type.subTypes[0]
      if (isPOD(elem.info)) return readPodRaw(reader, elem, count)
      if (isValueType(elem.info)) return readObjectElements(reader, elem, count, templates)
      const items: Value[] = []
      for (let i = 0; i < count; i++) items.push(readValue(reader, elem, templates))
      return { kind: 'list', elementType: elem, items }
    }
    case BASE.HashSet: {
      reader.readI32()
      const count = reader.readI32()
      if (count < 0) return { kind: 'null' }
      const elem = type.subTypes[0]
      if (isValueType(elem.info)) return readObjectElements(reader, elem, count, templates)
      const items: Value[] = []
      for (let i = 0; i < count; i++) items.push(readValue(reader, elem, templates))
      return { kind: 'list', elementType: elem, items }
    }
    default:
      throw new Error(`Unknown value type ${base} for ${type.typeName ?? ''}`)
  }
}

/**
 * Reads a template's members in order (fields then properties). Returns the
 * object plus the number of bytes consumed by the members themselves.
 */
export function readObjectMembers(reader: ByteReader, typeName: string, templates: Map<string, TypeTemplate>): ObjectValue {
  const template = templates.get(typeName)
  if (!template) {
    throw new Error(`Unknown serialized type: ${typeName}`)
  }
  const members: MemberValue[] = []
  for (const f of template.fields) {
    members.push({ name: f.name, type: f.type, value: readValue(reader, f.type, templates) })
  }
  for (const p of template.properties) {
    members.push({ name: p.name, type: p.type, value: readValue(reader, p.type, templates) })
  }
  return { kind: 'object', typeName, members }
}

/**
 * Reads N elements of a value type (structs serialized via SerializeData,
 * i.e. no per-element length prefix).
 */
function readObjectElements(reader: ByteReader, type: TypeInfo, count: number, templates: Map<string, TypeTemplate>): Value {
  const typeName = type.typeName!
  const items: Value[] = []
  for (let i = 0; i < count; i++) {
    items.push(readObjectMembers(reader, typeName, templates))
  }
  return { kind: 'list', elementType: type, items }
}
