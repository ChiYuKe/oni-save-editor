import { readFileSync } from 'node:fs'
import { ByteReader, ByteWriter } from './binary'
import { parseTemplateDirectory } from './template'
import type { TypeInfo } from './types'

const SAVE = process.argv[2]
const buf = new Uint8Array(readFileSync(SAVE))
function readDir(offsetFn: () => number, getBuf: () => Uint8Array): { dir: Uint8Array; templatesCount: number } {
  const r = new ByteReader(getBuf())
  r.readU32()
  const headerSize = r.readI32()
  r.readU32()
  r.readI32()
  r.readBytes(headerSize)
  const start = r.position
  const templates = parseTemplateDirectory(r)
  void offsetFn
  return { dir: getBuf().subarray(start, r.position), templatesCount: templates.size }
}

const orig = readDir(() => 0, () => buf)
console.log('orig dir bytes:', orig.dir.length)

// Rebuild the directory alone via the same writing routine used by buildSave
const { parseSave, buildSave } = await import('./save')
const s = parseSave(buf)
const b1 = buildSave(s)
const r2 = new ByteReader(b1)
r2.readU32()
const h2 = r2.readI32()
r2.readU32()
r2.readI32()
r2.readBytes(h2)
const b2Start = r2.position
const t2 = parseTemplateDirectory(r2)
const builtDir = b1.subarray(b2Start, r2.position)
console.log('built dir bytes:', builtDir.length)

// find first differing byte
let i = 0
const n = Math.min(orig.dir.length, builtDir.length)
while (i < n && orig.dir[i] === builtDir[i]) i++
console.log('first diff at:', i, 'of', n)
if (i < n - 6) {
  console.log('orig:', Array.from(orig.dir.subarray(i, i + 8)).map((x) => x.toString(16).padStart(2, '0')).join(' '))
  console.log('built:', Array.from(builtDir.subarray(i, i + 8)).map((x) => x.toString(16).padStart(2, '0')).join(' '))
  console.log('orig ascii:', new TextDecoder().decode(orig.dir.subarray(i, i + 16)))
  console.log('built ascii:', new TextDecoder().decode(builtDir.subarray(i, i + 16)))
}