import { readFileSync } from 'node:fs'
import { ByteReader, ByteWriter } from './binary'
import { parseTemplateDirectory } from './template'
import type { TypeInfo, TypeTemplate } from './types'

const SAVE = process.argv[2]
const buf = new Uint8Array(readFileSync(SAVE))
const r = new ByteReader(buf)
r.readU32()
const headerSize = r.readI32()
r.readU32()
r.readI32()
r.readBytes(headerSize)
const start = r.position
const templates = parseTemplateDirectory(r)
const origDir = buf.subarray(start, r.position)
console.log('orig dir bytes:', origDir.length, 'templates:', templates.size)

// Rebuild the directory with the same writer logic as buildSave
function writeTypeEncoding(w: ByteWriter, type: TypeInfo): void {
  const base = type.info & 0x3f
  w.writeU8(type.info)
  if ((type.info & 0x80) !== 0) {
    if (base === 0) w.writeKleiString(type.typeName!)
    w.writeU8(type.subTypes.length)
    for (const sub of type.subTypes) writeTypeEncoding(w, sub)
    return
  }
  if (base === 17) {
    writeTypeEncoding(w, type.subTypes[0])
    return
  }
  if (base === 0 || base === 13) {
    w.writeKleiString(type.typeName!)
  }
}

const w = new ByteWriter()
w.writeI32(templates.size)
for (const t of templates.values()) {
  w.writeKleiString(t.typeName)
  w.writeI32(t.fields.length)
  w.writeI32(t.properties.length)
  for (const f of t.fields) {
    w.writeKleiString(f.name)
    writeTypeEncoding(w, f.type)
  }
  for (const p of t.properties) {
    w.writeKleiString(p.name)
    writeTypeEncoding(w, p.type)
  }
}
const builtDir = w.bytes
console.log('built dir bytes:', builtDir.length)

let i = 0
const n = Math.min(origDir.length, builtDir.length)
while (i < n && origDir[i] === builtDir[i]) i++
console.log('first diff at:', i, 'of', n)
if (i < n - 8) {
  console.log('orig: ', Array.from(origDir.subarray(i, i + 8)).map((x) => x.toString(16).padStart(2, '0')).join(' '))
  console.log('built:', Array.from(builtDir.subarray(i, i + 8)).map((x) => x.toString(16).padStart(2, '0')).join(' '))
  console.log('orig text: ', JSON.stringify(new TextDecoder().decode(origDir.subarray(Math.max(0, i - 20), i + 20))))
  console.log('built text:', JSON.stringify(new TextDecoder().decode(builtDir.subarray(Math.max(0, i - 20), i + 20))))
}