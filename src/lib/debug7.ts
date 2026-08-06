import { readFileSync } from 'node:fs'
import { ByteReader, ByteWriter } from './binary'
import { parseTemplateDirectory } from './template'
import type { TypeInfo } from './types'

const SAVE = process.argv[2]
const buf = new Uint8Array(readFileSync(SAVE))
const r = new ByteReader(buf)
r.readU32(); const headerSize = r.readI32(); r.readU32(); r.readI32(); r.readBytes(headerSize)
const start = r.position
const templates = parseTemplateDirectory(r)
const origDir = buf.subarray(start, r.position)
const sf = templates.get('Klei.SaveFileRoot')!
console.log('SaveFileRoot fields:', sf.fields.map((f) => `${f.name}[${f.type.info.toString(16)}]`).join(', '))
console.log('SaveFileRoot props:', sf.properties.map((p) => `${p.name}[${p.type.info.toString(16)}]`).join(', '))

function dump(label, bytes, from, to) {
  console.log(label)
  let line = ''
  for (let i = from; i < to; i++) line += String.fromCharCode(bytes[i] === 0x0a ? 0x2e : bytes[i] >= 0x20 && bytes[i] < 0x7f ? bytes[i] : 0x2e)
  console.log(line)
  console.log(Array.from(bytes.subarray(from, to)).map((x) => x.toString(16).padStart(2, '0')).join(' '))
}

console.log('---- ORIGINAL dir first 80 bytes ----')
dump('orig', origDir, 0, 80)