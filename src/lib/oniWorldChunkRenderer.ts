import { shineCameraKey } from './oniShineCamera'
import type { OniTerrainRenderInput } from './oniRenderer'
import { OniDetailQueue } from './oniDetailQueue'
import { mapLoadOrigin } from './oniMapFocus'
import { ONI_BUILDING_SPRITES } from './oniBuildingSprites.generated'
import { ONI_ZONE_TEXTURE_ARRAY_INDICES } from './oniShaders'
import { loadOniPreviewImages } from './oniPreviewAssets'
import { ONI_WEB_ASSETS } from './oniWebAssets.generated'
import { loadRenderImage } from './oniRenderAssets'
import { seaTreeVisuals } from './oniSeaTree'
import { forestTreeVisuals } from './oniForestTree'
import { drawOniLightBuffer, type OniLightInstance } from './oniLighting'
import { savedOniLights } from './oniSavedLighting'
import { ONI_SHINE_MATERIALS } from './oniShineMaterials.generated'
import { spaceTreeVisuals } from './oniSpaceTree'
import { component, member, worldGrid, worldSize } from './editor'
import { ELEMENTS, elementForHash, type FluidMaterialStyle } from './elements'
import type { ParsedSave } from './save'
import { SIM_DISEASE_SIZE, readSimBackwall, readSimCell, type SimCell } from './sim'
import { TERRAIN_MASK_ATLAS_URL, createTerrainMaskSets, type TerrainMaskSets } from './terrainMasks'
import { ONI_SCENE_LAYER_ORDER, ONI_WORLD_ZONE_COLORS, oniWorldRenderer } from './oniRenderer'
import { ONI_SUBSTANCE_BY_HASH } from './oniSubstances.generated'
import type { SavedObjectGroup, SavedObjectInstance, Value } from './model'
import { blockTileCellKey, blockTileConnectionBits, blockTileTextureForTag, drawBlockTile } from './blockTiles'
import {
  drawUtilityTile,
  utilityConnectionBits,
  utilityFamilyForTag,
  utilityNeighbourConnections,
  utilityTextureForTag,
  type UtilityCellMap,
  type UtilityCellRecord,
  type UtilityFamily,
} from './utilityTiles'
import { BUILDING_TAG_ALIASES, oniBuildingDefinitionForSaveTag, instanceOrientation, mapObjectSceneLayer, buildingPlacementCells } from './oniObjectPlacement'
import { drawMinionKanim, loadMinionKanimAssets, type MinionKanimAssets } from './oniMinionKanim'

export type OniChunkLayer = 'background' | 'entitiesBack' | 'gas' | 'liquid' | 'terrain' | 'entitiesFront' | 'particles' | 'light'

export type OniChunkLayerVisibility = {
  biome: boolean
  backwall: boolean
  lighting?: boolean
  gas: boolean
  liquid: boolean
  ground: boolean
  minions?: boolean
  entities?: boolean
  buildings?: boolean
  geysers?: boolean
  power?: boolean
  plumbing?: boolean
  ventilation?: boolean
  automation?: boolean
  shipment?: boolean
}

export type OniChunkOverlay = 'none' | 'temperature' | 'mass' | 'disease' | 'visibility' | 'spawnable' | 'damage'

export type OniRenderedChunk = {
  x: number
  y: number
  width: number
  height: number
  layers: Partial<Record<OniChunkLayer, HTMLCanvasElement>>
}

export interface OniChunkRenderOptions {
  shineCamera?: OniTerrainRenderInput['shineCamera']
  /** Repaint only camera-dependent terrain/background; preserve object and light textures. */
  surfacesOnly?: boolean
  skipSurfaces?: boolean
  timeSeconds?: number
  /** Repaint fluids only, retaining one viewport's scenery and canvas surfaces. */
  fluidsOnly?: boolean
  skipFluids?: boolean
  cellSize?: number
}

type FluidViewportCache = {
  key: string
  cameraKey?: string
  backgroundRevision?: number
  shinyBackwall?: boolean
  terrain?: HTMLCanvasElement
  background?: HTMLCanvasElement
  backwall?: HTMLCanvasElement
  sceneMask?: HTMLCanvasElement
  objects?: HTMLCanvasElement
  gas?: HTMLCanvasElement
  liquid?: HTMLCanvasElement
  scene?: HTMLCanvasElement
  hasGas?: boolean
  hasLiquid?: boolean
  layers: Partial<Record<OniChunkLayer, HTMLCanvasElement>>
}

export interface OniWorldChunkRenderer {
  readonly width: number
  readonly height: number
  readonly cellSize: number
  readonly revision: number
  readonly pendingDetails: number
  readonly ready: Promise<void>
  prepareViewport(x: number, row: number, widthCells: number, heightCells: number, detail: boolean): Promise<void>
  renderChunk(x: number, row: number, widthCells: number, heightCells: number, options?: OniChunkRenderOptions): OniRenderedChunk
  destroy(): void
}

type ZoneColor = { r: number; g: number; b: number }
type SpriteDefinition = {
  path: string
  widthCells: number
  heightCells?: number
  anchorOffsetXCells?: number
  anchorOffsetYCells?: number
  verticalOffsetCells?: number
}
type RotatableVisualizer = {
  pivotXCells: number
  pivotYCells: number
  offsetXCells: number
  offsetYCells: number
}
type MapObjectRenderEntry = {
  group: SavedObjectGroup
  instance: SavedObjectInstance
  order: number
}
type PreparedObject = MapObjectRenderEntry & {
  sceneLayer: number
  spriteMargin: number
  blockTile?: ReturnType<typeof blockTileTextureForTag>
  utility?: ReturnType<typeof utilityTextureForTag>
  utilityFamily?: UtilityFamily
  geyser?: SpriteDefinition
  building?: SpriteDefinition
  isGeyser: boolean
  isCreature: boolean
}

const DEFAULT_ELEMENT_WORLD_UV_SCALE = 8
const CHUNK_GUTTER_CELLS = 1
const TERRAIN_SCENE_LAYER = ONI_SCENE_LAYER_ORDER.Ground

function assetPath(path: string): string {
  if (!path.startsWith('/')) return path
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`
}

function biomeBackgroundAsset(textureIndex: number): string {
  return `/assets/background/biomes/slice-${textureIndex.toString().padStart(2, '0')}.png`
}

function geyserAsset(fileName: string, widthCells: number): SpriteDefinition {
  const isGasGeyser = fileName.startsWith('geyser_gas_') || /^geyser_side_(chlorine|methane|steam)_/.test(fileName)
  return { path: `/assets/geysers/${fileName}`, widthCells, verticalOffsetCells: isGasGeyser ? 1 : undefined }
}

const GEYSER_TEXTURES: Record<string, SpriteDefinition> = {
  gas_chlorine: geyserAsset('geyser_gas_chlorine_0_ui_False.png', 3.2),
  gas_co2_hot: geyserAsset('geyser_gas_co2_hot_0_ui_False.png', 3.2),
  gas_hydrogen_hot: geyserAsset('geyser_gas_hydrogen_hot_0_ui_False.png', 3.2),
  gas_methane: geyserAsset('geyser_gas_methane_0_ui_False.png', 3.2),
  gas_po2_hot: geyserAsset('geyser_gas_po2_hot_0_ui_False.png', 3.2),
  gas_po2_slimy: geyserAsset('geyser_gas_po2_slimy_0_ui_False.png', 3.2),
  gas_steam: geyserAsset('geyser_gas_steam_0_ui_False.png', 3.2),
  gas_steam_hot: geyserAsset('geyser_gas_steam_hot_0_ui_False.png', 3.2),
  liquid_co2: geyserAsset('geyser_liquid_co2_0_ui_False.png', 4),
  liquid_murky_brine: geyserAsset('geyser_liquid_murkybrine_0_ui_False.png', 4),
  liquid_oil: geyserAsset('geyser_liquid_oil_0_ui_False.png', 4),
  liquid_salt_water: geyserAsset('geyser_liquid_salt_water_0_ui_False.png', 4),
  liquid_salt_water_cool_slush: geyserAsset('geyser_liquid_salt_water_cool_slush_0_ui_False.png', 4),
  liquid_sulfur: geyserAsset('geyser_liquid_sulfur_0_ui_False.png', 4),
  liquid_water_filthy: geyserAsset('geyser_liquid_water_filthy_0_ui_False.png', 4),
  liquid_water_hot: geyserAsset('geyser_liquid_water_hot_0_ui_False.png', 4),
  liquid_water_slush: geyserAsset('geyser_liquid_water_slush_0_ui_False.png', 4),
  molten_aluminum: geyserAsset('geyser_molten_aluminum_0_ui_False.png', 4),
  molten_cobalt: geyserAsset('geyser_molten_cobalt_0_ui_False.png', 4),
  molten_copper: geyserAsset('geyser_molten_copper_0_ui_False.png', 4),
  molten_gold: geyserAsset('geyser_molten_gold_0_ui_False.png', 4),
  molten_iron: geyserAsset('geyser_molten_iron_0_ui_False.png', 4),
  molten_niobium: geyserAsset('geyser_molten_niobium_0_ui_False.png', 4),
  molten_tungsten: geyserAsset('geyser_molten_tungsten_0_ui_False.png', 4),
  molten_volcano_big: geyserAsset('geyser_molten_volcano_big_0_ui_False.png', 4),
  molten_volcano_small: geyserAsset('geyser_molten_volcano_small_0_ui_False.png', 4),
  oil_cap: geyserAsset('geyser_oil_cap_0_ui_False.png', 3.8),
  reef: geyserAsset('geyser_reef_0_ui_False.png', 4.2),
  side_chlorine: geyserAsset('geyser_side_chlorine_0_ui_False.png', 4.4),
  side_methane: geyserAsset('geyser_side_methane_0_ui_False.png', 4.4),
  side_oil: geyserAsset('geyser_side_oil_0_ui_False.png', 4.4),
  side_steam: geyserAsset('geyser_side_steam_0_ui_False.png', 4.4),
  aquatic_brackene_fountain: geyserAsset('aquatic_brackene_fountain_0_ui_False.png', 2.8),
}

const GEYSER_TAG_ALIASES: Record<string, string> = {
  big_volcano: 'molten_volcano_big', chlorine_gas_cool: 'gas_chlorine', chlorine_gas: 'gas_chlorine',
  filthy_water: 'liquid_water_filthy', hot_co2: 'gas_co2_hot', hot_hydrogen: 'gas_hydrogen_hot',
  hot_steam: 'gas_steam_hot', hot_water: 'liquid_water_hot', murky_brine: 'liquid_murky_brine',
  methane: 'gas_methane', oil_drip: 'oil_cap', salt_water_cool_slush: 'liquid_salt_water_cool_slush',
  slush_salt_water: 'liquid_salt_water_cool_slush', slush_water: 'liquid_water_slush', slimy_po2: 'gas_po2_slimy',
  small_volcano: 'molten_volcano_small', steam: 'gas_steam', salt_water: 'liquid_salt_water',
}

function geyserTextureForTag(tag: string): SpriteDefinition | undefined {
  const normalized = tag.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
  if (normalized === 'smallreefgeyser') return GEYSER_TEXTURES.reef
  if (normalized === 'geyser') return GEYSER_TEXTURES.side_steam
  if (normalized === 'chlorinegeyser') return GEYSER_TEXTURES.side_chlorine
  if (normalized === 'methanegeyser') return GEYSER_TEXTURES.side_methane
  if (normalized === 'oilwell') return GEYSER_TEXTURES.side_oil
  if (normalized === 'niobiumgeyser') return GEYSER_TEXTURES.molten_niobium
  if (normalized.includes('aquatic') || normalized.includes('brackene')) return GEYSER_TEXTURES.aquatic_brackene_fountain
  const key = normalized.replace(/^geysergeneric_/, '')
  return GEYSER_TEXTURES[GEYSER_TAG_ALIASES[key] ?? key]
}

function buildingTextureLookupKeys(tag: string): string[] {
  const key = tag.trim().toLowerCase()
  const alias = BUILDING_TAG_ALIASES[key]
  const definition = oniBuildingDefinitionForSaveTag(tag)
  const animation = definition?.animation.replace(/_kanim$/i, '').toLowerCase()
  return [...new Set([`${key}__prefab`, definition ? `${definition.id.toLowerCase()}__prefab` : undefined, key, alias, definition?.id.toLowerCase(), animation].filter((item): item is string => Boolean(item)))]
}

function buildingTextureForInstance(tag: string, instance: SavedObjectInstance, manifest: Record<string, SpriteDefinition>): SpriteDefinition | undefined {
  const definition = oniBuildingDefinitionForSaveTag(tag)
  const animation = definition?.animation.replace(/_kanim$/i, '').toLowerCase()
  const door = instance.components.find((item) => item.typeName.split(/[.+]/).pop()?.toLowerCase() === 'door')
  if (animation && door) {
    const controlState = door.value?.members.find((item) => item.name === 'controlState')?.value
    const state = controlState?.kind === 'enum' || controlState?.kind === 'int32' || controlState?.kind === 'uint32'
      ? controlState.v === 1 ? 'open' : controlState.v === 2 ? 'locked' : 'closed'
      : 'closed'
    const stateTexture = manifest[`${animation}__${state}`] ?? (state === 'locked' ? manifest[`${animation}__closed`] : undefined)
    if (stateTexture) return stateTexture
  }
  return buildingTextureLookupKeys(tag).map((key) => manifest[key]).find((item): item is SpriteDefinition => Boolean(item))
}

function hasSimpleComponent(instance: SavedObjectInstance, typeName: string): boolean {
  const expected = typeName.toLowerCase()
  return instance.components.some((item) => item.typeName.split(/[.+]/).pop()?.toLowerCase() === expected)
}

function isGeyserInstance(groupTag: string, instance: SavedObjectInstance, texture: SpriteDefinition | undefined): boolean {
  return Boolean(texture) || /geyser|fountain/i.test(groupTag) || instance.components.some((item) => /(?:^|[.+])geyser(?:$|[.+])/i.test(item.typeName))
}

function numericValue(value: Value | undefined): number | undefined {
  return value?.kind === 'sbyte' || value?.kind === 'byte' || value?.kind === 'int16' || value?.kind === 'uint16'
    || value?.kind === 'int32' || value?.kind === 'uint32' || value?.kind === 'enum' ? value.v : undefined
}

function minionAccessoryGuids(instance: SavedObjectInstance): string[] {
  const accessories = member(component(instance, 'Accessorizer')?.value, 'accessories')?.value
  if (accessories?.kind !== 'list') return []
  return accessories.items.flatMap((item) => {
    if (item.kind !== 'object') return []
    const guidReference = member(item, 'guid')?.value
    const guid = guidReference?.kind === 'object' ? member(guidReference, 'Guid')?.value : undefined
    return guid?.kind === 'string' && guid.v ? [guid.v] : []
  })
}

function minionWearableAnimNames(instance: SavedObjectInstance): string[] {
  const wearables = member(component(instance, 'WearableAccessorizer')?.value, 'wearables')?.value
  if (wearables?.kind !== 'dict') return []
  let highestType = -1
  let selected: Value | undefined
  wearables.keys.forEach((key, index) => {
    const type = numericValue(key)
    if (type !== undefined && type > highestType) { highestType = type; selected = wearables.values[index] }
  })
  if (selected?.kind !== 'object') return []
  const animNames = member(selected, 'animNames')?.value
  return animNames?.kind === 'list' ? animNames.items.flatMap((item) => item.kind === 'string' && item.v ? [item.v] : []) : []
}

function minionFacesLeft(instance: SavedObjectInstance): boolean {
  const value = member(component(instance, 'Facing')?.value, 'facingLeft')?.value
  return value?.kind === 'boolean' ? value.v : false
}

function rotatableVisualizerForTag(tag: string): RotatableVisualizer | undefined {
  const definition = oniBuildingDefinitionForSaveTag(tag)
  if (!definition) return undefined
  const evenWidth = definition.width % 2 === 0
  return { pivotXCells: evenWidth ? -.5 : 0, pivotYCells: .5, offsetXCells: evenWidth ? .5 : 0, offsetYCells: 0 }
}

function mapObjectsInRenderOrder(save: ParsedSave): MapObjectRenderEntry[] {
  const entries: MapObjectRenderEntry[] = []
  let order = 0
  for (const group of save.manager?.groups ?? []) for (const instance of group.instances) entries.push({ group, instance, order: order++ })
  return entries.sort((left, right) => {
    const layerDelta = mapObjectSceneLayer(left.group) - mapObjectSceneLayer(right.group)
    const leftZ = Number.isFinite(left.instance.position.z) ? left.instance.position.z : 0
    const rightZ = Number.isFinite(right.instance.position.z) ? right.instance.position.z : 0
    return layerDelta || rightZ - leftZ || left.order - right.order
  })
}

function blockTileCellsByGroup(save: ParsedSave): Map<SavedObjectGroup, Set<string>> {
  const result = new Map<SavedObjectGroup, Set<string>>()
  for (const group of save.manager?.groups ?? []) if (blockTileTextureForTag(group.tag)) {
    result.set(group, new Set(group.instances.map((item) => blockTileCellKey(Math.floor(item.position.x), Math.floor(item.position.y)))))
  }
  return result
}

function overlaysNaturalTerrain(group: SavedObjectGroup, instance: SavedObjectInstance): boolean {
  const tag = group.tag.trim().toLowerCase()
  return hasSimpleComponent(instance, 'Ladder') || tag === 'ladder' || tag === 'ladderfast' || tag === 'firepole' || tag === 'ladderbed'
}

function terrainMaskedCellsByBuilding(save: ParsedSave): Set<string> {
  const cells = new Set<string>()
  for (const group of save.manager?.groups ?? []) {
    const footprint = oniBuildingDefinitionForSaveTag(group.tag)
    if (!footprint) continue
    for (const instance of group.instances) {
      if (!hasSimpleComponent(instance, 'BuildingComplete') || overlaysNaturalTerrain(group, instance)) continue
      for (const cell of buildingPlacementCells(instance, footprint)) cells.add(blockTileCellKey(cell.x, cell.y))
    }
  }
  return cells
}

function buildUtilityCellMap(save: ParsedSave): UtilityCellMap {
  const cells: UtilityCellMap = new Map()
  for (const group of save.manager?.groups ?? []) {
    const family = utilityFamilyForTag(group.tag)
    if (!family) continue
    const familyCells = cells.get(family) ?? new Map<string, UtilityCellRecord>()
    for (const instance of group.instances) {
      const key = blockTileCellKey(Math.floor(instance.position.x), Math.floor(instance.position.y))
      const next: UtilityCellRecord = { tag: group.tag, bits: utilityConnectionBits(instance), isPhysical: hasSimpleComponent(instance, 'BuildingComplete') }
      const previous = familyCells.get(key)
      const physicalBits = next.isPhysical && next.bits !== undefined ? ((previous?.physicalBits ?? 0) | next.bits) : previous?.physicalBits
      const candidate = physicalBits === undefined ? next : { ...next, physicalBits }
      if (!previous || (next.isPhysical && !previous.isPhysical) || (next.bits !== undefined && previous.bits === undefined)) familyCells.set(key, candidate)
      else if (physicalBits !== previous.physicalBits) familyCells.set(key, { ...previous, physicalBits })
    }
    cells.set(family, familyCells)
  }
  return cells
}

function utilityDisplayConnections(cells: UtilityCellMap, family: UtilityFamily, instance: SavedObjectInstance, x: number, y: number): number {
  const ownBits = utilityConnectionBits(instance)
  const physicalBits = cells.get(family)?.get(blockTileCellKey(x, y))?.physicalBits ?? 0
  return ((ownBits === undefined ? utilityNeighbourConnections(cells, family, x, y) : ownBits) | physicalBits) & 0xf
}

function objectLayerVisible(visible: OniChunkLayerVisibility, object: PreparedObject): boolean {
  if (object.group.tag === 'Minion') return visible.minions ?? true
  if (object.isGeyser) return visible.geysers ?? true
  if (object.isCreature) return visible.entities ?? true
  switch (object.utilityFamily) {
    case 'electrical': return visible.power ?? true
    case 'liquid': return visible.plumbing ?? true
    case 'gas': return visible.ventilation ?? true
    case 'logic': return visible.automation ?? true
    case 'solid': return visible.shipment ?? true
    default: return visible.buildings ?? true
  }
}

function mapObjectAnchor(x: number, y: number, height: number, cellSize: number, originX: number, originY: number): { x: number; y: number } {
  return { x: originX + x * cellSize, y: originY + (height - y) * cellSize }
}

function drawSprite(context: CanvasRenderingContext2D, image: HTMLImageElement, definition: SpriteDefinition, cellSize: number, centerX: number, centerY: number, orientation = 0, rotatable?: RotatableVisualizer): void {
  if (!image.naturalWidth || !image.naturalHeight) return
  const width = cellSize * definition.widthCells
  const height = cellSize * (definition.heightCells ?? definition.widthCells * image.naturalHeight / image.naturalWidth)
  context.save()
  context.globalAlpha = .98
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  const visualizerOffsetX = orientation === 5 ? -(rotatable?.offsetXCells ?? 0) : rotatable?.offsetXCells ?? 0
  const visualizerOffsetY = orientation === 6 ? -1 : -(rotatable?.offsetYCells ?? 0)
  const pivotX = orientation === 5 ? -(rotatable?.pivotXCells ?? 0) : rotatable?.pivotXCells ?? 0
  const pivotY = -(rotatable?.pivotYCells ?? 0)
  context.translate(centerX + visualizerOffsetX * cellSize, centerY + visualizerOffsetY * cellSize - (definition.verticalOffsetCells ?? 0) * cellSize)
  if (orientation >= 1 && orientation <= 3) { context.translate(pivotX * cellSize, pivotY * cellSize); context.rotate(orientation * Math.PI / 2); context.translate(-pivotX * cellSize, -pivotY * cellSize) }
  if (orientation === 5) { context.translate(pivotX * cellSize, pivotY * cellSize); context.scale(-1, 1); context.translate(-pivotX * cellSize, -pivotY * cellSize) }
  if (orientation === 6) { context.translate(pivotX * cellSize, pivotY * cellSize); context.scale(1, -1); context.translate(-pivotX * cellSize, -pivotY * cellSize) }
  context.drawImage(image, (definition.anchorOffsetXCells ?? 0) * cellSize - width / 2, (definition.anchorOffsetYCells ?? 0) * cellSize - height / 2, width, height)
  context.restore()
}

function pointInPolygon(x: number, y: number, vertices: Array<{ x: number; y: number }>): boolean {
  let inside = false
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index++) {
    const current = vertices[index]
    const prior = vertices[previous]
    if (current.y > y !== prior.y > y && x < (prior.x - current.x) * (y - current.y) / (prior.y - current.y) + current.x) inside = !inside
  }
  return inside
}

function buildWorldZoneMap(save: ParsedSave, width: number, height: number): Uint8Array {
  const zones = new Uint8Array(width * height)
  zones.fill(7)
  const worldDetail = save.gameData?.members.find((item) => item.name === 'worldDetail')?.value
  if (worldDetail?.kind !== 'object') return zones
  const cells = worldDetail.members.find((item) => item.name === 'overworldCells')?.value
  if (cells?.kind !== 'list') return zones
  for (const item of cells.items) {
    if (item.kind !== 'object') continue
    const zone = item.members.find((member) => member.name === 'zoneType')?.value
    const zoneType = zone?.kind === 'enum' || zone?.kind === 'byte' || zone?.kind === 'int32' ? zone.v : undefined
    const polygon = item.members.find((member) => member.name === 'poly')?.value
    const verticesValue = polygon?.kind === 'object' ? polygon.members.find((member) => member.name === 'vertices')?.value : undefined
    if (zoneType === undefined || verticesValue?.kind !== 'list') continue
    const vertices = verticesValue.items.flatMap((vertex) => vertex.kind === 'vector2' ? [{ x: vertex.x, y: vertex.y }] : [])
    if (vertices.length < 3) continue
    const minX = Math.max(0, Math.floor(Math.min(...vertices.map((vertex) => vertex.x))))
    const maxX = Math.min(width - 1, Math.ceil(Math.max(...vertices.map((vertex) => vertex.x))))
    const minY = Math.max(0, Math.floor(Math.min(...vertices.map((vertex) => vertex.y))))
    const maxY = Math.min(height - 1, Math.ceil(Math.max(...vertices.map((vertex) => vertex.y))))
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      if (pointInPolygon(x, y, vertices)) zones[y * width + x] = zoneType
    }
  }
  return zones
}

function loadImage(path: string, timeoutMs = 90000): Promise<HTMLImageElement | null> {
  const compact = ONI_WEB_ASSETS[path]
  return compact ? loadRenderImage(assetPath(compact), timeoutMs).then(image => image ?? loadRenderImage(assetPath(path), timeoutMs)) : loadRenderImage(assetPath(path), timeoutMs)
}

function loadBuildingManifest(): Promise<Record<string, SpriteDefinition>> {
  return Promise.resolve(ONI_BUILDING_SPRITES)
}
let biomeCache: Promise<Record<number, HTMLImageElement>> | undefined
function loadBiomeImages(): Promise<Record<number, HTMLImageElement>> {
  return biomeCache ??= loadOniPreviewImages(Array.from({ length: 19 }, (_, index) => biomeBackgroundAsset(index))).then(images => Object.fromEntries(Array.from({ length: 19 }, (_, index) => [index, images[biomeBackgroundAsset(index)]]).filter(([, image]) => image)))
}
let terrainMaskCache: Promise<HTMLImageElement | null> | undefined
function loadTerrainMask(): Promise<HTMLImageElement | null> {
  return terrainMaskCache ??= loadImage(TERRAIN_MASK_ATLAS_URL, 120000).then(image => {
    if (!image) terrainMaskCache = undefined
    return image
  })
}
const elementHashesCache = new WeakMap<Uint8Array, Set<number>>()
const worldZonesCache = new WeakMap<ParsedSave, Uint8Array>()

function temperatureColor(kelvin: number): string {
  const celsius = kelvin - 273.15
  const hue = Math.max(0, Math.min(220, 220 - (celsius + 40) * .75))
  const lightness = Math.max(30, Math.min(70, 46 + Math.abs(celsius - 20) * .04))
  return `hsl(${hue} 58% ${lightness}%)`
}

function rgb(color: string): ZoneColor {
  const packed = Number.parseInt(color.replace('#', ''), 16)
  return Number.isFinite(packed) ? { r: packed >> 16 & 255, g: packed >> 8 & 255, b: packed & 255 } : { r: 255, g: 255, b: 255 }
}

function rgba(color: string, alpha: number): string {
  const value = rgb(color)
  return `rgba(${value.r}, ${value.g}, ${value.b}, ${Math.max(0, Math.min(1, alpha))})`
}

function drawGasFallback(context: CanvasRenderingContext2D, style: FluidMaterialStyle, cell: SimCell, px: number, py: number, cellSize: number): void {
  const pressure = cell.mass > 0 ? Math.max(Math.min(cell.mass / 200, 1), .15) : 0
  if (pressure <= 0) return
  context.fillStyle = rgba(style.gradientBottom, Math.min(1, pressure * 2) * .5)
  context.fillRect(px, py, cellSize, cellSize)
}

function drawLiquidFallback(context: CanvasRenderingContext2D, style: FluidMaterialStyle, cell: SimCell, px: number, py: number, cellSize: number, fullHeight: boolean): void {
  const massRatio = Math.min(Math.max(cell.mass, 0) / 2000, 1)
  const amount = fullHeight ? 1 : Math.pow(massRatio, .45)
  context.fillStyle = rgba(style.gradientBottom, style.opaque ? .48 + amount * .24 : .28 + amount * .28)
  context.fillRect(px, py, cellSize, cellSize)
  if (fullHeight) {
    context.fillStyle = rgba(style.gradientTop, .22)
    context.fillRect(px, py, cellSize, Math.max(1, cellSize * .07))
  }
}

function crop(source: HTMLCanvasElement, gutterPixels: number, width: number, height: number): HTMLCanvasElement {
  const result = document.createElement('canvas')
  result.width = width
  result.height = height
  const context = result.getContext('2d')
  if (context) context.drawImage(source, gutterPixels, gutterPixels, width, height, 0, 0, width, height)
  return result
}

function hasVisiblePixels(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return false
  const alpha = context.getImageData(0, 0, canvas.width, canvas.height).data
  for (let index = 3; index < alpha.length; index += 4) if (alpha[index] !== 0) return true
  return false
}

function cropVisible(source: HTMLCanvasElement, gutterPixels: number, width: number, height: number): HTMLCanvasElement | undefined {
  const result = crop(source, gutterPixels, width, height)
  return hasVisiblePixels(result) ? result : undefined
}

function trimFluidNoise(canvas: HTMLCanvasElement | undefined): HTMLCanvasElement | undefined {
  if (!canvas) return undefined
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return canvas
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  let visible = false
  for (let index = 3; index < image.data.length; index += 4) {
    // Bilinear property-texture sampling creates sub-byte alpha immediately
    // outside a fluid cell. At chunk borders those values become long hairline
    // seams after zooming, even though the game treats them as empty.
    if (image.data[index] < 5) image.data[index] = 0
    else visible = true
  }
  if (!visible) return undefined
  context.putImageData(image, 0, 0)
  return canvas
}

function hasCellsInRange(
  range: { minX: number; maxX: number; minRow: number; maxRow: number },
  worldHeight: number,
  cellAt: (x: number, y: number) => SimCell | undefined,
  state: 'gas' | 'liquid',
): boolean {
  for (let canvasY = range.minRow; canvasY <= range.maxRow; canvasY++) {
    const y = worldHeight - 1 - canvasY
    for (let x = range.minX; x <= range.maxX; x++) {
      const cell = cellAt(x, y)
      if (cell && elementForHash(cell.elementHash).state === state && cell.mass > 0) return true
    }
  }
  return false
}

export async function createOniChunkRenderer(
  save: ParsedSave,
  visibleLayers: OniChunkLayerVisibility,
  overlay: OniChunkOverlay,
  baseCellSize: number,
  isCancelled: () => boolean = () => false,
): Promise<OniWorldChunkRenderer> {
  const size = worldSize(save)
  const sim = save.simData
  if (!sim || !size.width || !size.height) throw new Error('存档没有可渲染的 SIM 世界。')
  const view = new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength)
  const propertyCacheKey = sim.bytes
  const managerGroups = save.manager?.groups ?? []
  let usedElementHashes = elementHashesCache.get(sim.bytes)
  const cellCache = new Map<number, SimCell | undefined>()
  let destroyed = false
  let assetRevision = 0
  const cellAt = (x: number, y: number) => {
    if (x < -1 || y < -1 || x > size.width || y > size.height) return undefined
    const key = (y + 1) * sim.width + x + 1
    if (!cellCache.has(key)) cellCache.set(key, readSimCell(sim, view, x + 1, y + 1))
    return cellCache.get(key)
  }
  // Load only the element art that this save can actually show. Start these
  // requests before preparing objects so image decoding overlaps the CPU work.
  if (!usedElementHashes) {
    usedElementHashes = new Set<number>()
    // Scan just the two hash fields, avoiding a world-sized allocation of cell objects.
    for (let index = 0; index < sim.cellCount; index++) {
      usedElementHashes.add(view.getUint16(sim.cellOffset + index * 16, true))
      usedElementHashes.add(view.getUint16(sim.backwallOffset + index * sim.backwallSize, true))
    }
    elementHashesCache.set(sim.bytes, usedElementHashes)
  }
  const texturePaths = [
    ...[...usedElementHashes].flatMap((hash) => {
      const elementTexture = elementForHash(hash).texture
      const substanceTexture = ONI_SUBSTANCE_BY_HASH.get(hash & 0xffff)?.textureUrl
      const shine = ONI_SHINE_MATERIALS.get(hash & 0xffff)
      return [elementTexture, substanceTexture, shine?.maskUrl, shine?.normalUrl].filter((path): path is string => Boolean(path))
    }),
    '/assets/render/crackAlpha.png', '/assets/render/melt.png', '/assets/render/mudmelt.png',
    '/assets/render/normal_metal.png', '/assets/render/gasSteam01.png', '/assets/render/skullgas.png',
    '/assets/render/noise.png', '/assets/render/bubbles.png', '/assets/render/bgarray_liquids.png',
    '/assets/render/bgarray_liquids_specular.png',
  ]
  const texturesPromise = loadOniPreviewImages(texturePaths)
  const biomePromise = visibleLayers.biome
    ? loadBiomeImages()
    : Promise.resolve({} as Record<number, HTMLImageElement>)
  const maskPromise = visibleLayers.ground || visibleLayers.backwall || visibleLayers.gas || visibleLayers.liquid
    ? loadTerrainMask()
    : Promise.resolve(null)
  const needsObjectManifest = visibleLayers.entities !== false || visibleLayers.buildings !== false || visibleLayers.geysers !== false
  const manifestPromise = needsObjectManifest
    ? loadBuildingManifest()
    : Promise.resolve({} as Record<string, SpriteDefinition>)

  let worldZones = worldZonesCache.get(save)
  if (!worldZones) { worldZones = buildWorldZoneMap(save, size.width, size.height); worldZonesCache.set(save, worldZones) }
  if (isCancelled()) throw new DOMException('地图准备已取消。', 'AbortError')
  const fullManifest = await manifestPromise
  const plantVisuals = new Map([...spaceTreeVisuals(save), ...forestTreeVisuals(save), ...seaTreeVisuals(save)])
  const usedManifestKeys = new Set(managerGroups.flatMap((group) => buildingTextureLookupKeys(group.tag)))
  for (const group of managerGroups) {
    const definition = oniBuildingDefinitionForSaveTag(group.tag)
    const animation = definition?.animation.replace(/_kanim$/i, '').toLowerCase()
    if (animation && group.instances.some((instance) => hasSimpleComponent(instance, 'Door'))) {
      usedManifestKeys.add(`${animation}__open`); usedManifestKeys.add(`${animation}__closed`); usedManifestKeys.add(`${animation}__locked`)
    }
  }
  for (const visual of plantVisuals.values()) if (visual) usedManifestKeys.add(visual.key)
  const buildingManifest = Object.fromEntries([...usedManifestKeys].flatMap((key) => fullManifest[key] ? [[key, fullManifest[key]]] : []))
  const blockTileCells = blockTileCellsByGroup(save)
  const utilityCells = buildUtilityCellMap(save)
  const orderedObjects = mapObjectsInRenderOrder(save)
  const preparedObjects: PreparedObject[] = orderedObjects.map((entry) => {
    const blockTile = blockTileTextureForTag(entry.group.tag)
    const utility = utilityTextureForTag(entry.group.tag)
    const utilityFamily = utilityFamilyForTag(entry.group.tag)
    const geyser = geyserTextureForTag(entry.group.tag)
    const plant = plantVisuals.get(entry.instance)
    const plantSprite = plant ? buildingManifest[plant.key] : undefined
    const building = plantVisuals.has(entry.instance)
      ? plantSprite && plant ? { ...plantSprite, anchorOffsetXCells: (plantSprite.anchorOffsetXCells ?? 0) + plant.offsetX, anchorOffsetYCells: (plantSprite.anchorOffsetYCells ?? 0) + plant.offsetY } : undefined
      : buildingTextureForInstance(entry.group.tag, entry.instance, buildingManifest)
    const sceneLayer = mapObjectSceneLayer(entry.group)
    const isGeyser = isGeyserInstance(entry.group.tag, entry.instance, geyser)
    return { ...entry, sceneLayer, blockTile, utility, utilityFamily, geyser, building, isGeyser, isCreature: sceneLayer === ONI_SCENE_LAYER_ORDER.Creatures,
      spriteMargin: Math.max(2 + Math.abs(plant?.offsetX ?? 0) + Math.abs(plant?.offsetY ?? 0), Math.ceil(isGeyser ? geyser?.widthCells ?? 1 : building ? Math.max(building.widthCells, building.heightCells ?? building.widthCells) : 1)) }
  }).filter((item) => item.group.tag === 'Minion' || item.blockTile || item.utility || item.building || item.isGeyser)
  const objectBuckets = new Map<string, PreparedObject[]>()
  const objectBucketKey = (bucketX: number, bucketRow: number) => `${bucketX}:${bucketRow}`
  for (const item of preparedObjects) {
    const worldX = Math.floor(item.instance.position.x)
    const canvasRow = size.height - 1 - Math.floor(item.instance.position.y)
    const minBucketX = Math.max(0, Math.floor((worldX - item.spriteMargin) / 64))
    const maxBucketX = Math.min(Math.ceil(size.width / 64) - 1, Math.floor((worldX + item.spriteMargin) / 64))
    const minBucketRow = Math.max(0, Math.floor((canvasRow - item.spriteMargin) / 64))
    const maxBucketRow = Math.min(Math.ceil(size.height / 64) - 1, Math.floor((canvasRow + item.spriteMargin) / 64))
    for (let bucketRow = minBucketRow; bucketRow <= maxBucketRow; bucketRow++) for (let bucketX = minBucketX; bucketX <= maxBucketX; bucketX++) {
      const key = objectBucketKey(bucketX, bucketRow)
      const bucket = objectBuckets.get(key) ?? []
      bucket.push(item)
      objectBuckets.set(key, bucket)
    }
  }
  const objectTexturePaths = new Set<string>()
  for (const item of preparedObjects) {
    if (!objectLayerVisible(visibleLayers, item)) continue
    if (item.blockTile) objectTexturePaths.add(item.blockTile.path)
    if (item.utility) objectTexturePaths.add(item.utility.path)
    if (item.geyser && item.isGeyser && !item.building) objectTexturePaths.add(item.geyser.path)
    if (item.building) objectTexturePaths.add(item.building.path)
  }
  const [textures, initialBiomes, maskImage, objectTextures] = await Promise.all([
    texturesPromise,
    biomePromise,
    maskPromise,
    loadOniPreviewImages(objectTexturePaths),
  ])
  let biomeBackgrounds = { ...initialBiomes }
  if (isCancelled()) throw new DOMException('地图准备已取消。', 'AbortError')
  // Minion wearable atlases are optional detail and can be tens of megabytes.
  // Never hold the first terrain chunk behind them; swap them in as soon as
  // they finish and let later/invalidated chunks use the high-detail sprites.
  let minionAssets: MinionKanimAssets | null = null
  const minionWearables = [...new Set(preparedObjects.filter((item) => item.group.tag === 'Minion').flatMap((item) => minionWearableAnimNames(item.instance)))]
  let minionsRequested = false
  const maskSets: TerrainMaskSets | null = maskImage ? createTerrainMaskSets(maskImage) : null
  const visibleGrid = worldGrid(save, 'GridVisible')?.bytes
  const spawnableGrid = worldGrid(save, 'GridSpawnable')?.bytes
  const damageGrid = worldGrid(save, 'GridDamage')?.bytes
  const damageView = damageGrid ? new DataView(damageGrid.buffer, damageGrid.byteOffset, damageGrid.byteLength) : undefined
  const terrainMaskedCells = terrainMaskedCellsByBuilding(save)
  const damageAt = (x: number, y: number) => {
    const offset = (y * size.width + x) * 4
    return damageView && offset >= 0 && offset + 4 <= damageView.byteLength ? damageView.getFloat32(offset, true) : 0
  }
  const backwallCells = new Map<number, SimCell | undefined>()
  const backwallCellAt = (x: number, y: number): SimCell | undefined => {
    if (x < -1 || y < -1 || x > size.width || y > size.height) return undefined
    const key = (y + 1) * sim.width + x + 1
    if (!backwallCells.has(key)) {
      const backwall = readSimBackwall(sim, view, x + 1, y + 1)
      backwallCells.set(key, backwall ? { ...backwall, properties: 0, insulation: 0, strengthInfo: 0 } : undefined)
    }
    return backwallCells.get(key)
  }
  const hasBackwallAt = (x: number, y: number) => {
    const backwall = readSimBackwall(sim, view, x + 1, y + 1)
    return backwall ? elementForHash(backwall.elementHash).state === 'solid' : false
  }
  const isTerrainMaskedAt = (x: number, y: number) => terrainMaskedCells.has(blockTileCellKey(x, y))
  const savedLights = savedOniLights(save)
  const lightVisibility = new WeakMap<OniLightInstance, Set<number>>()
  const snapshotTime = performance.now() / 1000
  const nativeCellSize = baseCellSize
  let shineViewport: FluidViewportCache | undefined
  let fluidViewport: FluidViewportCache | undefined
  const requested = new Map<string, Promise<void>>()
  const detailQueue = new OniDetailQueue(4)
  let pendingDetails = 0
  let revisionTimer: ReturnType<typeof setTimeout> | undefined
  const pendingBiomes: Record<number, HTMLImageElement> = {}
  const flushDetails = () => {
    if (revisionTimer) clearTimeout(revisionTimer)
    revisionTimer = undefined
    if (destroyed) return
    if (Object.keys(pendingBiomes).length) { biomeBackgrounds = { ...biomeBackgrounds, ...pendingBiomes }; for (const key of Object.keys(pendingBiomes)) delete pendingBiomes[Number(key)] }
    assetRevision++; fluidViewport = undefined
  }
  const invalidateDetails = () => { if (!revisionTimer && !destroyed) revisionTimer = setTimeout(flushDetails, 100) }
  const prepareViewport = async (x: number, row: number, widthCells: number, heightCells: number, detail: boolean) => {
    if (destroyed) return
    const paths = new Map<string, number>(), objectPaths = new Map<string, number>(), biomes = new Map<number, number>()
    const focus = mapLoadOrigin(save, x, row, widthCells, heightCells)
    const prioritize = <K,>(map: Map<K, number>, key: K, priority: number) => map.set(key, Math.min(map.get(key) ?? Infinity, priority))
    const minX = Math.max(0, x - 2), maxX = Math.min(size.width, x + widthCells + 2)
    const minRow = Math.max(0, row - 2), maxRow = Math.min(size.height, row + heightCells + 2)
    if (detail) {
      for (let r = minRow; r < maxRow; r++) for (let cx = minX; cx < maxX; cx++) {
        const cy = size.height - 1 - r
        for (const hash of [cellAt(cx, cy)?.elementHash, readSimBackwall(sim, view, cx + 1, cy + 1)?.elementHash]) {
          if (hash === undefined) continue
          const material = ONI_SUBSTANCE_BY_HASH.get(hash), shine = ONI_SHINE_MATERIALS.get(hash)
          for (const path of [elementForHash(hash).texture, material?.textureUrl, shine?.maskUrl, shine?.normalUrl]) if (path) prioritize(paths, path, 16 + Math.hypot(cx - focus.x, r - focus.row))
        }
        const zone = worldZones[cy * size.width + cx] ?? 7
        // The background sampler can blend any neighbouring zone at a boundary.
        if (zone !== 7 && ONI_ZONE_TEXTURE_ARRAY_INDICES[zone] !== undefined) prioritize(biomes, ONI_ZONE_TEXTURE_ARRAY_INDICES[zone], 40 + Math.hypot(cx - focus.x, r - focus.row))
      }
      for (const path of texturePaths) if (path.startsWith('/assets/render/') && !path.includes('/shine/')) prioritize(paths, path, 60)
    }
    const nearby = new Set<PreparedObject>()
    for (let by = Math.floor(minRow / 64); by <= Math.floor(maxRow / 64); by++) for (let bx = Math.floor(minX / 64); bx <= Math.floor(maxX / 64); bx++) {
      for (const item of objectBuckets.get(objectBucketKey(bx, by)) ?? []) nearby.add(item)
    }
    for (const item of nearby) {
      const px = item.instance.position.x, pr = size.height - 1 - item.instance.position.y
      if (!objectLayerVisible(visibleLayers, item) || px + item.spriteMargin < minX || px - item.spriteMargin > maxX || pr + item.spriteMargin < minRow || pr - item.spriteMargin > maxRow) continue
      for (const path of [item.blockTile?.path, item.utility?.path, item.building?.path, item.isGeyser && !item.building ? item.geyser?.path : undefined]) {
        if (path && (detail || !objectTextures[path])) prioritize(objectPaths, path, /^(Headquarters|ExobaseHeadquarters)$/.test(item.group.tag) ? -1000 : Math.hypot(px - focus.x, pr - focus.row) + (item.blockTile || item.utility ? 8 : 0))
      }
    }
    const needsMinions = detail && !minionsRequested && (visibleLayers.minions ?? true) && [...nearby].some(item => item.group.tag === 'Minion')
    if (needsMinions) minionsRequested = true
    const jobs: Promise<void>[] = []
    const request = (path: string, target: Record<string, HTMLImageElement> | null, priority: number, biome?: number) => {
      const existing = requested.get(path)
      if (existing) { jobs.push(existing); return }
      pendingDetails++
      const job = detailQueue.enqueue(async () => {
        if (destroyed) return
        const image = await loadImage(path)
        if (destroyed) return
        if (!image) { requested.delete(path); return }
        if (target) target[path] = image
        if (biome !== undefined) pendingBiomes[biome] = image
        // Publish each completed asset; a distant or stalled file must not
        // keep the printing pod and nearby objects on their small previews.
        invalidateDetails()
      }, priority).finally(() => { pendingDetails-- })
      requested.set(path, job); jobs.push(job)
    }
    for (const [path, priority] of objectPaths) request(path, objectTextures, priority)
    for (const [path, priority] of paths) request(path, textures, priority)
    for (const [index, priority] of biomes) request(biomeBackgroundAsset(index), null, priority, index)
    await Promise.all(jobs)
    if (revisionTimer) flushDetails()
    // Wearable packages must not compete with the printing pod's first textures.
    if (needsMinions && !destroyed) {
      void loadMinionKanimAssets(minionWearables).then(assets => { if (!destroyed) { minionAssets = assets; assetRevision++; fluidViewport = undefined } }).catch(() => { minionsRequested = false })
    }
  }
  const ready = Promise.resolve()

  return {
    width: size.width,
    height: size.height,
    cellSize: baseCellSize,
    get revision() { return assetRevision },
    get pendingDetails() { return pendingDetails },
    ready,
    prepareViewport,
    renderChunk(x, row, widthCells, heightCells, options) {
      const baseCellSize = options?.cellSize ?? nativeCellSize
      const surfacesOnly = options?.surfacesOnly === true
      const fluidsOnly = options?.fluidsOnly === true
      const cameraKey = options?.shineCamera ? shineCameraKey(options.shineCamera) : ''
      const viewportKey = `${x}:${row}:${widthCells}:${heightCells}:${baseCellSize}`
      const reusedViewport = fluidsOnly && fluidViewport?.key === viewportKey ? fluidViewport : undefined
      if (fluidsOnly && !reusedViewport) fluidViewport = { key: viewportKey, layers: {} }
      if (surfacesOnly && shineViewport?.key !== viewportKey) shineViewport = { key: viewportKey, layers: {} }
      const frameCache = fluidsOnly ? fluidViewport : surfacesOnly ? shineViewport : undefined
      if (destroyed) throw new Error('ONI 分块渲染器已经销毁。')
      const gutter = CHUNK_GUTTER_CELLS
      const gutterPixels = gutter * baseCellSize
      const pixelWidth = widthCells * baseCellSize
      const pixelHeight = heightCells * baseCellSize
      const surfaceWidth = pixelWidth + gutterPixels * 2
      const surfaceHeight = pixelHeight + gutterPixels * 2
      const range = {
        minX: Math.max(0, x - gutter),
        maxX: Math.min(size.width - 1, x + widthCells - 1 + gutter),
        minRow: Math.max(0, row - gutter),
        maxRow: Math.min(size.height - 1, row + heightCells - 1 + gutter),
      }
      const originX = gutterPixels - x * baseCellSize
      const originY = gutterPixels - row * baseCellSize
      const surface = () => {
        const canvas = document.createElement('canvas')
        canvas.width = surfaceWidth
        canvas.height = surfaceHeight
        return canvas
      }
      const result: OniRenderedChunk = { x: x * baseCellSize, y: row * baseCellSize, width: pixelWidth, height: pixelHeight, layers: {} }

      const cropped = (source: HTMLCanvasElement, layer: OniChunkLayer) => {
        if (!frameCache) return crop(source, gutterPixels, pixelWidth, pixelHeight)
        const target = frameCache.layers[layer] ?? document.createElement('canvas')
        if (target.width !== pixelWidth || target.height !== pixelHeight) { target.width = pixelWidth; target.height = pixelHeight }
        const context = target.getContext('2d')!
        context.clearRect(0, 0, pixelWidth, pixelHeight)
        context.drawImage(source, gutterPixels, gutterPixels, pixelWidth, pixelHeight, 0, 0, pixelWidth, pixelHeight)
        frameCache.layers[layer] = target
        return target
      }
      let backwallSurface = frameCache?.backwall
      let backgroundSurface = frameCache?.background
      if (frameCache && frameCache.shinyBackwall === undefined) {
        frameCache.shinyBackwall = false
        if (visibleLayers.backwall) for (let r = range.minRow; r <= range.maxRow && !frameCache.shinyBackwall; r++) {
          for (let xx = range.minX; xx <= range.maxX; xx++) {
            const cell = backwallCellAt(xx, size.height - 1 - r)
            if (cell && ONI_SHINE_MATERIALS.has(cell.elementHash & 0xffff)) { frameCache.shinyBackwall = true; break }
          }
        }
      }
      const repaintBackground = !backgroundSurface || frameCache?.backgroundRevision !== assetRevision
        || (frameCache?.shinyBackwall && frameCache.cameraKey !== cameraKey)
      if (!options?.skipSurfaces && repaintBackground && (visibleLayers.biome || visibleLayers.backwall)) {
        const canvas = backgroundSurface ?? surface()
        canvas.getContext('2d')!.clearRect(0, 0, surfaceWidth, surfaceHeight)
        const context = canvas.getContext('2d')!
        context.imageSmoothingEnabled = false
        if (visibleLayers.biome) oniWorldRenderer.renderBiome({ context, worldZones, width: size.width, height: size.height, cellSize: baseCellSize, originX, originY, range, backgrounds: biomeBackgrounds })
        if (visibleLayers.backwall) {
          backwallSurface ??= surface()
          backwallSurface.getContext('2d')!.clearRect(0, 0, surfaceWidth, surfaceHeight)
          const backwallContext = backwallSurface.getContext('2d')!
          const propertySource = {
            context, width: size.width, height: size.height, cellSize: baseCellSize,
            originX, originY, range, worldZones, textures, maskSets, cellAt, shineCamera: options?.shineCamera,
            propertyCacheKey, isTerrainMaskedAt, damageAt, hasBackwallAt, zoneColors: ONI_WORLD_ZONE_COLORS,
          }
          oniWorldRenderer.renderTerrain({
            ...propertySource, context: backwallContext, surfaceKind: 'backwall', propertySource,
            cellAt: backwallCellAt, isTerrainMaskedAt: () => false,
          })
          context.drawImage(backwallSurface, 0, 0)
        }
        backgroundSurface = canvas
        if (frameCache) frameCache.backgroundRevision = assetRevision
      }

      if (!fluidsOnly && backgroundSurface) result.layers.background = cropped(backgroundSurface, 'background')

      const drawObjects = (front: boolean, retainGutter = false): HTMLCanvasElement | undefined => {
        const canvas = surface()
        const context = canvas.getContext('2d')!
        context.imageSmoothingEnabled = false
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        let painted = false
        const chunkObjects = new Set<PreparedObject>()
        for (let by = Math.floor(range.minRow / 64); by <= Math.floor(range.maxRow / 64); by++) {
          for (let bx = Math.floor(range.minX / 64); bx <= Math.floor(range.maxX / 64); bx++) {
            for (const item of objectBuckets.get(objectBucketKey(bx, by)) ?? []) chunkObjects.add(item)
          }
        }
        for (const item of chunkObjects) {
          if ((item.sceneLayer >= TERRAIN_SCENE_LAYER) !== front || !objectLayerVisible(visibleLayers, item)) continue
          const instance = item.instance
          const x = Math.floor(instance.position.x)
          const y = Math.floor(instance.position.y)
          const canvasY = size.height - 1 - y
          if (x < range.minX - item.spriteMargin || x > range.maxX + item.spriteMargin || canvasY < range.minRow - item.spriteMargin || canvasY > range.maxRow + item.spriteMargin) continue
          if (item.group.tag === 'Minion') {
            const anchor = mapObjectAnchor(instance.position.x, instance.position.y, size.height, baseCellSize, originX, originY)
            if (minionAssets) drawMinionKanim(context, minionAssets, minionAccessoryGuids(instance), minionWearableAnimNames(instance), baseCellSize, anchor.x, anchor.y, minionFacesLeft(instance))
            else { context.fillStyle = '#e4b067'; context.fillRect(originX + x * baseCellSize + 1, originY + canvasY * baseCellSize + 1, Math.max(1, baseCellSize - 2), Math.max(1, baseCellSize - 2)) }
            painted = true
          } else if (item.utility && item.utilityFamily) {
            const image = objectTextures[item.utility.path]
            if (!image) continue
            const anchor = mapObjectAnchor(instance.position.x, instance.position.y, size.height, baseCellSize, originX, originY)
            drawUtilityTile(context, image, item.utility, utilityDisplayConnections(utilityCells, item.utilityFamily, instance, x, y), anchor.x, anchor.y, baseCellSize)
            painted = true
          } else if (item.blockTile) {
            const image = objectTextures[item.blockTile.path]
            if (!image) continue
            const cells = blockTileCells.get(item.group)
            const bits = blockTileConnectionBits((nx, ny) => cells?.has(blockTileCellKey(nx, ny)) ?? false, x, y)
            drawBlockTile(context, image, bits, originX + x * baseCellSize, originY + canvasY * baseCellSize, baseCellSize)
            painted = true
          } else if (item.isGeyser && !item.building && item.geyser) {
            const image = objectTextures[item.geyser.path]
            if (!image) continue
            drawSprite(context, image, item.geyser, baseCellSize, originX + instance.position.x * baseCellSize, originY + (size.height - instance.position.y - .5) * baseCellSize)
            painted = true
          } else if (item.building) {
            const image = objectTextures[item.building.path]
            if (!image) continue
            const anchor = mapObjectAnchor(instance.position.x, instance.position.y, size.height, baseCellSize, originX, originY)
            drawSprite(context, image, item.building, baseCellSize, anchor.x, anchor.y, instanceOrientation(instance), rotatableVisualizerForTag(item.group.tag))
            painted = true
          }
        }
        return painted ? (retainGutter ? canvas : crop(canvas, gutterPixels, pixelWidth, pixelHeight)) : undefined
      }

      if (frameCache) { frameCache.backwall = backwallSurface; frameCache.background = backgroundSurface; frameCache.cameraKey = cameraKey }
      if (!surfacesOnly) {
        const objectsBack = reusedViewport ? reusedViewport.objects : drawObjects(false, true)
        if (frameCache) { frameCache.backwall = backwallSurface; frameCache.background = backgroundSurface; frameCache.objects = objectsBack }
        if (objectsBack && !fluidsOnly) result.layers.entitiesBack = crop(objectsBack, gutterPixels, pixelWidth, pixelHeight)

        const hasGasCells = reusedViewport?.hasGas ?? (!options?.skipFluids && visibleLayers.gas && hasCellsInRange(range, size.height, cellAt, 'gas'))
        const hasLiquidCells = reusedViewport?.hasLiquid ?? (!options?.skipFluids && visibleLayers.liquid && hasCellsInRange(range, size.height, cellAt, 'liquid'))
        if (frameCache) { frameCache.hasGas = hasGasCells; frameCache.hasLiquid = hasLiquidCells }
        const gasSurface = hasGasCells ? frameCache?.gas ?? surface() : undefined
        if (frameCache) frameCache.gas = gasSurface
        const gasContext = gasSurface?.getContext('2d')
        if (gasContext) { gasContext.clearRect(0, 0, surfaceWidth, surfaceHeight); gasContext.imageSmoothingEnabled = false }
        const liquidSurface = hasLiquidCells ? frameCache?.liquid ?? surface() : undefined
        if (frameCache) frameCache.liquid = liquidSurface
        const liquidContext = liquidSurface?.getContext('2d')
        if (liquidContext) { liquidContext.clearRect(0, 0, surfaceWidth, surfaceHeight); liquidContext.imageSmoothingEnabled = false }
        const fluidInput = {
          width: size.width,
          height: size.height,
          cellSize: baseCellSize,
          originX,
          originY,
          range,
          worldZones,
          textures,
          maskSets,
          cellAt,
          propertyCacheKey,
          isTerrainMaskedAt,
          damageAt,
          hasBackwallAt,
          zoneColors: ONI_WORLD_ZONE_COLORS,
          clipToRange: true,
          timeSeconds: options?.timeSeconds ?? snapshotTime,
        }
        const gasRendered = overlay === 'none' && gasContext && hasGasCells
          ? oniWorldRenderer.renderGas({ ...fluidInput, context: gasContext }) : false
        const preLiquid = hasLiquidCells ? frameCache?.scene ?? surface() : undefined
        if (frameCache) frameCache.scene = preLiquid
        const preLiquidContext = preLiquid?.getContext('2d')
        if (preLiquidContext) {
          preLiquidContext.clearRect(0, 0, surfaceWidth, surfaceHeight)
          if (backgroundSurface) preLiquidContext.drawImage(backgroundSurface, 0, 0)
          if (gasSurface) preLiquidContext.drawImage(gasSurface, 0, 0)
          if (objectsBack) preLiquidContext.drawImage(objectsBack, 0, 0)
        }
        let sceneMask = reusedViewport?.sceneMask
        if (!sceneMask && hasLiquidCells && backwallSurface) {
          sceneMask = surface()
          const maskContext = sceneMask.getContext('2d')!
          // Substance ALPHA/OPAQUE writes MRT1=(0,.5,0,coverage); biome writes G=0.
          maskContext.drawImage(backwallSurface, 0, 0)
          maskContext.globalCompositeOperation = 'source-in'
          maskContext.fillStyle = 'rgb(0,128,0)'
          maskContext.fillRect(0, 0, surfaceWidth, surfaceHeight)
          maskContext.globalCompositeOperation = 'source-over'
          if (frameCache) frameCache.sceneMask = sceneMask
        }
        const liquidRendered = overlay === 'none'  && liquidContext && hasLiquidCells
          ? oniWorldRenderer.renderLiquid({ ...fluidInput, context: liquidContext, sceneSource: preLiquid, sceneMaskSource: sceneMask }) : false
        if (overlay === 'none' && (!gasRendered || !liquidRendered)) for (let canvasY = range.minRow; canvasY <= range.maxRow; canvasY++) {
          const y = size.height - 1 - canvasY
          for (let worldX = range.minX; worldX <= range.maxX; worldX++) {
            const cell = cellAt(worldX, y)
            if (!cell) continue
            const element = elementForHash(cell.elementHash)
            const px = originX + worldX * baseCellSize
            const py = originY + canvasY * baseCellSize
            if (!gasRendered && gasContext && element.state === 'gas' && element.fluidMaterial) drawGasFallback(gasContext, element.fluidMaterial, cell, px, py, baseCellSize)
            if (!liquidRendered && liquidContext && element.state === 'liquid' && element.fluidMaterial) {
              const above = cellAt(worldX, y + 1)
              const state = above ? elementForHash(above.elementHash).state : undefined
              drawLiquidFallback(liquidContext, element.fluidMaterial, cell, px, py, baseCellSize, state === 'liquid' || state === 'solid')
            }
          }
        }
        if (frameCache) {
          // Reuse the same two canvases so Pixi updates existing GPU textures.
          // A continuous viewport has no internal chunk edges to trim on the CPU.
          for (const [layer, source] of [['gas', gasSurface], ['liquid', liquidSurface]] as const) {
            if (!source) continue
            let target = frameCache.layers[layer]
            if (!target) {
              target = document.createElement('canvas')
              target.width = pixelWidth; target.height = pixelHeight
              frameCache.layers[layer] = target
            }
            const context = target.getContext('2d')!
            context.clearRect(0, 0, pixelWidth, pixelHeight)
            context.drawImage(source, gutterPixels, gutterPixels, pixelWidth, pixelHeight, 0, 0, pixelWidth, pixelHeight)
            result.layers[layer] = target
          }
        } else {
          if (gasSurface) result.layers.gas = trimFluidNoise(cropVisible(gasSurface, gutterPixels, pixelWidth, pixelHeight))
          if (liquidSurface) result.layers.liquid = trimFluidNoise(cropVisible(liquidSurface, gutterPixels, pixelWidth, pixelHeight))
        }
        if (fluidsOnly) return result
      }

      if (!options?.skipSurfaces) {
        const terrain = frameCache?.terrain ?? surface()
        if (frameCache) frameCache.terrain = terrain
        terrain.getContext('2d')!.clearRect(0, 0, surfaceWidth, surfaceHeight)
        const terrainContext = terrain.getContext('2d')!
        terrainContext.imageSmoothingEnabled = false
        if (visibleLayers.ground) oniWorldRenderer.renderTerrain({ context: terrainContext, width: size.width, height: size.height, cellSize: baseCellSize, originX, originY, range, worldZones, textures, maskSets, cellAt, propertyCacheKey, isTerrainMaskedAt, damageAt, hasBackwallAt, zoneColors: ONI_WORLD_ZONE_COLORS, shineCamera: options?.shineCamera })
        const patterns = new Map<string, CanvasPattern | null>()
        for (const [path, image] of Object.entries(textures)) {
          const pattern = terrainContext.createPattern(image, 'repeat')
          if (pattern) {
            const element = ELEMENTS.find((candidate) => candidate.texture === path)
            const scale = baseCellSize * (element?.worldUvScale ?? DEFAULT_ELEMENT_WORLD_UV_SCALE) / image.naturalWidth
            pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, originX, originY + size.height * baseCellSize - baseCellSize * (element?.worldUvScale ?? DEFAULT_ELEMENT_WORLD_UV_SCALE)]))
          }
          patterns.set(path, pattern)
        }
        for (let canvasY = range.minRow; canvasY <= range.maxRow; canvasY++) {
          const y = size.height - 1 - canvasY
          for (let worldX = range.minX; worldX <= range.maxX; worldX++) {
            const cell = cellAt(worldX, y)
            if (!cell) continue
            const element = elementForHash(cell.elementHash)
            const px = originX + worldX * baseCellSize
            const py = originY + canvasY * baseCellSize
            if (element.state === 'special') {
              terrainContext.fillStyle = patterns.get(element.texture ?? '') ?? element.color
              terrainContext.fillRect(px, py, baseCellSize, baseCellSize)
            }
            if (overlay === 'temperature') {
              terrainContext.fillStyle = temperatureColor(cell.temperature); terrainContext.globalAlpha = .72; terrainContext.fillRect(px, py, baseCellSize, baseCellSize); terrainContext.globalAlpha = 1
            } else if (overlay === 'mass') {
              const intensity = Math.min(1, Math.log10(1 + Math.max(0, cell.mass)) / 2.2); terrainContext.fillStyle = `rgba(117, 171, 191, ${.12 + intensity * .88})`; terrainContext.fillRect(px, py, baseCellSize, baseCellSize)
            } else if (overlay === 'visibility') {
              const value = visibleGrid?.[y * size.width + worldX] ?? 0; terrainContext.fillStyle = value > 0 ? `rgba(127, 169, 212, ${.2 + value / 255 * .72})` : 'rgba(16, 23, 25, .84)'; terrainContext.fillRect(px, py, baseCellSize, baseCellSize)
            } else if (overlay === 'spawnable') {
              const value = spawnableGrid?.[y * size.width + worldX] ?? 0; terrainContext.fillStyle = value > 0 ? `rgba(112, 157, 123, ${.2 + value / 255 * .72})` : 'rgba(16, 23, 25, .84)'; terrainContext.fillRect(px, py, baseCellSize, baseCellSize)
            } else if (overlay === 'damage') {
              const value = Math.max(0, Math.min(1, damageAt(worldX, y))); terrainContext.fillStyle = value > 0 ? `rgba(198, 123, 113, ${.2 + value * .72})` : 'rgba(16, 23, 25, .84)'; terrainContext.fillRect(px, py, baseCellSize, baseCellSize)
            } else if (overlay === 'disease') {
              const index = (y + 1) * sim.width + worldX + 1; const offset = sim.diseaseOffset + index * SIM_DISEASE_SIZE; let level = 0; for (let byte = 0; byte < SIM_DISEASE_SIZE; byte++) level += sim.bytes[offset + byte]; const intensity = Math.min(.9, .12 + level / 2040); terrainContext.fillStyle = level > 0 ? `rgba(194, 102, 111, ${intensity})` : 'rgba(16, 23, 25, .84)'; terrainContext.fillRect(px, py, baseCellSize, baseCellSize)
            }
          }
        }
        result.layers.terrain = cropped(terrain, 'terrain')
      }
      if (surfacesOnly) return result
      const objectsFront = drawObjects(true)
      if (objectsFront) result.layers.entitiesFront = objectsFront
      if (overlay === 'none' && visibleLayers.lighting !== false) {
        const localLights = savedLights.filter(light => {
          const lx = light.x + light.definition.offset[0], ly = size.height - light.y - light.definition.offset[1]
          const radius = light.definition.range
          return lx + radius >= range.minX && lx - radius <= range.maxX + 1
            && ly + radius >= range.minRow && ly - radius <= range.maxRow + 1
        })
        if (localLights.length) {
          const lightSurface = surface()
          if (drawOniLightBuffer({ context: lightSurface.getContext('2d')!, lights: localLights,
            width: size.width, height: size.height, worldHeight: size.height, cellSize: baseCellSize,
            originX, originY, cellAt, visibilityCache: lightVisibility })) {
            result.layers.light = crop(lightSurface, gutterPixels, pixelWidth, pixelHeight)
          }
        }
      }
      return result
    },
    destroy() { destroyed = true; if (revisionTimer) clearTimeout(revisionTimer); fluidViewport = undefined; shineViewport = undefined; cellCache.clear(); backwallCells.clear() },
  }
}
