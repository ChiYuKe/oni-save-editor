import { readFileSync } from 'node:fs'
import { unzlibSync } from 'fflate'
import { ByteReader } from './binary'
import { parseTemplateDirectory } from './template'
import { parseSave, buildSave } from './save'

const SAVE = process.argv[2]
const bytes = new Uint8Array(readFileSync(SAVE))

console.log('file size:', bytes.length)

// ---- parse round 1 ----
const s1 = parseSave(bytes)
console.log('templates:', s1.templates.size)
console.log('groups:', s1.manager!.groups.length)
console.log('gameData type:', s1.gameData!.typeName)
console.log(
  'makeBase volume...',
)

// verify world root fields parsed
for (const m of s1.saveFileRoot!.members) {
  if (typeof m.value !== 'object' || !('kind' in m.value)) continue
  const v = m.value as { kind: string }
  const brief =
    v.kind === 'object'
      ? `${(m.value as { members: unknown[] }).members.length} members`
      : v.kind === 'raw-pod'
        ? `raw-pod count=${(m.value as { count: number }).count}`
        : v.kind === 'dict'
          ? `dict keys=${(m.value as { keys: unknown[] }).keys.length}`
          : v.kind
  console.log(`  world.${m.name}: ${brief}`)
}

// ---- build round 1 -> 2 ----
const b1 = buildSave(s1)
const s2 = parseSave(b1)
const b2 = buildSave(s2)

// fixed point: building the re-parsed save must reproduce identical bytes
const same = Buffer.compare(Buffer.from(b1), Buffer.from(b2)) === 0
console.log('fixpoint (build(parse(build)) == build):', same)

// Strict equality of decompressed *bodies* with the original
function bodyBytes(buf: Uint8Array): Uint8Array {
  const r = new ByteReader(buf)
  r.readU32()
  const hdrSize = r.readI32()
  r.readU32()
  r.readI32()
  r.readBytes(hdrSize)
  parseTemplateDirectory(r) // advance past directory
  return unzlibSync(r.readBytes(r.remaining))
}

const origBody = bodyBytes(bytes)
// For the built save, the tail is compressed too (compression === 1)
const builtBody = bodyBytes(b1)
console.log('body lengths:', origBody.length, builtBody.length)
console.log('body identical:', Buffer.compare(Buffer.from(origBody), Buffer.from(builtBody)) === 0)

let di = 0
const dn = Math.min(origBody.length, builtBody.length)
while (di < dn && origBody[di] === builtBody[di]) di++
console.log('first body diff at:', di, 'of', dn)
if (di < dn) {
  const ctx = (b: Uint8Array, off: number, len: number) => Array.from(b.subarray(off, off + len)).map((x) => x.toString(16).padStart(2, '0')).join(' ')
  console.log('orig: ', ctx(origBody, di, 16))
  console.log('built:', ctx(builtBody, di, 16))
  console.log('orig text: ', JSON.stringify(new TextDecoder().decode(origBody.subarray(Math.max(0, di - 30), di + 30))))
  console.log('built text:', JSON.stringify(new TextDecoder().decode(builtBody.subarray(Math.max(0, di - 30), di + 30))))
}

// ---- quick stat of a duplicant group ----
const groups = s1.manager!.groups
const minion = groups.find((g) => g.tag === 'Minion')
if (minion) {
  console.log('Minion group count:', minion.instances.length)
  const comps = minion.instances[0].components
  console.log('first minion components:')
  for (const c of comps) {
    console.log('   ', c.typeName, c.value ? `(members=${c.value.members.length})` : '(raw)', c.details ? `details=${c.details.length}` : '')
  }
}