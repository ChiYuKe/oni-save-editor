import { readFileSync } from 'node:fs'
import { ByteReader } from './binary'
import { parseTemplateDirectory } from './template'
import { unzlibSync } from 'fflate'

const SAVE = process.argv[2]
const r = new ByteReader(new Uint8Array(readFileSync(SAVE)))
r.readU32()
const headerSize = r.readI32()
r.readU32()
r.readI32()
r.readBytes(headerSize)
const templates = parseTemplateDirectory(r)
console.log('original directory parsed ok, templates:', templates.size, 'bytes:', r.position)

// Rebuild only the directory and measure its byte length
const { buildSave, parseSave } = await import('./save')
const s = parseSave(new Uint8Array(readFileSync(SAVE)))
const b1 = buildSave(s)

// Now parse the built file's directory
const b2r = new ByteReader(b1)
b2r.readU32()
const h2 = b2r.readI32()
b2r.readU32()
b2r.readI32()
b2r.readBytes(h2)
try {
  const t2 = parseTemplateDirectory(b2r)
  console.log('built directory parsed ok, templates:', t2.size, 'bytes:', b2r.position, 'orig was:', r.position)
} catch (e) {
  console.log('built directory FAIL at byte', b2r.position, ':', (e as Error).message)
}