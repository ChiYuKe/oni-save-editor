import { readFileSync } from 'node:fs'
import { ByteReader } from './binary'
import { parseTemplateDirectory } from './template'
import { inflateSync } from 'fflate'

const SAVE = process.argv[2]
const buf = new Uint8Array(readFileSync(SAVE))
const r = new ByteReader(buf)
const buildVersion = r.readU32()
const headerSize = r.readI32()
const headerVersion = r.readU32()
const compression = r.readI32()
console.log('hdr', { buildVersion, headerSize, headerVersion, compression })
r.readBytes(headerSize)
const templates = parseTemplateDirectory(r)
console.log('templates:', templates.size, 'position after dir:', r.position)
const tail = buf.subarray(r.position)
console.log('tail bytes:', tail.length, 'tail magic:', Array.from(tail.subarray(0, 4)).map((x) => x.toString(16).padStart(2, '0')).join(' '))
try {
  const out = inflateSync(tail)
  console.log('inflate ok:', out.length)
} catch (e) {
  console.log('inflate FAIL:', (e as Error).message)
}