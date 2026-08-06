import { readFileSync } from 'node:fs'
import { ByteReader } from './binary'
import { parseTemplateDirectory } from './template'
import { inflateSync, unzlibSync, inflate } from 'fflate'

const SAVE = process.argv[2]
const buf = new Uint8Array(readFileSync(SAVE))
const r = new ByteReader(buf)
r.readU32()
const headerSize = r.readI32()
r.readU32()
const compression = r.readI32()
r.readBytes(headerSize)
const templates = parseTemplateDirectory(r)
const tail = buf.subarray(r.position)

console.log('tail magic:', Array.from(tail.subarray(0, 3)).map((x) => x.toString(16).padStart(2, '0')).join(' '))

for (const [name, fn] of [
  ['inflateSync', () => inflateSync(tail)],
  ['unzlibSync', () => unzlibSync(tail)],
] as const) {
  try {
    const out = fn()
    console.log(`${name}: ok ${out.length}`)
  } catch (e) {
    console.log(`${name}: FAIL ${(e as Error).message}`)
  }
}

// async inflate with callback
inflate(tail, (err, out) => {
  if (err) console.log('inflate async: FAIL', err.message)
  else console.log('inflate async: ok', out.length)
})