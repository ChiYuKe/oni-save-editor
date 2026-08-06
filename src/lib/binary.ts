import type { SerializationTypeInt } from './types'

/**
 * A growable byte buffer writer, mirroring the semantics of .NET BinaryWriter
 * as used by ONI's KSerialization (little-endian, plus the "KleiString"
 * length-prefixed UTF-8 string format and fast float writes).
 */
export class ByteWriter {
  private _buf: Uint8Array
  private _view: DataView
  private _len = 0

  constructor(initialCapacity = 64) {
    this._buf = new Uint8Array(initialCapacity)
    this._view = new DataView(this._buf.buffer)
  }

  get length(): number {
    return this._len
  }

  get bytes(): Uint8Array {
    return this._buf.slice(0, this._len)
  }

  private ensure(size: number): void {
    const needed = this._len + size
    if (needed <= this._buf.length) return
    let cap = this._buf.length
    while (cap < needed) cap = cap === 0 ? 256 : cap * 2
    const next = new Uint8Array(cap)
    next.set(this._buf)
    this._buf = next
    this._view = new DataView(this._buf.buffer)
  }

  writeU8(v: number): this {
    this.ensure(1)
    this._buf[this._len++] = v & 0xff
    return this
  }

  writeI8(v: number): this {
    return this.writeU8(v)
  }

  writeU16(v: number): this {
    this.ensure(2)
    this._view.setUint16(this._len, v, true)
    this._len += 2
    return this
  }

  writeI16(v: number): this {
    this.ensure(2)
    this._view.setInt16(this._len, v, true)
    this._len += 2
    return this
  }

  writeU32(v: number): this {
    this.ensure(4)
    this._view.setUint32(this._len, v, true)
    this._len += 4
    return this
  }

  writeI32(v: number): this {
    this.ensure(4)
    this._view.setInt32(this._len, v, true)
    this._len += 4
    return this
  }

  writeI64(v: bigint): this {
    this.ensure(8)
    this._view.setBigInt64(this._len, v, true)
    this._len += 8
    return this
  }

  writeU64(v: bigint): this {
    this.ensure(8)
    this._view.setBigUint64(this._len, v, true)
    this._len += 8
    return this
  }

  // IEEE-754 little-endian, matches BinaryWriter.Write(float) on x86.
  writeF32(v: number): this {
    this.ensure(4)
    this._view.setFloat32(this._len, v, true)
    this._len += 4
    return this
  }

  writeF64(v: number): this {
    this.ensure(8)
    this._view.setFloat64(this._len, v, true)
    this._len += 8
    return this
  }

  writeBoolean(v: boolean): this {
    return this.writeU8(v ? 1 : 0)
  }

  writeRaw(bytes: Uint8Array): this {
    this.ensure(bytes.length)
    this._buf.set(bytes, this._len)
    this._len += bytes.length
    return this
  }

  writeI32At(pos: number, v: number): void {
    this._view.setInt32(pos, v, true)
  }

  /** KleiString: Int32 byte-length followed by UTF-8 bytes; -1 means null. */
  writeKleiString(str: string | null): this {
    if (str === null) {
      this.writeI32(-1)
      return this
    }
    const bytes = new TextEncoder().encode(str)
    this.writeI32(bytes.length)
    this.writeRaw(bytes)
    return this
  }
}

/**
 * Big-endian-aware reader over a fixed byte buffer, mirroring IReader (FastReader).
 * All multi-byte primitives are read little-endian like BinaryReader on x86.
 */
export class ByteReader {
  private readonly _buf: Uint8Array
  private readonly _view: DataView
  private _pos: number

  constructor(bytes: Uint8Array, offset = 0) {
    this._buf = bytes
    this._view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    this._pos = offset
  }

  get position(): number {
    return this._pos
  }

  get length(): number {
    return this._buf.length
  }

  get remaining(): number {
    return this._buf.length - this._pos
  }

  seek(pos: number): void {
    if (pos < 0 || pos > this._buf.length) throw new RangeError(`seek out of range: ${pos}`)
    this._pos = pos
  }

  readU8(): number {
    return this._buf[this._pos++]
  }

  readI8(): number {
    return this._buf[this._pos++] << 24 >> 24
  }

  readU16(): number {
    const v = this._view.getUint16(this._pos, true)
    this._pos += 2
    return v
  }

  readI16(): number {
    const v = this._view.getInt16(this._pos, true)
    this._pos += 2
    return v
  }

  readU32(): number {
    const v = this._view.getUint32(this._pos, true)
    this._pos += 4
    return v
  }

  readI32(): number {
    const v = this._view.getInt32(this._pos, true)
    this._pos += 4
    return v
  }

  readI64(): bigint {
    const v = this._view.getBigInt64(this._pos, true)
    this._pos += 8
    return v
  }

  readU64(): bigint {
    const v = this._view.getBigUint64(this._pos, true)
    this._pos += 8
    return v
  }

  readF32(): number {
    const v = this._view.getFloat32(this._pos, true)
    this._pos += 4
    return v
  }

  readF64(): number {
    const v = this._view.getFloat64(this._pos, true)
    this._pos += 8
    return v
  }

  readBoolean(): boolean {
    return this.readU8() === 1
  }

  readRaw(count: number): Uint8Array {
    const out = this._buf.subarray(this._pos, this._pos + count)
    this._pos += count
    return out
  }

  readBytes(count: number): Uint8Array {
    const out = this._buf.slice(this._pos, this._pos + count)
    this._pos += count
    return out
  }

  skip(count: number): void {
    this._pos += count
    if (this._pos > this._buf.length) throw new RangeError('skip past end')
  }

  /** KleiString: Int32 byte-length followed by UTF-8 bytes; -1 means null. */
  readKleiString(): string | null {
    const len = this.readI32()
    if (len < 0) return null
    const bytes = this.readRaw(len)
    return new TextDecoder().decode(bytes)
  }

  bytes(): Uint8Array {
    return this._buf.slice(0, this._buf.length)
  }
}

/** Small helper so call sites read naturally: `reader.position`. */
export function readTypeInfoMark(reader: ByteReader): SerializationTypeInt {
  return (reader.readU8() & TYPE_INFO_MASK) as SerializationTypeInt
}

// mask constants mirroring KSerialization.SerializationTypeInfo flags
export const TYPE_INFO_MASK = 0xff
export const VALUE_MASK = 0x3f
export const IS_GENERIC_TYPE = 0x80
export const IS_VALUE_TYPE = 0x40