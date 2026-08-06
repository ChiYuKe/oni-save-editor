import { readFileSync } from 'node:fs'
import { ByteReader } from './binary'
import { parseTemplateDirectory } from './template'
import { unzlibSync } from 'fflate'

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
const stream = new ByteReader(unzlibSync(tail))

const worldTag = stream.readKleiString()
console.log('world tag:', worldTag, 'pos:', stream.position)
const worldType = stream.readKleiString()
console.log('world type:', worldType, 'pos:', stream.position)
// SaveFileRoot members: WidthInCells(int), HeightInCells(int), streamed(dict<string,byte[]>), clusterID(string), requiredMods(list), active_mods(list)
console.log('width:', stream.readI32(), 'height:', stream.readI32(), 'pos:', stream.position)
// streamed dict: byteLen, count
const dl = stream.readI32()
const dcount = stream.readI32()
console.log('streamed dict len/count:', dl, dcount)
for (let i = 0; i < dcount; i++) {
  // values first: byte[]
  const bl = stream.readI32()
  const bcount = stream.readI32()
  console.log('  streamed value', i, 'len/count:', bl, bcount)
  stream.skip(bcount)
}
for (let i = 0; i < dcount; i++) {
  const k = stream.readKleiString()
  console.log('  streamed key', i, '=', k)
}
console.log('clusterID:', stream.readKleiString())
// requiredMods: List<ModInfo> -> len, count
const rl = stream.readI32()
const rcount = stream.readI32()
console.log('requiredMods len/count:', rl, rcount)
// active_mods: List<Label>
const al = stream.readI32()
const acount = stream.readI32()
console.log('active_mods len/count:', al, acount)
console.log('pos after world:', stream.position)

// sim: int32 length + raw
const simLen = stream.readI32()
console.log('sim len:', simLen, 'pos:', stream.position)
stream.skip(simLen)
console.log('pos after sim:', stream.position)

// manager header: 8 bytes "KSAV" UTF16
const hdr = stream.readRaw(8)
console.log('manager header:', Array.from(hdr).map((x) => x.toString(16).padStart(2, '0')).join(' '), String.fromCharCode(hdr[0], hdr[2], hdr[4], hdr[6]))
const major = stream.readI32()
const minor = stream.readI32()
console.log('manager version:', major, minor, 'pos:', stream.position)
const nTags = stream.readI32()
console.log('tag count:', nTags, 'pos:', stream.position)
// read one tag group header without instances to verify alignment
const tagName = stream.readKleiString()
const tagCount = stream.readI32()
const tagBytes = stream.readI32()
console.log('first tag:', tagName, 'count:', tagCount, 'bytes:', tagBytes, 'pos:', stream.position)