import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'

const workspace = process.cwd()
const assetsRoot = process.env.ONI_EXPORTED_ASSETS
  ?? 'C:/Users/Administrator/Desktop/Project/NOIMods/ONI源码/ONIUnity项目/ONI_U59_744825/ExportedProject/Assets'
const hookupPath = path.join(assetsRoot, 'Resources', 'SubstanceHookup.asset')
const outputPath = path.join(workspace, 'src', 'lib', 'oniSubstances.generated.ts')
const elementsPath = path.join(assetsRoot, 'StreamingAssets', 'elements')
const renderAssetOutput = path.join(workspace, 'public', 'assets', 'render')

function parseVector(text, key, fallback) {
  const match = text.match(new RegExp(`${key}: \\{r: ([^,]+), g: ([^,]+), b: ([^,]+), a: ([^}]+)\\}`))
  return match ? match.slice(1, 5).map(Number) : fallback
}

function parseFloat(text, key, fallback) {
  const match = text.match(new RegExp(`${key}: ([^\\r\\n]+)`))
  return match ? Number(match[1].trim()) : fallback
}

function parsePackedColor(text, key, fallback) {
  const match = text.match(new RegExp(`${key}:\\s*\\n\\s*serializedVersion: 2\\s*\\n\\s*rgba: (\\d+)`))
  if (!match) return fallback
  const rgba = Number(match[1]) >>> 0
  return [rgba & 255, (rgba >>> 8) & 255, (rgba >>> 16) & 255, rgba >>> 24]
}

async function walk(directory, visit) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) await walk(fullPath, visit)
    else await visit(fullPath)
  }
}

const guidToAsset = new Map()
await walk(assetsRoot, async (filePath) => {
  if (!filePath.endsWith('.meta')) return
  const firstChunk = (await fs.readFile(filePath, 'utf8')).slice(0, 512)
  const guid = firstChunk.match(/^guid: ([0-9a-f]+)$/m)?.[1]
  if (guid) guidToAsset.set(guid, filePath.slice(0, -5))
})

// PropertyTextures.UpdateStateChange reads Element.lowTemp/highTemp at
// runtime. Keep those exact values beside the material data so the browser
// can build the same texture directly from a save's SIM grid.
function sdbmLower(value) {
  let hash = 0
  for (const character of value.toLowerCase()) hash = (character.charCodeAt(0) + Math.imul(hash, 65599)) | 0
  return hash
}

const elementConfigs = new Map()
for (const fileName of ['solid.yaml', 'liquid.yaml', 'gas.yaml', 'special.yaml']) {
  const document = parse(await fs.readFile(path.join(elementsPath, fileName), 'utf8'))
  for (const element of document?.elements ?? []) {
    if (typeof element?.elementId === 'string') elementConfigs.set(sdbmLower(element.elementId), element)
  }
}

const hookup = await fs.readFile(hookupPath, 'utf8')
const starts = [...hookup.matchAll(/^  - name: (.+)$/gm)]
const records = []
for (let index = 0; index < starts.length; index += 1) {
  const start = starts[index]
  const block = hookup.slice(start.index, starts[index + 1]?.index ?? hookup.length)
  const elementId = Number(block.match(/^    elementID: (-?\d+)$/m)?.[1])
  const materialGuid = block.match(/^    material: \{fileID: \d+, guid: ([0-9a-f]+), type: \d+\}$/m)?.[1]
  if (!Number.isFinite(elementId)) continue
  const materialPath = materialGuid ? guidToAsset.get(materialGuid) : undefined
  const material = materialPath ? await fs.readFile(materialPath, 'utf8') : ''
  const elementConfig = elementConfigs.get(elementId)
  const textureGuid = material.match(/_MainTex:\s*\n\s*m_Texture: \{fileID: \d+, guid: ([0-9a-f]+), type: \d+\}/)?.[1]
  const shineGuid = material.match(/_ShineMask:\s*\n\s*m_Texture: \{fileID: \d+, guid: ([0-9a-f]+), type: \d+\}/)?.[1]
  records.push({
    name: start[1].trim(),
    substanceIndex: index,
    elementId,
    hash: elementId & 0xffff,
    material: materialPath ? path.relative(assetsRoot, materialPath).replaceAll('\\', '/') : '',
    texture: textureGuid ? path.relative(assetsRoot, guidToAsset.get(textureGuid) ?? '').replaceAll('\\', '/') : '',
    textureUrl: textureGuid ? `/assets/elements/${path.basename(guidToAsset.get(textureGuid) ?? '')}` : '',
    shineMask: shineGuid ? path.relative(assetsRoot, guidToAsset.get(shineGuid) ?? '').replaceAll('\\', '/') : '',
    worldUvScale: parseFloat(material, '_WorldUVScale', 8),
    frequency: parseFloat(material, '_Frequency', 0),
    colourTint: parseVector(material, '_ColourTint', [1, 1, 1, 1]),
    shineColour: parseVector(material, '_ShineColour', [0, 0, 0, 0]),
    colour: parsePackedColor(block, 'colour', [255, 255, 255, 255]),
    usesCaustics: Boolean(Number(block.match(/^    usesCaustics: (\d+)$/m)?.[1] ?? 0)),
    glows: Boolean(Number(block.match(/^    glows: (\d+)$/m)?.[1] ?? 0)),
    isOpaqueLiquid: Boolean(Number(block.match(/^    isOpaqueLiquid: (\d+)$/m)?.[1] ?? 0)),
    state: elementConfig?.state ?? '',
    lowTemp: Number(elementConfig?.lowTemp ?? 0),
    highTemp: Number(elementConfig?.highTemp ?? 10000),
  })
}

const body = `// Generated from the game's Resources/SubstanceHookup.asset, Unity materials, and StreamingAssets/elements YAML.\n// Run: npm run generate:substances\n\nexport interface OniSubstanceMaterial {\n  name: string\n  substanceIndex: number\n  elementId: number\n  hash: number\n  material: string\n  texture: string\n  textureUrl: string\n  shineMask: string\n  worldUvScale: number\n  frequency: number\n  colourTint: readonly [number, number, number, number]\n  shineColour: readonly [number, number, number, number]\n  colour: readonly [number, number, number, number]\n  usesCaustics: boolean\n  glows: boolean\n  isOpaqueLiquid: boolean\n  state: string\n  lowTemp: number\n  highTemp: number\n}\n\nexport const ONI_SUBSTANCE_MATERIALS = ${JSON.stringify(records, null, 2)} as const satisfies readonly OniSubstanceMaterial[]\n\nexport const ONI_SUBSTANCE_BY_HASH = new Map<number, OniSubstanceMaterial>(\n  ONI_SUBSTANCE_MATERIALS.map((material) => [material.hash, material]),\n)\n`
await fs.writeFile(outputPath, body)
await fs.mkdir(renderAssetOutput, { recursive: true })
for (const fileName of ['crackAlpha.png', 'melt.png', 'mudmelt.png', 'normal_metal.png', 'gasSteam01.png', 'skullgas.png']) {
  await fs.copyFile(path.join(assetsRoot, 'Texture2D', fileName), path.join(renderAssetOutput, fileName))
}
console.log(`Generated ${records.length} ONI substance materials -> ${outputPath}`)
