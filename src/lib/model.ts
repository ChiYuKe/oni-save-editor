import type { TypeInfo } from './types'

/**
 * The parsed value tree. It intentionally mirrors the on-disk structure 1:1 so
 * that deserialization followed by serialization is byte-identical (idempotent).
 *
 * - User-defined objects are stored as ordered member lists {members: [...]}.
 * - Dictionaries store values first, then keys (as on disk), preserving order.
 */
export interface ObjectValue {
  kind: 'object'
  typeName: string
  members: Array<MemberValue>
}

export interface MemberValue {
  name: string
  type: TypeInfo
  value: Value
}

export interface ListValue {
  kind: 'list'
  elementType: TypeInfo
  items: Value[]
}

export interface DictValue {
  kind: 'dict'
  keyType: TypeInfo
  valueType: TypeInfo
  /** On-disk order: all values first, then all keys. */
  values: Value[]
  keys: Value[]
}

export interface PairValue {
  kind: 'pair'
  keyType: TypeInfo
  valueType: TypeInfo
  key: Value
  value: Value
}

export type ScalarValue =
  | { kind: 'sbyte'; v: number }
  | { kind: 'byte'; v: number }
  | { kind: 'int16'; v: number }
  | { kind: 'uint16'; v: number }
  | { kind: 'int32'; v: number }
  | { kind: 'uint32'; v: number }
  | { kind: 'int64'; v: bigint }
  | { kind: 'uint64'; v: bigint }
  | { kind: 'single'; v: number }
  | { kind: 'double'; v: number }
  | { kind: 'boolean'; v: boolean }
  | { kind: 'string'; v: string | null }
  | { kind: 'enum'; typeName: string; v: number }
  | { kind: 'vector2i'; x: number; y: number }
  | { kind: 'vector2'; x: number; y: number }
  | { kind: 'vector3'; x: number; y: number; z: number }
  | { kind: 'colour'; r: number; g: number; b: number; a: number }

export interface RawPodValue {
  kind: 'raw-pod'
  elementType: TypeInfo
  count: number
  bytes: Uint8Array
}

export type RefValue =
  | ObjectValue
  | ListValue
  | DictValue
  | PairValue
  | RawPodValue
  | { kind: 'null' }
  | { kind: 'raw'; type: TypeInfo; bytes: Uint8Array }

export type Value = ScalarValue | RefValue

export function makeNull(): Value {
  return { kind: 'null' }
}

/** One saved prefab instance inside a SaveManager tag group. */
export interface SavedObjectInstance {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
  scale: { x: number; y: number; z: number }
  /** Always 0 in practice; written as a single byte. */
  flag: number
  components: SavedComponent[]
}

/**
 * A component serialized on a prefab.
 * - `value` is the KSerialization member tree (parsed via the template
 *   directory) when the type is known.
 * - `details` is the trailing raw bytes: ISaveLoadableDetails extra data and/or
 *   the component's CustomSerialize output. Kept verbatim for round-trip.
 * - `raw` is set when the component type is NOT in the template directory;
 *   then the whole payload is opaque.
 */
export interface SavedComponent {
  typeName: string
  /** Declared payload length; recomputed on write. */
  length: number
  value: ObjectValue | null
  details: Uint8Array | null
  raw: Uint8Array | null
}

/** A group of prefab instances sharing a Tag (e.g. "Ladder", "Minion"). */
export interface SavedObjectGroup {
  tag: string
  count: number
  byteLength: number
  instances: SavedObjectInstance[]
}