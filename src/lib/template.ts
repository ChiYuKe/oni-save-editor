import { ByteReader } from './binary'
import type { TypeInfo, TypeTemplate } from './types'
import { VALUE_MASK } from './binary'

/**
 * Parses the KSerialization "template directory" that appears at the start of
 * the (decompressed) save payload. Each entry describes a marshalled .NET type:
 * its serializable fields and properties with their encoded TypeInfo.
 *
 * The directory is self-describing: we can use it to drive both deserialization
 * and re-serialization without hard-coding game types, which keeps the editor
 * compatible across game version updates (the 623 templates in a v7.38 save
 * include everything the game itself knew how to serialize).
 */
export function parseTemplateDirectory(reader: ByteReader): Map<string, TypeTemplate> {
  const count = reader.readI32()
  const templates = new Map<string, TypeTemplate>()
  for (let i = 0; i < count; i++) {
    const typeName = reader.readKleiString()!
    const fieldsCount = reader.readI32()
    const propertiesCount = reader.readI32()
    const fields: TypeTemplate['fields'] = []
    for (let f = 0; f < fieldsCount; f++) {
      const name = reader.readKleiString()!
      const type = readTypeEncoding(reader)
      fields.push({ name, type })
    }
    const properties: TypeTemplate['properties'] = []
    for (let p = 0; p < propertiesCount; p++) {
      const name = reader.readKleiString()!
      const type = readTypeEncoding(reader)
      properties.push({ name, type })
    }
    templates.set(typeName, { typeName, fields, properties })
  }
  return templates
}

/** Reads one member type encoding (mirrors SerializationTemplate.WriteType). */
function readTypeEncoding(reader: ByteReader): TypeInfo {
  const raw = reader.readU8()
  const info = raw
  const base = info & VALUE_MASK

  // Array: element type follows recursively.
  if (base === 17 /* Array */) {
    const subtype = readTypeEncoding(reader)
    return { info, subTypes: [subtype] }
  }

  // Generic type: for user-defined generic, a KleiString type name first.
  if ((info & 0x80) !== 0 /* IS_GENERIC_TYPE */) {
    let typeName: string | undefined
    if (base === 0 /* UserDefined */) {
      typeName = reader.readKleiString()!
    }
    const argCount = reader.readU8()
    const subTypes: TypeInfo[] = []
    for (let i = 0; i < argCount; i++) subTypes.push(readTypeEncoding(reader))
    return { info, typeName, subTypes }
  }

  // Enum or user-defined: KleiString full type name.
  if (base === 0 /* UserDefined */ || base === 13 /* Enumeration */) {
    const typeName = reader.readKleiString()!
    return { info, typeName, subTypes: [] }
  }

  return { info, subTypes: [] }
}

export function typeInfoToString(ti: TypeInfo): string {
  const names: { [k: number]: string } = {
    0: 'Object',
    1: 'sbyte',
    2: 'byte',
    3: 'bool',
    4: 'short',
    5: 'ushort',
    6: 'int',
    7: 'uint',
    8: 'long',
    9: 'ulong',
    10: 'float',
    11: 'double',
    12: 'string',
    13: 'enum',
    14: 'Vector2I',
    15: 'Vector2',
    16: 'Vector3',
    17: '[]',
    18: 'KVP',
    19: 'Dictionary',
    20: 'List',
    21: 'HashSet',
    22: 'Queue',
    23: 'Color',
  }
  const base = ti.info & VALUE_MASK
  if (ti.typeName) return ti.typeName
  const n = names[base] ?? `T${base}`
  const subs = ti.subTypes.map(typeInfoToString).join(', ')
  if (base === 17) return subs + '[]'
  if (base === 19 || base === 20 || base === 21 || base === 22 || base === 18) {
    return `${n}<${subs}>`
  }
  return n
}