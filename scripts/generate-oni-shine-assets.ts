import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ONI_SUBSTANCE_MATERIALS } from '../src/lib/oniSubstances.generated'

const root = process.env.ONI_EXPORTED_ASSETS ?? 'E:/Unity/NOI1018/ExportedProject/Assets'
const output = path.resolve('public/assets/render/shine')
await fs.mkdir(output, { recursive: true })
const prepared = []
const normalGuids = new Set<string>()
for (const material of ONI_SUBSTANCE_MATERIALS) {
  if (!material.shineMask) continue
  const source = await fs.readFile(path.join(root, material.material), 'utf8')
  const block = source.match(/_NormalNoise:\s*\n\s*m_Texture: ([^\n]+)\n\s*m_Scale: \{x: ([^,]+), y: ([^}]+)\}\n\s*m_Offset: \{x: ([^,]+), y: ([^}]+)\}/)
  const guid = block?.[1].match(/guid: ([a-f0-9]+)/)?.[1]
  if (!guid || !block) throw new Error(`Missing normal-noise metadata: ${material.name}`)
  normalGuids.add(guid)
  prepared.push({ material, guid, normalST: block.slice(2,6).map(Number) })
}
const normals = new Map<string,string>()
for (const name of await fs.readdir(path.join(root, 'Texture2D'))) {
  if (!name.endsWith('.png.meta')) continue
  const meta = await fs.readFile(path.join(root, 'Texture2D', name), 'utf8')
  const guid = meta.match(/^guid: ([a-f0-9]+)/m)?.[1]
  if (guid && normalGuids.has(guid)) normals.set(guid, name.slice(0,-5))
}
const records = []
for (const { material, guid, normalST } of prepared) {
  const normal = normals.get(guid)
  if (!normal) throw new Error(`Missing normal texture ${guid}`)
  const mask = path.basename(material.shineMask)
  await fs.copyFile(path.join(root, material.shineMask), path.join(output, mask))
  if (normal !== 'normal_metal.png') await fs.copyFile(path.join(root, 'Texture2D', normal), path.join(output, normal))
  records.push([material.hash, { maskUrl: `/assets/render/shine/${mask}`, normalUrl: normal === 'normal_metal.png' ? '/assets/render/normal_metal.png' : `/assets/render/shine/${normal}`, normalST, frequency: material.frequency, colour: material.shineColour }])
}
const source = `// Generated from the Unity Substance materials by scripts/generate-oni-shine-assets.ts.\nexport interface OniShineMaterial {\n  maskUrl: string\n  normalUrl: string\n  normalST: readonly number[]\n  frequency: number\n  colour: readonly number[]\n}\nexport const ONI_SHINE_MATERIALS = new Map<number, OniShineMaterial>(${JSON.stringify(records,null,2)})\n`
await fs.writeFile('src/lib/oniShineMaterials.generated.ts',source)
console.log(`Exported native shine masks and normal-noise parameters for ${records.length} substances.`)
