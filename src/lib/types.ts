/**
 * SerializationTypeInfo values from KSerialization (Assembly-CSharp-firstpass).
 * In the actual file bytes the flag bits (IS_GENERIC_TYPE / IS_VALUE_TYPE) may be
 * OR'd into the low 6 bits, exactly as EncodeSerializationType produces them.
 */
export const SerializationTypeInfo = {
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
  IS_GENERIC_TYPE: 128,
  IS_VALUE_TYPE: 64,
  VALUE_MASK: 63,
} as const

export type SerializationTypeInt = (typeof SerializationTypeInfo)[keyof typeof SerializationTypeInfo]

/**
 * The encoded type info of a field, as written by SerializationTemplate.WriteType.
 *
 * Wire format:
 *   byte  info                       (SerializationTypeInfo | flags)
 *   if generic:
 *     if user-defined:   KleiString(type full name)
 *     byte  genericArgCount
 *     for each arg:      <recursive type encoding>
 *   else if array:
 *     <recursive type encoding of element>
 *   else if enum or user-defined:
 *     KleiString(type full name)
 */
export interface TypeInfo {
  /** Raw byte including flag bits (matches SerializationTemplate.WriteType output). */
  info: number
  /** Full type name for user-defined/enum types (e.g. "Klei.SaveFileRoot"). */
  typeName?: string
  /** Sub-type encodings: array element, or generic arguments. */
  subTypes: TypeInfo[]
}

/** Full template directory entry: type name -> ordered list of marshalled members. */
export interface TypeTemplate {
  typeName: string
  fields: Array<{ name: string; type: TypeInfo }>
  properties: Array<{ name: string; type: TypeInfo }>
}
