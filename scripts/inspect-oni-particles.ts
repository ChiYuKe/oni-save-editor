import { readFileSync } from 'node:fs'
import { parseSave } from '../src/lib/save'
import { oniSavedParticleCounts } from '../src/lib/oniParticles'

const paths = process.argv.slice(2)
if (paths.length === 0) {
  console.error('Usage: npx tsx scripts/inspect-oni-particles.ts <save.sav> [...]')
  process.exit(1)
}

for (const path of paths) {
  const counts = oniSavedParticleCounts(parseSave(readFileSync(path)))
  console.log(JSON.stringify({ path, ...counts, total: counts.fallingWater + counts.bubbles }))
}
