import { parse as parseYaml } from 'yaml'
import { ELEMENTS, type ElementDefinition } from './elements'

export type TemplateCell = {
  element: string
  mass: number
  temperature: number
  x: number
  y: number
}

export type TemplateEntity = {
  id: string
  element: string
  x: number
  y: number
  type: string
}

export type YamlTemplate = {
  path: string
  name: string
  category: string
  width: number
  height: number
  minX: number
  minY: number
  cells: TemplateCell[]
  buildings: TemplateEntity[]
  pickupables: TemplateEntity[]
  elementalOres: TemplateEntity[]
  otherEntities: TemplateEntity[]
  solidCount: number
  fluidCount: number
  vacuumCount: number
  unknownCount: number
}

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {}
}

function numberValue(value: unknown, fallback = 0): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function normalizeElementName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

const ELEMENT_ALIASES: Record<string, string> = {
  oxyrock: 'oxylite',
  cuprite: 'copperore',
  slimemold: 'slime',
  katairite: 'abyssalite',
  dirtywater: 'pollutedwater',
  dirtyice: 'pollutedice',
  contaminatedoxygen: 'pollutedoxygen',
  carbon: 'refinedcarbon',
  hydrogen: 'hydrogengas',
  methane: 'naturalgas',
  toxicmud: 'pollutedmud',
}

const ELEMENT_BY_TEMPLATE_NAME = new Map<string, ElementDefinition>()
for (const element of ELEMENTS) {
  const englishName = element.name.split(' ').slice(1).join(' ') || element.name
  ELEMENT_BY_TEMPLATE_NAME.set(normalizeElementName(englishName), element)
  ELEMENT_BY_TEMPLATE_NAME.set(normalizeElementName(element.name), element)
}

export function templateElementForName(name: string): ElementDefinition | undefined {
  const normalized = normalizeElementName(name)
  return ELEMENT_BY_TEMPLATE_NAME.get(normalized) ?? ELEMENT_BY_TEMPLATE_NAME.get(ELEMENT_ALIASES[normalized] ?? '')
}

function templateNameHash(name: string): number {
  let hash = 2166136261
  for (const character of name) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return Math.abs(hash | 0)
}

export function templateVisualElementForName(name: string): ElementDefinition {
  const known = templateElementForName(name)
  if (known) return known
  const normalized = normalizeElementName(name)
  const isGas = /oxygen|hydrogen|methane|chlorine|carbondioxide|steam|poison|contaminated/.test(normalized)
  const isLiquid = !isGas && /liquid|molten|water|oil|petroleum|ethanol|naphtha|resin|viscogel|sucrose|soup|milk|sulfur|phosphorus|coolant|waste/.test(normalized)
  const state = isGas ? 'gas' : isLiquid ? 'liquid' : 'solid'
  const hash = templateNameHash(name)
  const color = isGas ? '#7bb6c8' : isLiquid ? '#4a9eaa' : `hsl(${hash % 360} 25% 48%)`
  return {
    hash,
    name,
    state,
    color,
    fluidMaterial: state === 'solid' ? undefined : {
      gradientTop: color,
      gradientBottom: color,
      usesCaustics: state === 'liquid',
      glows: false,
      opaque: false,
      flowSpeed: state === 'gas' ? .3 : .5,
    },
  }
}

function parseCell(value: unknown): TemplateCell {
  const item = record(value)
  return {
    element: stringValue(item.element, 'Vacuum'),
    mass: numberValue(item.mass),
    temperature: numberValue(item.temperature, 293.15),
    x: numberValue(item.location_x),
    y: numberValue(item.location_y),
  }
}

function parseEntity(value: unknown): TemplateEntity {
  const item = record(value)
  return {
    id: stringValue(item.id, 'Unknown'),
    element: stringValue(item.element),
    x: numberValue(item.location_x),
    y: numberValue(item.location_y),
    type: stringValue(item.type, 'Other'),
  }
}

function categoryForPath(path: string): string {
  const parts = path.split('/')
  return parts.length > 1 ? parts[0] : '根目录'
}

function basename(path: string): string {
  return path.split('/').pop()?.replace(/\.ya?ml$/i, '') ?? path
}

export function parseYamlTemplate(text: string, path: string): YamlTemplate {
  const document = record(parseYaml(text))
  const info = record(document.info)
  const size = record(info.size)
  const min = record(info.min)
  const cells = arrayValue(document.cells).map(parseCell)
  const width = Math.max(1, numberValue(size.X, Math.max(...cells.map((cell) => cell.x), 0) - numberValue(min.X) + 1))
  const height = Math.max(1, numberValue(size.Y, Math.max(...cells.map((cell) => cell.y), 0) - numberValue(min.Y) + 1))
  const minX = numberValue(min.X, Math.min(...cells.map((cell) => cell.x), 0))
  const minY = numberValue(min.Y, Math.min(...cells.map((cell) => cell.y), 0))
  let solidCount = 0
  let fluidCount = 0
  let vacuumCount = 0
  let unknownCount = 0
  for (const cell of cells) {
    const element = templateElementForName(cell.element)
    const visualElement = templateVisualElementForName(cell.element)
    if (!element) unknownCount += 1
    if (visualElement.state === 'solid') solidCount += 1
    else if (visualElement.state === 'gas' || visualElement.state === 'liquid') fluidCount += 1
    else if (visualElement.state === 'vacuum') vacuumCount += 1
  }
  return {
    path,
    name: stringValue(document.name, basename(path)),
    category: categoryForPath(path),
    width,
    height,
    minX,
    minY,
    cells,
    buildings: arrayValue(document.buildings).map(parseEntity),
    pickupables: arrayValue(document.pickupables).map(parseEntity),
    elementalOres: arrayValue(document.elementalOres).map(parseEntity),
    otherEntities: arrayValue(document.otherEntities).map(parseEntity),
    solidCount,
    fluidCount,
    vacuumCount,
    unknownCount,
  }
}
