import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const [sourceDirectory, outputFile] = process.argv.slice(2)
if (!sourceDirectory || !outputFile) {
  throw new Error('Usage: node scripts/extract-oni-building-defs.mjs <Assembly-CSharp directory> <output file>')
}

async function csFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return csFiles(path)
    return entry.isFile() && entry.name.endsWith('Config.cs') ? [path] : []
  }))
  return nested.flat()
}

function matchingIndex(text, start, open = '(', close = ')') {
  let depth = 0
  let quote = false
  for (let index = start; index < text.length; index++) {
    const char = text[index]
    if (char === '"' && text[index - 1] !== '\\') quote = !quote
    if (quote) continue
    if (char === open) depth++
    if (char === close && --depth === 0) return index
  }
  return -1
}

function topLevelArguments(text) {
  const argumentsList = []
  let start = 0
  let depth = 0
  let quote = false
  for (let index = 0; index <= text.length; index++) {
    const char = text[index]
    if (char === '"' && text[index - 1] !== '\\') quote = !quote
    if (!quote) {
      if (char === '(' || char === '[' || char === '{') depth++
      if (char === ')' || char === ']' || char === '}') depth--
    }
    if (index === text.length || (!quote && depth === 0 && char === ',')) {
      argumentsList.push(text.slice(start, index).trim())
      start = index + 1
    }
  }
  return argumentsList
}

function assignments(source) {
  const values = new Map()
  const expression = /(?:const\s+)?(?:string|int)\s+(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|-?\d+)\s*;/g
  for (const match of source.matchAll(expression)) {
    const [, name, rawValue] = match
    values.set(name, rawValue.startsWith('"') ? JSON.parse(rawValue) : Number(rawValue))
  }
  return values
}

function resolveValue(rawValue, values) {
  const value = rawValue.trim()
  if (value.startsWith('"')) return JSON.parse(value)
  if (/^-?\d+$/.test(value)) return Number(value)
  return values.get(value)
}

function parseConfig(path, source) {
  const method = source.indexOf('CreateBuildingDef()')
  if (method < 0) return undefined
  const bodyStart = source.indexOf('{', method)
  const bodyEnd = matchingIndex(source, bodyStart, '{', '}')
  if (bodyStart < 0 || bodyEnd < 0) return undefined
  const body = source.slice(bodyStart, bodyEnd + 1)
  const callStart = body.indexOf('BuildingTemplates.CreateBuildingDef(')
  if (callStart < 0) return undefined
  const argumentsStart = body.indexOf('(', callStart)
  const argumentsEnd = matchingIndex(body, argumentsStart)
  if (argumentsEnd < 0) return undefined
  const args = topLevelArguments(body.slice(argumentsStart + 1, argumentsEnd))
  if (args.length < 4) return undefined
  const values = assignments(`${source}\n${body}`)
  const id = resolveValue(args[0], values)
  const width = resolveValue(args[1], values)
  const height = resolveValue(args[2], values)
  const animation = resolveValue(args[3], values)
  if (typeof id !== 'string' || !Number.isInteger(width) || !Number.isInteger(height) || typeof animation !== 'string') return undefined
  const layer = (property) => body.match(new RegExp(`buildingDef\\.${property}\\s*=\\s*(?:Grid\\.)?SceneLayer\\.(\\w+)`))?.[1]
  return {
    id,
    width,
    height,
    animation,
    sceneLayer: layer('SceneLayer') ?? 'Building',
    foregroundLayer: layer('ForegroundLayer') ?? 'BuildingFront',
    objectLayer: body.match(/buildingDef\.ObjectLayer\s*=\s*ObjectLayer\.(\w+)/)?.[1] ?? 'Building',
    source: path.split(/[\\/]/).at(-1),
  }
}

const definitions = new Map()
for (const path of await csFiles(resolve(sourceDirectory))) {
  const definition = parseConfig(path, await readFile(path, 'utf8'))
  if (!definition || definitions.has(definition.id.toLowerCase())) continue
  definitions.set(definition.id.toLowerCase(), definition)
}

const rows = [...definitions.values()].sort((left, right) => left.id.localeCompare(right.id))
const output = `// Generated from Oxygen Not Included's IBuildingConfig/CreateBuildingDef source.\n// Do not hand-edit; run scripts/extract-oni-building-defs.mjs against Assembly-CSharp.\n\nexport type OniBuildingDefinition = {\n  id: string\n  width: number\n  height: number\n  animation: string\n  sceneLayer: string\n  foregroundLayer: string\n  objectLayer: string\n  source: string\n}\n\nexport const ONI_BUILDING_DEFINITIONS: Record<string, OniBuildingDefinition> = ${JSON.stringify(Object.fromEntries(rows.map((definition) => [definition.id.toLowerCase(), definition])), null, 2)}\n\nconst ONI_BUILDINGS_BY_ANIMATION: Record<string, OniBuildingDefinition> = Object.fromEntries(\n  Object.values(ONI_BUILDING_DEFINITIONS).map((definition) => [definition.animation.replace(/_kanim$/i, '').toLowerCase(), definition]),\n)\n\nexport function oniBuildingDefinitionForTag(tag: string): OniBuildingDefinition | undefined {\n  return ONI_BUILDING_DEFINITIONS[tag.trim().toLowerCase()]\n}\n\nexport function oniBuildingDefinitionForAnimation(animation: string): OniBuildingDefinition | undefined {\n  return ONI_BUILDINGS_BY_ANIMATION[animation.trim().replace(/_kanim$/i, '').toLowerCase()]\n}\n`
await writeFile(resolve(outputFile), output)
console.log(`Extracted ${rows.length} building definitions to ${outputFile}`)
