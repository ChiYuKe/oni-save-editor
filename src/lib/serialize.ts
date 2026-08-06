import { ByteWriter, VALUE_MASK } from './binary'
import type { TypeInfo, TypeTemplate } from './types'
import type { DictValue, ListValue, MemberValue, ObjectValue, PairValue, Value } from './model'
import type { RawPodValue } from './model'
import { BASE } from './deserialize'

function isValueType(info: number): boolean {
  return (info & 0x40) !== 0
}

function patchLength(writer: ByteWriter, pos: number): void {
  writer.writeI32At(pos, writer.length - (pos + 4))
}

function patchCollectionLength(writer: ByteWriter, pos: number): void {
  // KSerialization collection lengths exclude the count field itself.
  writer.writeI32At(pos, writer.length - (pos + 8))
}

/** Write one value according to TypeInfo (mirrors Helper.WriteValue). */
export function writeValue(writer: ByteWriter, type: TypeInfo, value: Value): void {
  const base = type.info & VALUE_MASK
  switch (base) {
    case BASE.UserDefined: {
      if (value.kind === 'null') {
        writer.writeI32(-1)
        return
      }
      if (value.kind !== 'object') throw new Error(`type ${type.typeName} expected object value`)
      const pos = writer.length
      writer.writeI32(0)
      writeObjectMembers(writer, value)
      patchLength(writer, pos)
      return
    }
    case BASE.SByte: writer.writeI8((value as { v: number }).v); return
    case BASE.Byte: writer.writeU8((value as { v: number }).v); return
    case BASE.Boolean: writer.writeU8((value as { v: boolean }).v ? 1 : 0); return
    case BASE.Int16: writer.writeI16((value as { v: number }).v); return
    case BASE.UInt16: writer.writeU16((value as { v: number }).v); return
    case BASE.Int32: writer.writeI32((value as { v: number }).v); return
    case BASE.UInt32: writer.writeU32((value as { v: number }).v); return
    case BASE.Int64: writer.writeI64((value as { v: bigint }).v); return
    case BASE.UInt64: writer.writeU64((value as { v: bigint }).v); return
    case BASE.Single: writer.writeF32((value as { v: number }).v); return
    case BASE.Double: writer.writeF64((value as { v: number }).v); return
    case BASE.String: writer.writeKleiString((value as { v: string | null }).v); return
    case BASE.Enumeration: writer.writeI32((value as { v: number }).v); return
    case BASE.Vector2I: {
      const v = value as { x: number; y: number }
      writer.writeI32(v.x).writeI32(v.y)
      return
    }
    case BASE.Vector2: {
      const v = value as { x: number; y: number }
      writer.writeF32(v.x).writeF32(v.y)
      return
    }
    case BASE.Vector3: {
      const v = value as { x: number; y: number; z: number }
      writer.writeF32(v.x).writeF32(v.y).writeF32(v.z)
      return
    }
    case BASE.Colour: {
      const v = value as { r: number; g: number; b: number; a: number }
      writer.writeU8(v.r).writeU8(v.g).writeU8(v.b).writeU8(v.a)
      return
    }
    case BASE.Array: {
      if (value.kind === 'null') {
        writer.writeI32(0)
        writer.writeI32(-1)
        return
      }
      const elem = type.subTypes[0]
      const pos = writer.length
      writer.writeI32(0)
      writeCollectionBody(writer, value, elem)
      patchCollectionLength(writer, pos)
      return
    }
    case BASE.List:
    case BASE.Queue: {
      if (value.kind === 'null') {
        writer.writeI32(0)
        writer.writeI32(-1)
        return
      }
      const elem = type.subTypes[0]
      const pos = writer.length
      writer.writeI32(0)
      writeCollectionBody(writer, value, elem)
      patchCollectionLength(writer, pos)
      return
    }
    case BASE.HashSet: {
      if (value.kind === 'null') {
        writer.writeI32(0)
        writer.writeI32(-1)
        return
      }
      const elem = type.subTypes[0]
      const pos = writer.length
      writer.writeI32(0)
      writer.writeI32(0) // count placeholder, patched after elements
      if (value.kind !== 'list' && value.kind !== 'raw-pod') throw new Error('expected list value')
      writeElements(writer, value, elem)
      const countPos = pos + 4
      writer.writeI32At(countPos, listCount(value))
      patchCollectionLength(writer, pos)
      return
    }
    case BASE.Pair: {
      if (value.kind === 'null') {
        writer.writeI32(4)
        writer.writeI32(-1)
        return
      }
      const p = value as PairValue
      const pos = writer.length
      writer.writeI32(0)
      writeValue(writer, p.keyType, p.key)
      writeValue(writer, p.valueType, p.value)
      patchLength(writer, pos)
      return
    }
    case BASE.Dictionary: {
      if (value.kind === 'null') {
        writer.writeI32(0)
        writer.writeI32(-1)
        return
      }
      const d = value as DictValue
      const pos = writer.length
      writer.writeI32(0)
      writer.writeI32(d.keys.length)
      for (const v of d.values) writeValue(writer, d.valueType, v)
      for (const k of d.keys) writeValue(writer, d.keyType, k)
      patchCollectionLength(writer, pos)
      return
    }
    default:
      throw new Error(`Unknown value type ${base}`)
  }
}

function listCount(value: Value): number {
  if (value.kind === 'raw-pod') return value.count
  if (value.kind === 'list') return value.items.length
  throw new Error('expected list value')
}

/** Writes elements after the count integer: POD raw, value-type members, else WriteValue. */
function writeCollectionBody(writer: ByteWriter, value: Value, elem: TypeInfo): void {
  if (value.kind === 'raw-pod') {
    const rp = value as RawPodValue
    writer.writeI32(rp.count)
    writer.writeRaw(rp.bytes)
    return
  }
  if (value.kind !== 'list') throw new Error('expected list value')
  const list = value as ListValue
  writer.writeI32(list.items.length)
  writeElements(writer, list, elem)
}

function writeElements(writer: ByteWriter, list: ListValue | RawPodValue, elem: TypeInfo): void {
  if (list.kind === 'raw-pod') {
    writer.writeRaw(list.bytes)
    return
  }
  const items = list.items
  if (isValueType(elem.info)) {
    for (const item of items) writeObjectMembers(writer, item as ObjectValue)
  } else {
    for (const item of items) writeValue(writer, elem, item)
  }
}

/** Writes an object's members (fields then properties per its template). */
export function writeObjectMembers(writer: ByteWriter, obj: ObjectValue): void {
  for (const m of obj.members) {
    writeValue(writer, m.type, m.value)
  }
}

/** Writes a template's members according to a template's declared order. */
export function writeTemplateMembers(writer: ByteWriter, template: TypeTemplate, members: MemberValue[]): void {
  const byName = new Map(members.map((m) => [m.name, m]))
  for (const f of template.fields) {
    writeValue(writer, f.type, byName.get(f.name)!.value)
  }
  for (const p of template.properties) {
    writeValue(writer, p.type, byName.get(p.name)!.value)
  }
}
