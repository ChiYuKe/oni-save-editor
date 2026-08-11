import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import {
  AlertTriangle,
  Archive,
  Boxes,
  ChevronRight,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileUp,
  FileText,
  Gauge,
  Grid2x2,
  Hand,
  Layers3,
  Maximize2,
  Paintbrush,
  PaintBucket,
  Pipette,
  Minus,
  Plus,
  Redo2,
  Search,
  Save,
  Settings2,
  Square,
  SlidersHorizontal,
  Undo2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import './App.css'
import { buildSave, type ParsedSave } from './lib/save'
import { ELEMENTS, defaultElementValues, elementForHash, elementOptions, formatHash, type FluidMaterialStyle } from './lib/elements'
import {
  component,
  editableMembers,
  formatNumber,
  gameValue,
  groupByTag,
  groupRows,
  isEditable,
  member,
  objectName,
  scalarNumber,
  scalarText,
  saveGameInstance,
  setValueFromText,
  topGroups,
  worldGrid,
  worldCoordinate,
  worldSeed,
  worldSize,
} from './lib/editor'
import type { SavedObjectGroup, SavedObjectInstance, Value } from './lib/model'
import { SIM_DISEASE_SIZE, getSimElementProfile, getWorldCell, readSimBackwall, readSimCell, setWorldCells, type SimCell } from './lib/sim'
import { BLOCK_TILE_TEXTURES, blockTileCellKey, blockTileConnectionBits, blockTileTextureForTag, drawBlockTile } from './lib/blockTiles'
import {
  TERRAIN_MASK_ATLAS_URL,
  createTerrainBoundaryPath,
  createTerrainCellPath,
  createTerrainMaskSets,
  type TerrainMaskSets,
} from './lib/terrainMasks'
import {
  UTILITY_DEFINITIONS,
  drawUtilityTile,
  utilityConnectionBits,
  utilityFamilyForTag,
  utilityNeighbourConnections,
  utilityTextureForTag,
  type UtilityCellMap,
  type UtilityCellRecord,
  type UtilityFamily,
} from './lib/utilityTiles'
import { parseYamlTemplate, templateVisualElementForName, type TemplateEntity, type YamlTemplate } from './lib/yamlTemplates'
import { oniBuildingDefinitionForAnimation, oniBuildingDefinitionForTag, type OniBuildingDefinition } from './lib/oniBuildingDefs.generated'
import { ONI_SCENE_LAYER_ORDER, ONI_WORLD_ZONE_COLORS, oniWorldRenderer } from './lib/oniRenderer'
import { ONI_SUBSTANCE_MATERIALS } from './lib/oniSubstances.generated'
import { drawMinionKanim, loadMinionKanimAssets, type MinionKanimAssets } from './lib/oniMinionKanim'
import { drawOniLightBuffer, oniLightDefinitionForTag, type OniLightInstance } from './lib/oniLighting'
import { drawOniSavedParticles, loadOniParticleTextures } from './lib/oniParticles'
import { oniStateMachineState } from './lib/oniStateMachines'

type View = 'overview' | 'map' | 'dupes' | 'objects'
type MapLayer = 'grid' | 'biome' | 'minions' | 'entities' | 'buildings' | 'geysers' | 'power' | 'plumbing' | 'ventilation' | 'automation' | 'shipment' | 'gas' | 'liquid' | 'ground' | 'backwall'
type MapOverlay = 'none' | 'temperature' | 'mass' | 'disease' | 'visibility' | 'spawnable' | 'damage'
type MapLayerVisibility = Record<MapLayer, boolean>
type MapEdit = { x: number; y: number; before: SimCell; after: SimCell }
type MapPreviewCell = { x: number; y: number; elementHash: number }
type MapSelection = { start: { x: number; y: number }; end: { x: number; y: number } }
type MapTool = 'inspect' | 'move' | 'paint' | 'erase' | 'eyedropper' | 'fill' | 'rectangle' | 'line'
type MapCellUpdate = { x: number; y: number; patch: Partial<SimCell> }
type MapViewport = { zoomPercent: number; pan: { x: number; y: number } }
// Start at the source grid's full extent. A save can place its active asteroid
// far away from the global grid centre, so a magnified centred view may contain
// only unexplored fog even though the colony data rendered correctly.
const DEFAULT_MAP_VIEWPORT: MapViewport = { zoomPercent: 0, pan: { x: 0, y: 0 } }
const MAP_CELL_PIXELS = 4
const MAP_ZOOM_MIN = 1
const MAP_ZOOM_MAX = 16
// Keep export cells on whole pixels so scaled terrain masks and textures stay crisp.
const PANORAMA_CELL_PIXELS = 11
const DEFAULT_ELEMENT_WORLD_UV_SCALE = 8
const MAP_EDITOR_URL = 'https://chiyuke.github.io/oni-save-editor/'
type GeyserTextureDefinition = {
  path: string
  widthCells: number
  heightCells?: number
  verticalOffsetCells?: number
  anchorOffsetXCells?: number
  anchorOffsetYCells?: number
}
type BuildingTextureDefinition = {
  path: string
  widthCells: number
  heightCells?: number
  anchorOffsetXCells?: number
  anchorOffsetYCells?: number
}
type RotatableVisualizer = {
  pivotXCells: number
  pivotYCells: number
  offsetXCells: number
  offsetYCells: number
}
function assetPath(path: string): string {
  if (!path.startsWith('/')) return path
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`
}

// The game samples these layers from the bgarray Texture2DArray. The values
// match SubworldZoneRenderData.zoneTextureArrayIndices in the game source.
function biomeBackgroundAsset(textureIndex: number): string {
  return `/assets/background/biomes/slice-${textureIndex.toString().padStart(2, '0')}.png`
}

function pointInPolygon(x: number, y: number, vertices: Array<{ x: number; y: number }>): boolean {
  let inside = false
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index++) {
    const currentVertex = vertices[index]
    const previousVertex = vertices[previous]
    const intersects = currentVertex.y > y !== previousVertex.y > y
      && x < (previousVertex.x - currentVertex.x) * (y - currentVertex.y) / (previousVertex.y - currentVertex.y) + currentVertex.x
    if (intersects) inside = !inside
  }
  return inside
}

function buildWorldZoneMap(save: ParsedSave, width: number, height: number): Uint8Array {
  const zoneMap = new Uint8Array(width * height)
  zoneMap.fill(7)
  const worldDetail = member(save.gameData, 'worldDetail')?.value
  if (!worldDetail || worldDetail.kind !== 'object') return zoneMap
  const overworldCells = member(worldDetail, 'overworldCells')?.value
  if (!overworldCells || overworldCells.kind !== 'list') return zoneMap

  for (const item of overworldCells.items) {
    if (item.kind !== 'object') continue
    const zoneValue = member(item, 'zoneType')?.value
    const zoneType = zoneValue && (zoneValue.kind === 'enum' || zoneValue.kind === 'byte' || zoneValue.kind === 'int32')
      ? zoneValue.v
      : undefined
    const polygonValue = member(item, 'poly')?.value
    if (zoneType === undefined || !polygonValue || polygonValue.kind !== 'object') continue
    const verticesValue = member(polygonValue, 'vertices')?.value
    if (!verticesValue || verticesValue.kind !== 'list') continue
    const vertices = verticesValue.items
      .filter((vertex): vertex is Extract<typeof vertex, { kind: 'vector2' }> => vertex.kind === 'vector2')
      .map((vertex) => ({ x: vertex.x, y: vertex.y }))
    if (vertices.length < 3) continue
    const minX = Math.max(0, Math.floor(Math.min(...vertices.map((vertex) => vertex.x))))
    const maxX = Math.min(width - 1, Math.ceil(Math.max(...vertices.map((vertex) => vertex.x))))
    const minY = Math.max(0, Math.floor(Math.min(...vertices.map((vertex) => vertex.y))))
    const maxY = Math.min(height - 1, Math.ceil(Math.max(...vertices.map((vertex) => vertex.y))))
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (pointInPolygon(x, y, vertices)) zoneMap[y * width + x] = zoneType
      }
    }
  }
  return zoneMap
}

function geyserAsset(fileName: string, widthCells: number): GeyserTextureDefinition {
  const isGasGeyser = fileName.startsWith('geyser_gas_') || /^geyser_side_(chlorine|methane|steam)_/.test(fileName)
  return { path: `/assets/geysers/${fileName}`, widthCells, verticalOffsetCells: isGasGeyser ? 1 : undefined }
}

const GEYSER_TEXTURES: Record<string, GeyserTextureDefinition> = {
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

// Prefab tags and exported sprite ids use different word orders for several geysers.
const GEYSER_TAG_ALIASES: Record<string, string> = {
  big_volcano: 'molten_volcano_big',
  chlorine_gas_cool: 'gas_chlorine',
  chlorine_gas: 'gas_chlorine',
  filthy_water: 'liquid_water_filthy',
  hot_co2: 'gas_co2_hot',
  hot_hydrogen: 'gas_hydrogen_hot',
  hot_steam: 'gas_steam_hot',
  hot_water: 'liquid_water_hot',
  murky_brine: 'liquid_murky_brine',
  methane: 'gas_methane',
  oil_drip: 'oil_cap',
  salt_water_cool_slush: 'liquid_salt_water_cool_slush',
  slush_salt_water: 'liquid_salt_water_cool_slush',
  slush_water: 'liquid_water_slush',
  slimy_po2: 'gas_po2_slimy',
  small_volcano: 'molten_volcano_small',
  steam: 'gas_steam',
  salt_water: 'liquid_salt_water',
}

function geyserTextureForTag(tag: string): GeyserTextureDefinition | undefined {
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

function loadAssetImage(path: string, onLoad: (image: HTMLImageElement) => void): void {
  const image = new Image()
  let settled = false
  const finish = () => {
    if (settled || !image.naturalWidth || !image.naturalHeight) return
    settled = true
    onLoad(image)
  }
  image.decoding = 'async'
  image.onload = finish
  image.src = assetPath(path)
  // Cached assets may already be complete before the load callback is attached.
  if (image.complete) finish()
}

function loadAssetImages(paths: Iterable<string>): Promise<Record<string, HTMLImageElement>> {
  return Promise.all(Array.from(new Set(paths), (path) => new Promise<{ path: string; image: HTMLImageElement } | null>((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve({ path, image })
    image.onerror = () => resolve(null)
    image.src = assetPath(path)
  }))).then((entries) => {
    const images: Record<string, HTMLImageElement> = {}
    entries.forEach((entry) => { if (entry) images[entry.path] = entry.image })
    return images
  })
}

const BUILDING_TEXTURES: Record<string, BuildingTextureDefinition> = {
  gasvent: { path: '/assets/buildings/sprites/ventgas.png', widthCells: 1 },
  gasventhighpressure: { path: '/assets/buildings/sprites/ventgas_powered.png', widthCells: 1 },
  liquidvent: { path: '/assets/buildings/sprites/ventliquid.png', widthCells: 1 },
  solidvent: {
    path: '/assets/buildings/sprites/conveyer_dropper.png',
    widthCells: 1.26,
    heightCells: 1.38,
    anchorOffsetXCells: -.00975,
    anchorOffsetYCells: -.418625,
  },
  underwatervent: { path: '/assets/buildings/sprites/underwater_vent.png', widthCells: 4 },
  underwaterventdrill: { path: '/assets/buildings/sprites/underwater_vent_drill.png', widthCells: 4 },
  wirebridge: { path: '/assets/buildings/sprites/utilityelectricbridge.png', widthCells: 1 },
  wirerefinedbridge: { path: '/assets/buildings/sprites/utilityelectricbridgeconductive.png', widthCells: 1 },
  wirerubberbridge: { path: '/assets/buildings/sprites/utilityelectricbridgerubber.png', widthCells: 1 },
  gasconduitbridge: { path: '/assets/buildings/sprites/utilitygasbridge.png', widthCells: 1 },
  liquidconduitbridge: { path: '/assets/buildings/sprites/utilityliquidbridge.png', widthCells: 1 },
  solidconduitbridge: { path: '/assets/buildings/sprites/utilities_conveyorbridge.png', widthCells: 1 },
  solidconduitinbox: { path: '/assets/buildings/sprites/conveyorin.png', widthCells: 1.23, heightCells: 2.27, anchorOffsetXCells: -.008375, anchorOffsetYCells: -1.006875 },
  solidconduitoutbox: { path: '/assets/buildings/sprites/conveyorout.png', widthCells: 1.230125, heightCells: 2.21675, anchorOffsetXCells: -.018688, anchorOffsetYCells: -.967875 },
  logicwirebridge: { path: '/assets/buildings/sprites/logic_bridge.png', widthCells: 1 },
  warpconduitreceiver: { path: '/assets/buildings/sprites/warp_conduit_receiver.png', widthCells: 4.097, heightCells: 2.6855, anchorOffsetXCells: -.00463, anchorOffsetYCells: -1.26625 },
  warpconduitsender: { path: '/assets/buildings/sprites/warp_conduit_sender.png', widthCells: 4.1547, heightCells: 2.790875, anchorOffsetXCells: .01197, anchorOffsetYCells: -1.318938 },
  conduitportgasloader: { path: '/assets/buildings/sprites/conduit_port_gas_loader.png', widthCells: 1 },
  conduitportgasunloader: { path: '/assets/buildings/sprites/conduit_port_gas_unloader.png', widthCells: 1 },
  conduitportliquidloader: { path: '/assets/buildings/sprites/conduit_port_liquid_loader.png', widthCells: 1 },
  conduitportliquidunloader: { path: '/assets/buildings/sprites/conduit_port_liquid_unloader.png', widthCells: 1 },
  conduitportsolidloader: { path: '/assets/buildings/sprites/conduit_port_solid_loader.png', widthCells: 1 },
  conduitportsolidunloader: { path: '/assets/buildings/sprites/conduit_port_solid_unloader.png', widthCells: 1 },
}

// Some prefab tags use a different word order from their KAnim package name.
// Keep these aliases at the lookup boundary so the save format remains intact.
const BUILDING_TAG_ALIASES: Record<string, string> = {
  flushtoilet: 'toiletflush',
  toiletwall: 'toilet_wall',
  washbasin: 'wash_sink',
  liquidvent: 'ventliquid',
  solidconduitinbox: 'conveyorin',
  solidconduitoutbox: 'conveyorout',
  warpconduitsender: 'warp_conduit_sender',
  warpconduitreceiver: 'warp_conduit_receiver',
  door: 'door_internal',
  pneumaticdoor: 'door_internal',
  manualairlock: 'door_manual',
  manualpressuredoor: 'door_manual',
  mechanizedairlock: 'door_external',
  insulateddoor: 'door_insulated',
  bunkerdoor: 'door_bunker',
  woodendoor: 'door_wood',
  facilitydoor: 'door_facility',
  poibunkerexteriordoor: 'door_poi',
  poidoorinternal: 'door_poi_internal',
  logicgateand: 'logic_and',
  poicerestechunlock: 'research_unlock',
  poidlc4techunlock: 'research_unlock_dino',
  poidlc5techunlock: 'research_unlock_aquatic',
  gravitasdoor: 'gravitas_door_internal',
  storagenetworkorderproductioncenter: 'storagenetwork_orderproductioncenter',
}

// LogicGateAND is exported by the game with a specialized config that is not
// present in the current generated Config.cs table. Keep its real footprint
// here so even-width visualizer offsets and occupied-cell masking stay aligned.
const BUILDING_DEFINITION_OVERRIDES: Record<string, OniBuildingDefinition> = {
  logicgateand: {
    id: 'LogicGateAND',
    width: 2,
    height: 2,
    animation: 'logic_and_kanim',
    defaultAnim: 'off',
    sceneLayer: 'LogicGates',
    foregroundLayer: 'BuildingFront',
    objectLayer: 'LogicGate',
    source: 'LogicGateANDConfig.cs',
  },
}

function oniBuildingDefinitionForSaveTag(tag: string) {
  const key = tag.trim().toLowerCase()
  const alias = BUILDING_TAG_ALIASES[key]
  return BUILDING_DEFINITION_OVERRIDES[key] ?? oniBuildingDefinitionForTag(key) ?? (alias ? oniBuildingDefinitionForAnimation(alias) : undefined)
}

function buildingTextureLookupKeys(tag: string): string[] {
  const key = tag.trim().toLowerCase()
  const alias = BUILDING_TAG_ALIASES[key]
  const definition = oniBuildingDefinitionForSaveTag(tag)
  const animation = definition?.animation.replace(/_kanim$/i, '').toLowerCase()
  const prefabKey = `${key}__prefab`
  const definitionPrefabKey = definition ? `${definition.id.toLowerCase()}__prefab` : undefined
  return [...new Set([prefabKey, definitionPrefabKey, key, alias, definition?.id.toLowerCase(), animation].filter((candidate): candidate is string => Boolean(candidate)))]
}

function buildingTextureForTag(tag: string, generated: Record<string, BuildingTextureDefinition> = {}): BuildingTextureDefinition | undefined {
  const keys = buildingTextureLookupKeys(tag)
  // Prefer the full KAnim render even when a legacy UI entry exists for the
  // prefab key. Without this ordering, aliases such as WarpConduitSender
  // silently kept using the one-cell thumbnail.
  const definition = keys.map((key) => generated[key]).find((candidate): candidate is BuildingTextureDefinition => candidate !== undefined)
    ?? keys.map((key) => BUILDING_TEXTURES[key]).find((definition): definition is BuildingTextureDefinition => definition !== undefined)
  return definition
}

function doorControlTextureForInstance(tag: string, instance: SavedObjectInstance, generated: Record<string, BuildingTextureDefinition>): BuildingTextureDefinition | undefined {
  const definition = oniBuildingDefinitionForSaveTag(tag)
  const animation = definition?.animation.replace(/_kanim$/i, '').toLowerCase()
  const door = instance.components.find((component) => component.typeName.split(/[.+]/).pop()?.toLowerCase() === 'door')
  if (!animation || !door) return undefined
  const controlState = door?.value?.members.find((member) => member.name === 'controlState')?.value
  // Door.ControlState in the game source: Auto = 0, Opened = 1, Locked = 2.
  // Auto starts in Door.Controller.closed, matching POIDoorInternal's explicit
  // initialAnim = "closed" configuration.
  const state = controlState?.kind === 'enum' || controlState?.kind === 'int32' || controlState?.kind === 'uint32'
    ? controlState.v === 1 ? 'open' : controlState.v === 2 ? 'locked' : 'closed'
    : 'closed'
  return generated[`${animation}__${state}`]
    ?? (state === 'locked' ? generated[`${animation}__closed`] : undefined)
}

function buildingTextureForInstance(tag: string, instance: SavedObjectInstance, generated: Record<string, BuildingTextureDefinition> = {}): BuildingTextureDefinition | undefined {
  return doorControlTextureForInstance(tag, instance, generated) ?? buildingTextureForTag(tag, generated)
}

function hasSimpleComponent(instance: SavedObjectInstance, typeName: string): boolean {
  const expected = typeName.toLowerCase()
  return instance.components.some((item) => {
    const simpleName = item.typeName.split(/[.+]/).pop()?.toLowerCase()
    return simpleName === expected
  })
}

function oniLightIsEnabled(instance: SavedObjectInstance, requiresActive: boolean): boolean {
  if (!requiresActive) return true
  const stateController = component(instance, 'StateMachineController')
  const lightControllerState = oniStateMachineState(stateController?.details, 'LightController')
  if (lightControllerState) return /(?:^|\.)on$/i.test(lightControllerState)
  // LightController.on calls Operational.SetActive(true). Operational's current
  // boolean is not serialized, but OnSerializing flushes the current interval
  // into activeTime/inactiveTime, so a positive current-cycle active interval is
  // the source-backed state available in a save file.
  const operational = component(instance, 'Operational')?.value
  return (scalarNumber(member(operational, 'activeTime')?.value) ?? 0) > 0
}

function isGeyserInstance(groupTag: string, instance: SavedObjectInstance, texture: GeyserTextureDefinition | undefined): boolean {
  return Boolean(texture)
    || /geyser|fountain/i.test(groupTag)
    || instance.components.some((item) => /(?:^|[.+])geyser(?:$|[.+])/i.test(item.typeName))
}

function instanceOrientation(instance: SavedObjectInstance): number {
  const component = instance.components.find((item) => item.typeName.split(/[.+]/).pop()?.toLowerCase() === 'rotatable')
  const member = component?.value?.members.find((item) => item.name === 'orientation')
  return member?.value.kind === 'enum' ? member.value.v : 0
}

function minionAccessoryGuids(instance: SavedObjectInstance): string[] {
  const accessorizer = component(instance, 'Accessorizer')?.value
  const accessories = member(accessorizer, 'accessories')?.value
  if (accessories?.kind !== 'list') return []
  return accessories.items.flatMap((item) => {
    if (item.kind !== 'object') return []
    const guidReference = member(item, 'guid')?.value
    if (guidReference?.kind !== 'object') return []
    const guid = member(guidReference, 'Guid')?.value
    return guid?.kind === 'string' && guid.v ? [guid.v] : []
  })
}

function numericValue(value: Value | undefined): number | undefined {
  return value?.kind === 'sbyte' || value?.kind === 'byte' || value?.kind === 'int16' || value?.kind === 'uint16'
    || value?.kind === 'int32' || value?.kind === 'uint32' || value?.kind === 'enum' ? value.v : undefined
}

function minionWearableAnimNames(instance: SavedObjectInstance): string[] {
  const wearables = member(component(instance, 'WearableAccessorizer')?.value, 'wearables')?.value
  if (wearables?.kind !== 'dict') return []
  let highestType = -1
  let selected: Value | undefined
  wearables.keys.forEach((key, index) => {
    const type = numericValue(key)
    if (type !== undefined && type > highestType) {
      highestType = type
      selected = wearables.values[index]
    }
  })
  if (selected?.kind !== 'object') return []
  const animNames = member(selected, 'animNames')?.value
  return animNames?.kind === 'list' ? animNames.items.flatMap((item) => item.kind === 'string' && item.v ? [item.v] : []) : []
}

function saveMinionWearableAnimNames(save: ParsedSave): string[] {
  const minions = save.manager?.groups.find((group) => group.tag === 'Minion')?.instances ?? []
  return [...new Set(minions.flatMap(minionWearableAnimNames))].sort()
}

function minionFacesLeft(instance: SavedObjectInstance): boolean {
  const value = member(component(instance, 'Facing')?.value, 'facingLeft')?.value
  return value?.kind === 'boolean' ? value.v : false
}

function rotatableVisualizerForTag(tag: string): RotatableVisualizer | undefined {
  const definition = oniBuildingDefinitionForSaveTag(tag)
  if (!definition) return undefined
  // BuildingComplete.OnPrefabInit applies BuildingDef.GetVisualizerOffset()
  // to every building. Rotatable.SetSize() applies the same horizontal rule:
  // an even-width footprint is visualized half a cell to the right of its
  // placement origin. The old tag-only BunkerDoor exception left every other
  // even-width building half a cell too far left.
  const evenWidth = definition.width % 2 === 0
  return {
    pivotXCells: evenWidth ? -.5 : 0,
    pivotYCells: .5,
    offsetXCells: evenWidth ? .5 : 0,
    offsetYCells: 0,
  }
}

type MapObjectRenderEntry = {
  group: SavedObjectGroup
  instance: SavedObjectInstance
  order: number
}

const TERRAIN_SCENE_LAYER = ONI_SCENE_LAYER_ORDER.Ground

function utilitySceneLayer(family: UtilityFamily): number {
  switch (family) {
    case 'gas': return ONI_SCENE_LAYER_ORDER.GasConduits
    case 'liquid': return ONI_SCENE_LAYER_ORDER.LiquidConduits
    case 'solid': return ONI_SCENE_LAYER_ORDER.SolidConduits
    case 'electrical': return ONI_SCENE_LAYER_ORDER.Wires
    case 'logic': return ONI_SCENE_LAYER_ORDER.LogicWires
  }
}

function mapObjectSceneLayer(group: SavedObjectGroup): number {
  if (group.tag === 'Minion') return ONI_SCENE_LAYER_ORDER.Creatures
  if (blockTileTextureForTag(group.tag)) return ONI_SCENE_LAYER_ORDER.TileMain
  const utilityFamily = utilityFamilyForTag(group.tag)
  if (utilityFamily) return utilitySceneLayer(utilityFamily)
  const definition = oniBuildingDefinitionForSaveTag(group.tag)
  return ONI_SCENE_LAYER_ORDER[definition?.sceneLayer ?? ''] ?? ONI_SCENE_LAYER_ORDER.Building
}

/**
 * Unity renders the game's orthographic scene from larger Z toward smaller Z.
 * Grid.GetLayerZ makes higher/front SceneLayer values increasingly negative,
 * so canvas must paint saved objects in descending Z order.
 */
function mapObjectsInRenderOrder(save: ParsedSave): MapObjectRenderEntry[] {
  const entries: MapObjectRenderEntry[] = []
  let order = 0
  for (const group of save.manager?.groups ?? []) {
    for (const instance of group.instances) entries.push({ group, instance, order: order++ })
  }
  return entries.sort((left, right) => {
    const layerDelta = mapObjectSceneLayer(left.group) - mapObjectSceneLayer(right.group)
    if (layerDelta) return layerDelta
    const leftZ = Number.isFinite(left.instance.position.z) ? left.instance.position.z : 0
    const rightZ = Number.isFinite(right.instance.position.z) ? right.instance.position.z : 0
    return rightZ - leftZ || left.order - right.order
  })
}

function blockTileCellsByGroup(save: ParsedSave): Map<SavedObjectGroup, Set<string>> {
  const result = new Map<SavedObjectGroup, Set<string>>()
  for (const group of save.manager?.groups ?? []) {
    if (!blockTileTextureForTag(group.tag)) continue
    result.set(group, new Set(group.instances.map((item) => blockTileCellKey(Math.floor(item.position.x), Math.floor(item.position.y)))))
  }
  return result
}

function rotatedBuildingOffset(x: number, y: number, orientation: number): { x: number; y: number } {
  // Rotatable.GetRotatedCellOffset() from the game. Keep this separate from
  // the canvas transform: these offsets describe occupied simulation cells.
  switch (orientation) {
    case 1: return { x: y, y: -x }
    case 2: return { x: -x, y: -y }
    case 3: return { x: -y, y: x }
    case 5: return { x: -x, y }
    case 6: return { x, y: -y }
    default: return { x, y }
  }
}

function buildingPlacementCells(instance: SavedObjectInstance, footprint: ReturnType<typeof oniBuildingDefinitionForSaveTag>): Array<{ x: number; y: number }> {
  if (!footprint) return []
  // BuildingDef.GenerateOffsets(width, height):
  //   firstX = width / 2 - width + 1
  // then every cell is OffsetCell(placementCell, rotatedOffset). Save
  // transforms are Grid.CellToPosCBC(placementCell), so flooring them gives
  // that exact placement cell back.
  const startX = Math.floor(footprint.width / 2) - footprint.width + 1
  const baseX = Math.floor(instance.position.x)
  const baseY = Math.floor(instance.position.y)
  const orientation = instanceOrientation(instance)
  const cells: Array<{ x: number; y: number }> = []
  for (let localY = 0; localY < footprint.height; localY++) {
    for (let localX = 0; localX < footprint.width; localX++) {
      const offset = rotatedBuildingOffset(startX + localX, localY, orientation)
      cells.push({ x: baseX + offset.x, y: baseY + offset.y })
    }
  }
  return cells
}

function overlaysNaturalTerrain(group: SavedObjectGroup, instance: SavedObjectInstance): boolean {
  // BuildingTemplates.CreateLadderDef() assigns ladders to LadderTile rather
  // than the building tile layer. In-game they remain visible on top of a
  // natural solid cell; they do not excavate that cell. Check the component
  // first (covers ladder variants), with the saved prefab tags as a fallback
  // for older saves that omit Ladder's empty serialized state.
  const tag = group.tag.trim().toLowerCase()
  return hasSimpleComponent(instance, 'Ladder')
    || tag === 'ladder'
    || tag === 'ladderfast'
    || tag === 'firepole'
    || tag === 'ladderbed'
}

function terrainMaskedCellsByBuilding(save: ParsedSave): Set<string> {
  const cells = new Set<string>()
  for (const group of save.manager?.groups ?? []) {
    const footprint = oniBuildingDefinitionForSaveTag(group.tag)
    if (!footprint) continue
    for (const instance of group.instances) {
      if (!hasSimpleComponent(instance, 'BuildingComplete')) continue
      if (overlaysNaturalTerrain(group, instance)) continue
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
      const x = Math.floor(instance.position.x)
      const y = Math.floor(instance.position.y)
      const key = blockTileCellKey(x, y)
      const next: UtilityCellRecord = {
        tag: group.tag,
        bits: utilityConnectionBits(instance),
        isPhysical: hasSimpleComponent(instance, 'BuildingComplete'),
      }
      const previous = familyCells.get(key)
      const physicalBits = next.isPhysical && next.bits !== undefined
        ? ((previous?.physicalBits ?? 0) | next.bits)
        : previous?.physicalBits
      const candidate = physicalBits === undefined ? next : { ...next, physicalBits }
      // A completed object occupies the physical network layer; an unfinished
      // replacement is only a visual node. Prefer the physical record when a
      // save contains both at the same cell.
      if (!previous
        || (next.isPhysical && !previous.isPhysical)
        || (next.bits !== undefined && previous.bits === undefined)) {
        familyCells.set(key, candidate)
      } else if (physicalBits !== previous.physicalBits) {
        familyCells.set(key, { ...previous, physicalBits })
      }
    }
    cells.set(family, familyCells)
  }
  return cells
}

function utilityMapLayerForFamily(family: UtilityFamily): Extract<MapLayer, 'power' | 'plumbing' | 'ventilation' | 'automation' | 'shipment'> {
  switch (family) {
    case 'electrical': return 'power'
    case 'liquid': return 'plumbing'
    case 'gas': return 'ventilation'
    case 'logic': return 'automation'
    case 'solid': return 'shipment'
  }
}

function mapEntityLayerIsVisible(visibleLayers: MapLayerVisibility, isGeyser: boolean, isCreature: boolean, utilityFamily: UtilityFamily | undefined): boolean {
  if (isGeyser) return visibleLayers.geysers
  if (isCreature) return visibleLayers.entities
  if (utilityFamily) return visibleLayers[utilityMapLayerForFamily(utilityFamily)]
  return visibleLayers.buildings
}

function mapEntityLayersAreVisible(visibleLayers: MapLayerVisibility): boolean {
  return visibleLayers.entities || visibleLayers.buildings || visibleLayers.geysers || visibleLayers.power || visibleLayers.plumbing
    || visibleLayers.ventilation || visibleLayers.automation || visibleLayers.shipment
}

const MAP_LAYERS: Array<{ id: MapLayer; label: string; detail: string }> = [
  { id: 'grid', label: '网格', detail: '编辑器辅助' },
  { id: 'biome', label: '群落色', detail: 'WorldZone.Tint' },
  { id: 'minions', label: '复制人', detail: 'SceneLayer.Creatures' },
  { id: 'entities', label: '生物 / 实体', detail: 'IEntityConfig KAnim' },
  { id: 'buildings', label: '建筑', detail: 'SceneLayer.Building' },
  { id: 'geysers', label: '喷泉', detail: 'SceneLayer.Geyser' },
  { id: 'power', label: '电力', detail: 'SceneLayer.Wires' },
  { id: 'plumbing', label: '液体管道', detail: 'SceneLayer.LiquidConduits' },
  { id: 'ventilation', label: '气体管道', detail: 'SceneLayer.GasConduits' },
  { id: 'automation', label: '自动化线', detail: 'SceneLayer.LogicWires' },
  { id: 'shipment', label: '运输管道', detail: 'SceneLayer.SolidConduits' },
  { id: 'gas', label: '气体', detail: 'SceneLayer.Gas' },
  { id: 'liquid', label: '液体', detail: 'SceneLayer.Liquid' },
  { id: 'ground', label: '地面 / 土块', detail: 'SceneLayer.Ground' },
  { id: 'backwall', label: '后墙', detail: 'SceneLayer.Backwall' },
]
const MAP_OVERLAYS: Array<{ id: MapOverlay; label: string }> = [
  { id: 'none', label: '无' },
  { id: 'temperature', label: '温度' },
  { id: 'mass', label: '质量' },
  { id: 'disease', label: '疾病' },
  { id: 'visibility', label: '可见性' },
  { id: 'spawnable', label: '可生成' },
  { id: 'damage', label: '损坏' },
]
const DEFAULT_MAP_LAYER_VISIBILITY: MapLayerVisibility = {
  grid: false,
  biome: true,
  minions: true,
  entities: true,
  buildings: true,
  geysers: true,
  power: true,
  plumbing: true,
  ventilation: true,
  automation: true,
  shipment: true,
  // LightingSettings.ShowGas is enabled in the game scene, so GasTest is part
  // of the normal map view rather than an opt-in analysis overlay.
  gas: true,
  liquid: true,
  ground: true,
  backwall: false,
}
type SaveFileHandle = {
  getFile: () => Promise<File>
  createWritable: () => Promise<{ write: (data: Uint8Array) => Promise<void>; close: () => Promise<void> }>
}
type SavePickerOptions = {
  types: Array<{ description: string; accept: Record<string, string[]> }>
  multiple: boolean
}
type SavePickerWindow = Window & {
  showOpenFilePicker?: (options: SavePickerOptions) => Promise<SaveFileHandle[]>
}
type ImportedYamlTemplate = { path: string; template: YamlTemplate }
type DroppedFile = { file: File; path: string }
type BrowserFileEntry = {
  isFile: boolean
  isDirectory: boolean
  name: string
  file?: (success: (file: File) => void, error?: (cause: unknown) => void) => void
  createReader?: () => BrowserDirectoryReader
}
type BrowserDirectoryReader = { readEntries: (success: (entries: BrowserFileEntry[]) => void, error?: (cause: unknown) => void) => void }
type DataTransferItemWithEntry = { webkitGetAsEntry?: () => BrowserFileEntry | null }

const savePickerOptions: SavePickerOptions = {
  types: [{ description: 'Oxygen Not Included save', accept: { 'application/octet-stream': ['.sav'] } }],
  multiple: false,
}

const documentPickerOptions: SavePickerOptions = {
  types: [{ description: 'Oxygen Not Included save or YAML template', accept: { 'application/octet-stream': ['.sav'], 'text/yaml': ['.yaml', '.yml'] } }],
  multiple: false,
}

function readDroppedFileEntry(entry: BrowserFileEntry, parentPath: string): Promise<DroppedFile[]> {
  if (entry.isFile && entry.file) {
    return new Promise((resolve, reject) => {
      entry.file?.((file) => resolve([{ file, path: `${parentPath}${entry.name}` }]), reject)
    })
  }
  if (!entry.isDirectory || !entry.createReader) return Promise.resolve([])
  const reader = entry.createReader()
  const readAllEntries = async (): Promise<BrowserFileEntry[]> => {
    const entries: BrowserFileEntry[] = []
    while (true) {
      const batch = await new Promise<BrowserFileEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
      if (batch.length === 0) return entries
      entries.push(...batch)
    }
  }
  return readAllEntries().then(async (entries) => {
    const children = await Promise.all(entries.map((child) => readDroppedFileEntry(child, `${parentPath}${entry.name}/`)))
    return children.flat()
  })
}

async function droppedFilesFromTransfer(dataTransfer: DataTransfer): Promise<DroppedFile[]> {
  const entries = Array.from(dataTransfer.items)
    .map((item) => (item as unknown as DataTransferItemWithEntry).webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is BrowserFileEntry => entry !== null)
  if (entries.length > 0) {
    const groups = await Promise.all(entries.map((entry) => readDroppedFileEntry(entry, '')))
    return groups.flat()
  }
  return Array.from(dataTransfer.files).map((file) => ({
    file,
    path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }))
}

const navItems: Array<{ id: View; label: string }> = [
  { id: 'overview', label: '总览' },
  { id: 'map', label: '地图' },
  { id: 'dupes', label: '复制人' },
  { id: 'objects', label: '对象' },
]

function parseSaveOffThread(bytes: Uint8Array): Promise<ParsedSave> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./lib/saveWorker.ts', import.meta.url), { type: 'module' })
    const finish = () => worker.terminate()
    worker.onmessage = (event: MessageEvent<{ ok: boolean; save?: ParsedSave; error?: string }>) => {
      finish()
      if (event.data.ok && event.data.save) resolve(event.data.save)
      else reject(new Error(event.data.error || '无法解析这个存档文件。'))
    }
    worker.onerror = (event) => {
      finish()
      reject(new Error(event.message || '存档后台解析线程失败。'))
    }
    worker.postMessage({ buffer: bytes.buffer }, [bytes.buffer])
  })
}

function App() {
  const [save, setSave] = useState<ParsedSave | null>(null)
  const [yamlTemplate, setYamlTemplate] = useState<YamlTemplate | null>(null)
  const [yamlDocuments, setYamlDocuments] = useState<ImportedYamlTemplate[]>([])
  const [selectedYamlPath, setSelectedYamlPath] = useState('')
  const [fileName, setFileName] = useState('')
  const [view, setView] = useState<View>('overview')
  const [mapViewport, setMapViewport] = useState<MapViewport>(DEFAULT_MAP_VIEWPORT)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState('Minion')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [sourceHandle, setSourceHandle] = useState<SaveFileHandle | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const loadYamlSources = useCallback(async (sources: DroppedFile[]) => {
    const yamlSources = sources.filter(({ file }) => /\.ya?ml$/i.test(file.name))
    if (yamlSources.length === 0) {
      setError('拖入的内容中没有 YAML 文件。')
      return
    }
    setLoading(true)
    setError('')
    try {
      const results = await Promise.all(yamlSources.map(async ({ file, path }) => {
        try {
          return { path, template: parseYamlTemplate(await file.text(), path) }
        } catch {
          return null
        }
      }))
      const parsed = results.filter((item): item is ImportedYamlTemplate => item !== null)
      if (parsed.length === 0) throw new Error('无法解析拖入的 YAML 文件。')
      const first = parsed[0]
      setYamlDocuments(parsed)
      setSelectedYamlPath(first.path)
      setYamlTemplate(first.template)
      setSave(null)
      setFileName(parsed.length === 1 ? first.path : `${first.path.split('/')[0]} · ${parsed.length} 个 YAML`)
      setSourceHandle(null)
      setDirty(false)
      setMapViewport(DEFAULT_MAP_VIEWPORT)
      if (parsed.length < yamlSources.length) setError(`有 ${yamlSources.length - parsed.length} 个 YAML 无法解析，已跳过。`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法解析这个 YAML 文件。')
      setYamlDocuments([])
      setSelectedYamlPath('')
      setYamlTemplate(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadYamlFile = useCallback(async (file: File) => {
    if (!/\.ya?ml$/i.test(file.name)) {
      setError('请选择 YAML 模板文件。')
      return
    }
    await loadYamlSources([{ file, path: file.name }])
  }, [loadYamlSources])

  const loadFile = useCallback(async (file: File, handle: SaveFileHandle | null = null) => {
    if (!file.name.toLowerCase().endsWith('.sav')) {
      setError('请选择 Oxygen Not Included 的 .sav 存档文件。')
      return
    }
    setLoading(true)
    setError('')
    try {
      const parsed = await parseSaveOffThread(new Uint8Array(await file.arrayBuffer()))
      setSave(parsed)
      setYamlTemplate(null)
      setYamlDocuments([])
      setSelectedYamlPath('')
      setFileName(file.name)
      setSourceHandle(handle)
      setDirty(false)
      setView('overview')
      setMapViewport(DEFAULT_MAP_VIEWPORT)
      setSelectedGroup('Minion')
      setSelectedIndex(0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法解析这个存档文件。')
      setSave(null)
      setYamlTemplate(null)
      setYamlDocuments([])
      setSelectedYamlPath('')
    } finally {
      setLoading(false)
    }
  }, [])

  // The C# desktop shell sends the selected save through this small bridge.
  // Keeping the same File-based path as the browser UI means the desktop
  // build uses the exact same binary parser, WebGL layers and edit history.
  useEffect(() => {
    const onHostSave = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string; data?: string }>).detail
      if (!detail?.data) return
      try {
        const encoded = atob(detail.data)
        const bytes = new Uint8Array(encoded.length)
        for (let index = 0; index < encoded.length; index += 1) bytes[index] = encoded.charCodeAt(index)
        void loadFile(new File([bytes], detail.name || 'save.sav', { type: 'application/octet-stream' }))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '桌面外壳传入的存档无法读取。')
      }
    }
    window.addEventListener('oni-host-open-save', onHostSave)
    return () => window.removeEventListener('oni-host-open-save', onHostSave)
  }, [loadFile])

  useEffect(() => {
    if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('fixture') !== '1') return
    let active = true
    void fetch('/__oni_fixture__').then(async (response) => {
      if (!response.ok) throw new Error(`本地视觉测试存档读取失败：HTTP ${response.status}`)
      const encodedName = response.headers.get('X-Fixture-Name')
      const name = encodedName ? decodeURIComponent(encodedName) : 'visual-fixture.sav'
      if (active) await loadFile(new File([await response.arrayBuffer()], name))
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : '本地视觉测试存档读取失败。') })
    return () => { active = false }
  }, [loadFile])

  const updateSave = useCallback((update: (current: ParsedSave) => void) => {
    setSave((current) => {
      if (!current) return current
      update(current)
      return { ...current }
    })
    setDirty(true)
  }, [])

  const returnHome = useCallback(() => {
    if (dirty && !window.confirm('当前有未导出的修改，确定返回主界面吗？')) return
    setSave(null)
    setYamlTemplate(null)
    setYamlDocuments([])
    setSelectedYamlPath('')
    setFileName('')
    setSourceHandle(null)
    setDirty(false)
    setError('')
    setView('overview')
    setMapViewport(DEFAULT_MAP_VIEWPORT)
  }, [dirty])

  const downloadSave = useCallback(() => {
    if (!save) return
    try {
      const bytes = buildSave(save)
      const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName.replace(/\.sav$/i, '') + '-edited.sav'
      link.click()
      URL.revokeObjectURL(url)
      setDirty(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '导出存档失败。')
    }
  }, [fileName, save])

  const openPicker = useCallback(async () => {
    const pickerWindow = window as SavePickerWindow
    if (!pickerWindow.showOpenFilePicker) {
      fileInput.current?.click()
      return
    }
    try {
      const [handle] = await pickerWindow.showOpenFilePicker(documentPickerOptions)
      if (handle) {
        const file = await handle.getFile()
        if (/\.ya?ml$/i.test(file.name)) await loadYamlFile(file)
        else await loadFile(file, handle)
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : '无法打开存档文件。')
    }
  }, [loadFile, loadYamlFile])

  const replaceSave = useCallback(async () => {
    if (!save) return
    let targetHandle = sourceHandle
    let targetName = fileName
    try {
      if (!targetHandle) {
        const pickerWindow = window as SavePickerWindow
        if (!pickerWindow.showOpenFilePicker) {
          setError('当前浏览器不支持直接替换原文件，请使用“导出”。')
          return
        }
        const [handle] = await pickerWindow.showOpenFilePicker(savePickerOptions)
        if (!handle) return
        const targetFile = await handle.getFile()
        if (!targetFile.name.toLowerCase().endsWith('.sav')) {
          setError('请选择 Oxygen Not Included 的 .sav 存档文件。')
          return
        }
        targetHandle = handle
        targetName = targetFile.name
      }
      if (!window.confirm(`确认将修改后的“${targetName}”直接写回原存档吗？\n原文件将被覆盖。`)) return
      const writable = await targetHandle.createWritable()
      await writable.write(buildSave(save))
      await writable.close()
      setSourceHandle(targetHandle)
      setFileName(targetName)
      setDirty(false)
      setError('')
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : '替换原存档失败。')
    }
  }, [fileName, save, sourceHandle])

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    void droppedFilesFromTransfer(event.dataTransfer).then((droppedFiles) => {
      const yamlFiles = droppedFiles.filter(({ file }) => /\.ya?ml$/i.test(file.name))
      if (yamlFiles.length > 0) void loadYamlSources(yamlFiles)
      else if (droppedFiles[0]) void loadFile(droppedFiles[0].file)
    })
  }

  const hasDocument = Boolean(save || yamlTemplate)

  return (
    <div className={`app-shell ${save ? `saved-shell view-${view}` : yamlTemplate ? 'template-shell' : 'landing-shell'}`}>
      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        accept=".sav,.yaml,.yml,application/octet-stream,text/yaml"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            if (/\.ya?ml$/i.test(file.name)) void loadYamlFile(file)
            else void loadFile(file)
          }
          event.target.value = ''
        }}
      />
      <header className="topbar">
        <div className={`topbar-pill ${hasDocument ? 'is-loaded' : 'is-landing'}`}>
          <button type="button" className={`brand-lockup brand-home ${hasDocument ? 'is-clickable' : ''}`} onClick={() => { if (hasDocument) returnHome() }} aria-label={hasDocument ? '返回主界面' : '缺氧存档编辑器'} title={hasDocument ? '返回主界面' : undefined}>
            <div className="brand-mark"><Archive size={16} strokeWidth={2.5} /></div>
            <div>
              <div className="brand-name">缺氧存档编辑器</div>
              <div className="brand-caption">ONI SAVE EDITOR</div>
            </div>
          </button>
          {save && (
            <nav className="topnav" aria-label="工作区">
              {navItems.map(({ id, label }) => (
                <button key={id} className={view === id ? 'active' : ''} type="button" onClick={() => setView(id)}>{label}</button>
              ))}
            </nav>
          )}
          <div className="topbar-actions">
            {save ? (
              <>
                <div className="file-chip" title={fileName}>
                  <span className="status-dot" />
                  <span>{fileName}</span>
                  {dirty && <span className="dirty-dot" title="有未导出的修改" />}
                </div>
                <button className="button button-quiet" type="button" onClick={openPicker} title="打开另一个存档">
                  <FileUp size={15} /> <span>打开</span>
                </button>
                <button className="button button-replace" type="button" onClick={replaceSave} title="直接覆盖原存档文件">
                  <Save size={15} /> <span>替换</span>
                </button>
                <button className="button button-primary" type="button" onClick={downloadSave} title="导出修改后的存档">
                  <Download size={15} /> <span>导出</span>
                </button>
              </>
            ) : yamlTemplate ? (
              <>
                <div className="file-chip" title={fileName}><span className="status-dot template-dot" /><span>{fileName}</span></div>
                <button className="button button-quiet" type="button" onClick={openPicker} title="打开另一个文件"><FileUp size={15} /> <span>打开</span></button>
              </>
            ) : (
              <button className="button button-primary" type="button" onClick={openPicker}>
                <Upload size={15} /> <span>打开文件</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <button type="button" className="icon-button" onClick={() => setError('')} title="关闭提示"><X size={16} /></button>
        </div>
      )}

      {!hasDocument ? (
        <EmptyState loading={loading} isDragging={isDragging} onPick={openPicker} onDrop={handleDrop} onDragChange={setIsDragging} />
      ) : yamlTemplate ? (
        <div className="workspace">
          <main className="main-content main-content-template">
            <YamlWorkspace template={yamlTemplate} fileName={fileName} documents={yamlDocuments} selectedPath={selectedYamlPath} onSelect={(path) => {
              const selected = yamlDocuments.find((document) => document.path === path)
              if (!selected) return
              setSelectedYamlPath(path)
              setYamlTemplate(selected.template)
            }} />
          </main>
        </div>
      ) : save ? (
        <div className="workspace">
          <main className={`main-content main-content-${view}`}>
            {view !== 'map' && <div className={`content-head content-head-${view}`}>
              <div>
                <div className="eyebrow">{view === 'overview' ? 'SAVE OVERVIEW' : view.toUpperCase()}</div>
                <h1>{navItems.find((item) => item.id === view)?.label}</h1>
              </div>
              <div className="head-meta"><span className="status-dot" />{dirty ? '待导出' : '已载入'}<ChevronRight size={14} />{fileName}</div>
            </div>}
            {view === 'overview' && <Overview save={save} onNavigate={setView} updateSave={updateSave} />}
            {view === 'map' && <MapView save={save} updateSave={updateSave} viewport={mapViewport} onViewportChange={setMapViewport} />}
            {view === 'dupes' && <DupesView save={save} updateSave={updateSave} onOpenObject={(index) => { setSelectedGroup('Minion'); setSelectedIndex(index); setView('objects') }} />}
            {view === 'objects' && <ObjectsView save={save} selectedGroup={selectedGroup} selectedIndex={selectedIndex} onSelect={(tag, index) => { setSelectedGroup(tag); setSelectedIndex(index) }} updateSave={updateSave} />}
          </main>
        </div>
      ) : null}
    </div>
  )
}

function EmptyState({ loading, isDragging, onPick, onDrop, onDragChange }: { loading: boolean; isDragging: boolean; onPick: () => void; onDrop: (event: React.DragEvent<HTMLDivElement>) => void; onDragChange: (value: boolean) => void }) {
  const [landingLanguage, setLandingLanguage] = useState<'zh' | 'en'>('zh')
  const english = landingLanguage === 'en'
  return (
    <div className={`empty-state ${isDragging ? 'is-dragging' : ''}`} lang={english ? 'en' : 'zh-CN'} onDrop={onDrop} onDragOver={(event) => { event.preventDefault(); onDragChange(true) }} onDragLeave={() => onDragChange(false)}>
      <ColonyBackdrop />
      <div className="landing-frame">
        <header className="landing-header">
          <div className="landing-brand">
            <span className="landing-brand-icon"><Archive size={20} strokeWidth={2.2} /></span>
            <span><strong>{english ? 'ONI Save Editor' : '缺氧存档编辑器'}</strong><small>{english ? 'COLONY DATA WORKSPACE' : 'ONI SAVE EDITOR'}</small></span>
          </div>
          <div className="landing-header-actions">
            <div className="landing-local"><span className="status-dot" />LOCAL WORKSPACE</div>
            <button className="landing-language" type="button" onClick={() => setLandingLanguage(english ? 'zh' : 'en')} aria-label={english ? '切换到中文' : 'Switch to English'} title={english ? '切换到中文' : 'Switch to English'}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.2 2.45 3.35 5.45 3.35 9S14.2 18.55 12 21c-2.2-2.45-3.35-5.45-3.35-9S9.8 5.45 12 3Z" /></svg>
              <span>{english ? '中' : 'EN'}</span>
            </button>
            <a className="landing-github" href="https://github.com/ChiYuKe/oni-save-editor" target="_blank" rel="noreferrer" aria-label="打开 GitHub 仓库" title="GitHub 仓库">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .7a11.3 11.3 0 0 0-3.57 22.02c.57.1.78-.25.78-.55v-2.19c-3.18.69-3.85-1.35-3.85-1.35-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.33.95.1-.74.4-1.25.73-1.54-2.54-.29-5.21-1.27-5.21-5.59 0-1.24.44-2.24 1.18-3.04-.12-.29-.51-1.45.11-3 0 0 .96-.31 3.11 1.16A10.8 10.8 0 0 1 12 6c.96 0 1.93.13 2.83.38 2.16-1.47 3.11-1.16 3.11-1.16.62 1.55.23 2.71.11 3 .74.8 1.18 1.8 1.18 3.04 0 4.33-2.68 5.29-5.23 5.57.41.35.78 1.05.78 2.12v3.22c0 .3.21.66.79.55A11.3 11.3 0 0 0 12 .7Z" /></svg>
            </a>
          </div>
        </header>

        <main className="landing-main">
          <section className="landing-copy">
            <div className="landing-eyebrow">COLONY DATA, CLEARLY PRESENTED</div>
            {english ? <h1>Make complex<br /><span>colony data</span><br />clear.</h1> : <h1>把复杂的<br /><span>殖民地数据</span><br />变得清晰。</h1>}
            <p>{english ? 'Open Oxygen Not Included saves and YAML templates, inspect the world visually, and safely edit duplicants and game objects.' : '读取《缺氧》存档与 YAML 模板，用可视化地图检查世界，并安全地编辑复制人和对象数据。'}</p>
            <div className="landing-features">
              <article><span><Layers3 size={20} /></span><div><strong>{english ? 'Visual map' : '地图可视化'}</strong><small>{english ? 'Restore the world by game layer' : '按游戏层级还原世界'}</small></div></article>
              <article><span><Users size={20} /></span><div><strong>{english ? 'Duplicant data' : '复制人数据'}</strong><small>{english ? 'Review and adjust attributes' : '集中查看与调整属性'}</small></div></article>
              <article><span><Boxes size={20} /></span><div><strong>{english ? 'Object editing' : '对象编辑'}</strong><small>{english ? 'Find save objects precisely' : '精确定位存档对象'}</small></div></article>
            </div>
          </section>

          <section className="landing-upload">
            <div className="upload-decoration" aria-hidden="true"><span /><span /><span /></div>
            <div className="upload-icon"><FileUp size={30} strokeWidth={1.8} /></div>
            <div className="upload-kicker">OPEN COLONY DATA</div>
            <h2>{isDragging ? (english ? 'Drop to open' : '松开即可载入') : (english ? 'Start with a save' : '从一个存档开始')}</h2>
            <p>{isDragging ? (english ? 'Your file is ready. Release to continue.' : '文件已准备好，松开鼠标继续') : (english ? 'Drop a save or YAML file here, or choose one from your device.' : '将存档或 YAML 文件拖到此处，也可以从本地选择。')}</p>
            <button className="button button-primary button-large" type="button" onClick={onPick} disabled={loading}>
              {loading ? <><span className="spinner" />{english ? 'Parsing...' : '解析中...'}</> : <><FileUp size={17} />{english ? 'Choose file' : '选择文件'}</>}
            </button>
            <div className="upload-formats"><span>.SAV</span><span>.YAML</span></div>
            <div className="upload-privacy"><Gauge size={14} /><span>{english ? 'Processed on this device. Nothing is uploaded.' : '数据只在当前设备处理，不会上传服务器'}</span></div>
          </section>
        </main>

        <footer className="landing-footer"><span>SIMULATION TOOLS / V1</span><span>{english ? 'DESIGNED FOR LOCAL WORKFLOWS' : '为本地工作流设计'}</span></footer>
      </div>
    </div>
  )
}

function ColonyBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 1440
    canvas.height = 820
    const context = canvas.getContext('2d')
    if (!context) return
    const rooms = [
      [94, 174, 290, 170], [450, 106, 190, 238], [798, 166, 372, 164],
      [182, 484, 330, 146], [590, 444, 254, 188], [950, 474, 210, 144],
    ] as const
    const horizontalPaths = [[66, 392, 1290], [182, 546, 512], [730, 632, 844]] as const
    const verticalPaths = [[390, 80, 700], [730, 56, 756], [880, 392, 710]] as const
    const nodes = [[198, 244], [540, 194], [1030, 236], [314, 546], [720, 540], [1055, 545]] as const
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0

    const draw = (time: number) => {
      context.fillStyle = '#242529'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.strokeStyle = '#303237'
      context.lineWidth = 1
      for (let x = 0; x < canvas.width; x += 48) {
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, canvas.height)
        context.stroke()
      }
      for (let y = 0; y < canvas.height; y += 48) {
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(canvas.width, y)
        context.stroke()
      }

      for (const [x, y, width, height] of rooms) {
        context.strokeStyle = '#55575c'
        context.lineWidth = 2
        context.strokeRect(x, y, width, height)
        context.strokeStyle = '#2c2e33'
        context.lineWidth = 1
        context.strokeRect(x + 10, y + 10, width - 20, height - 20)
      }

      context.strokeStyle = '#e23e43'
      context.lineWidth = 5
      for (const [x1, y, x2] of horizontalPaths) {
        context.beginPath()
        context.moveTo(x1, y)
        context.lineTo(x2, y)
        context.stroke()
      }
      for (const [x, y1, y2] of verticalPaths) {
        context.beginPath()
        context.moveTo(x, y1)
        context.lineTo(x, y2)
        context.stroke()
      }

      context.fillStyle = '#e23e43'
      for (const [x, y] of nodes) {
        context.beginPath()
        context.arc(x, y, 7, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#242529'
        context.beginPath()
        context.arc(x, y, 3, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#e23e43'
      }

      if (!reduceMotion) {
        const horizontalProgress = (time / 2600) % 1
        for (const [index, [x1, y, x2]] of horizontalPaths.entries()) {
          const x = x1 + ((horizontalProgress + index * .26) % 1) * (x2 - x1)
          context.fillStyle = '#fff4f2'
          context.beginPath()
          context.arc(x, y, 4, 0, Math.PI * 2)
          context.fill()
        }
        const verticalProgress = (time / 3200) % 1
        for (const [index, [x, y1, y2]] of verticalPaths.entries()) {
          const y = y1 + ((verticalProgress + index * .33) % 1) * (y2 - y1)
          context.fillStyle = '#fff4f2'
          context.beginPath()
          context.arc(x, y, 4, 0, Math.PI * 2)
          context.fill()
        }
        const scanX = ((time / 10000) % 1) * canvas.width
        context.strokeStyle = 'rgba(255, 244, 242, .2)'
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(scanX, 0)
        context.lineTo(scanX, canvas.height)
        context.stroke()
        frame = requestAnimationFrame(draw)
      }
    }

    draw(0)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <div className="hero-art"><canvas ref={canvasRef} aria-hidden="true" /></div>
}

function Overview({ save, onNavigate, updateSave }: { save: ParsedSave; onNavigate: (view: View) => void; updateSave: (update: (save: ParsedSave) => void) => void }) {
  const size = worldSize(save)
  const groups = save.manager?.groups ?? []
  const objectCount = groups.reduce((sum, group) => sum + group.instances.length, 0)
  const minions = groupByTag(save, 'Minion')?.instances.length ?? 0
  const cycle = scalarNumber(gameValue(save, 'GameClock', 'cycle'))
  const sandbox = gameValue(save, 'SaveGame', 'sandboxEnabled')
  const activeMods = member(save.saveFileRoot, 'active_mods')?.value
  const top = topGroups(save).slice(0, 7)

  return (
    <div className="view-stack">
      <div className="metric-grid">
        <Metric icon={<Gauge size={18} />} label="当前周期" value={formatNumber(cycle, 0)} note="GameClock" accent="teal" />
        <Metric icon={<Users size={18} />} label="复制人" value={String(minions)} note="Minion group" accent="blue" />
        <Metric icon={<Grid2x2 size={18} />} label="世界尺寸" value={`${size.width} × ${size.height}`} note="simulation grid" accent="amber" />
        <Metric icon={<Boxes size={18} />} label="对象实例" value={objectCount.toLocaleString()} note={`${groups.length} 个分组`} accent="red" />
      </div>
      <div className="split-grid overview-grid">
        <section className="surface quick-surface">
          <SectionHeading icon={<SlidersHorizontal size={16} />} title="快速设置" action="SaveGame" />
          <div className="settings-list">
            <InlineMember label="当前周期" value={gameValue(save, 'GameClock', 'cycle')} updateSave={updateSave} componentName="GameClock" memberName="cycle" />
            <InlineMember label="沙盒模式" value={sandbox} updateSave={updateSave} componentName="SaveGame" memberName="sandboxEnabled" />
            <InlineMember label="游戏速度" value={gameValue(save, 'SaveGame', 'speed')} updateSave={updateSave} componentName="SaveGame" memberName="speed" />
            <InlineMember label="时间倍率" value={gameValue(save, 'TimeOfDay', 'scale')} updateSave={updateSave} componentName="TimeOfDay" memberName="scale" />
          </div>
          <div className="surface-foot">修改会在导出时写回对应的 KSerialization 字段。</div>
        </section>
        <section className="surface file-surface">
          <SectionHeading icon={<Archive size={16} />} title="存档状态" action="HEADER" />
          <div className="info-table">
            <InfoRow label="压缩方式" value={save.header.compression === 1 ? 'zlib' : 'raw'} />
            <InfoRow label="模拟区" value={`${save.simSection?.bytes.length.toLocaleString() ?? 0} bytes`} />
            <InfoRow label="SaveManager" value={`${groups.length} groups`} />
            <InfoRow label="活动模组" value={activeMods?.kind === 'list' ? `${activeMods.items.length} mods` : scalarText(activeMods)} />
          </div>
        </section>
      </div>
      <section className="surface groups-surface">
        <SectionHeading icon={<Layers3 size={16} />} title="对象分布" action="TOP GROUPS" />
        <div className="group-bars">
          {top.map((group, index) => (
            <button key={group.tag} type="button" className="group-bar" onClick={() => onNavigate('objects')}>
              <span className="group-index">0{index + 1}</span>
              <span className="group-name">{group.tag}</span>
              <span className="bar-track"><span style={{ width: `${Math.max(3, (group.count / (top[0]?.count || 1)) * 100)}%` }} /></span>
              <strong>{group.count.toLocaleString()}</strong>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function MapView({ save, updateSave, viewport, onViewportChange }: { save: ParsedSave; updateSave: (update: (save: ParsedSave) => void) => void; viewport: MapViewport; onViewportChange: Dispatch<SetStateAction<MapViewport>> }) {
  const [visibleLayers, setVisibleLayers] = useState<MapLayerVisibility>(DEFAULT_MAP_LAYER_VISIBILITY)
  const [layersExpanded, setLayersExpanded] = useState(false)
  const [overlay, setOverlay] = useState<MapOverlay>('none')
  const [tool, setTool] = useState<MapTool>('inspect')
  const [brushSize, setBrushSize] = useState(1)
  const [lastCell, setLastCell] = useState<{ x: number; y: number } | null>(null)
  const [selection, setSelection] = useState<MapSelection | null>(null)
  const [selectedElement, setSelectedElement] = useState(0x0307)
  const undoStackRef = useRef<MapEdit[][]>([])
  const redoStackRef = useRef<MapEdit[][]>([])
  const elementProfilesRef = useRef(new Map<number, { properties: number; insulation: number } | undefined>())
  const strokeActiveRef = useRef(false)
  const pendingStrokeRef = useRef(new Map<string, MapCellUpdate>())
  const previewCellsRef = useRef(new Map<string, MapPreviewCell>())
  const previewFrameRef = useRef<number | null>(null)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [, refreshHistory] = useState(0)
  const size = worldSize(save)
  const sim = save.simData
  const selectedCell = sim && lastCell ? getWorldCell(sim, lastCell.x, lastCell.y) : undefined
  const overlayLabel = MAP_OVERLAYS.find((item) => item.id === overlay)?.label ?? '无'

  const toggleLayer = (layer: MapLayer) => {
    setVisibleLayers((current) => ({ ...current, [layer]: !current[layer] }))
  }

  const assignSimData = (current: ParsedSave, next: NonNullable<ParsedSave['simData']>) => {
    current.simData = next
    current.simSection!.bytes = next.bytes
    const streamed = member(current.saveFileRoot, 'streamed')?.value
    if (streamed?.kind !== 'dict') return
    const simIndex = streamed.keys.findIndex((key) => key.kind === 'string' && key.v === 'Sim')
    const streamedSim = simIndex >= 0 ? streamed.values[simIndex] : undefined
    if (streamedSim?.kind === 'raw-pod' && streamedSim.bytes.length === next.bytes.length) streamedSim.bytes = next.bytes
  }

  const commitCells = (updates: Array<{ x: number; y: number; patch: Partial<SimCell> }>) => {
    if (!sim || updates.length === 0) return
    const next = setWorldCells(sim, updates)
    if (!next) return
    const edits: MapEdit[] = []
    const seen = new Set<string>()
    updates.forEach(({ x, y }) => {
      const key = `${x}:${y}`
      if (seen.has(key)) return
      const before = getWorldCell(sim, x, y)
      const after = getWorldCell(next, x, y)
      if (before && after) edits.push({ x, y, before, after })
      seen.add(key)
    })
    if (edits.length > 0) {
      undoStackRef.current.push(edits)
      refreshHistory((value) => value + 1)
    }
    redoStackRef.current = []
    updateSave((current) => assignSimData(current, next))
  }

  const patchCell = (coordinates: { x: number; y: number } | null, patch: Partial<SimCell>) => {
    if (!coordinates) return
    commitCells([{ x: coordinates.x, y: coordinates.y, patch }])
  }

  const elementPatch = (hash: number, current?: SimCell): Partial<SimCell> => {
    const profile = sim
      ? (elementProfilesRef.current.has(hash)
        ? elementProfilesRef.current.get(hash)
        : (() => {
            const next = getSimElementProfile(sim, hash)
            elementProfilesRef.current.set(hash, next)
            return next
          })())
      : undefined
    if (hash === 0xbf75) return { elementHash: hash, properties: profile?.properties ?? 0x39, insulation: profile?.insulation ?? 0x2d, temperature: 0, mass: 0 }
    const defaults = defaultElementValues(hash)
    return {
      elementHash: hash,
      properties: profile?.properties ?? current?.properties ?? 0,
      insulation: profile?.insulation ?? current?.insulation ?? 0xff,
      temperature: current && current.temperature > 0 ? current.temperature : defaults.temperature,
      mass: current && current.mass > 0 ? current.mass : defaults.mass,
    }
  }

  const queueStrokeCells = (cells: MapCellUpdate[]) => {
    if (cells.length === 0) return
    cells.forEach((cell) => {
      pendingStrokeRef.current.set(`${cell.x}:${cell.y}`, cell)
      previewCellsRef.current.set(`${cell.x}:${cell.y}`, {
        x: cell.x,
        y: cell.y,
        elementHash: cell.patch.elementHash ?? 0xbf75,
      })
    })
    refreshPreview()
  }

  const refreshPreview = (immediate = false) => {
    if (immediate) {
      if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current)
      previewFrameRef.current = null
      setPreviewVersion((value) => value + 1)
      return
    }
    if (previewFrameRef.current !== null) return
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = null
      setPreviewVersion((value) => value + 1)
    })
  }

  useEffect(() => () => {
    if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (event.key !== '[' && event.key !== ']') return
      event.preventDefault()
      setBrushSize((current) => Math.max(1, Math.min(21, current + (event.key === ']' ? 2 : -2))))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const patchBrush = (x: number, y: number) => {
    if (!sim) return
    const radius = Math.floor(brushSize / 2)
    const cells: MapCellUpdate[] = []
    for (let offsetY = -radius; offsetY <= radius; offsetY++) {
      for (let offsetX = -radius; offsetX <= radius; offsetX++) {
        const cellX = x + offsetX
        const cellY = y + offsetY
        if (cellX < 0 || cellY < 0 || cellX >= size.width || cellY >= size.height) continue
        const current = getWorldCell(sim, cellX, cellY)
        cells.push({
          x: cellX,
          y: cellY,
          patch: tool === 'erase' ? elementPatch(0xbf75, current) : elementPatch(selectedElement, current),
        })
      }
    }
    if (!strokeActiveRef.current) {
      commitCells(cells)
      return
    }
    queueStrokeCells(cells)
  }

  const previewShape = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    if (!strokeActiveRef.current) return
    pendingStrokeRef.current.clear()
    previewCellsRef.current.clear()
    const points = tool === 'rectangle'
      ? rectangleCells(start, end)
      : lineCells(start, end, brushSize, size.width, size.height)
    queueStrokeCells(points.map(({ x, y }) => ({
      x,
      y,
      patch: tool === 'erase' ? elementPatch(0xbf75) : elementPatch(selectedElement),
    })))
  }

  const fillCell = (x: number, y: number) => {
    if (!sim) return
    const view = new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength)
    const start = readSimCell(sim, view, x + 1, y + 1)
    if (!start) return
    const nextElement = selectedElement
    if (start.elementHash === nextElement) return
    const visited = new Uint8Array(size.width * size.height)
    const queue: Array<{ x: number; y: number }> = [{ x, y }]
    const cells: MapCellUpdate[] = []
    let cursor = 0
    while (cursor < queue.length) {
      const current = queue[cursor++]
      if (current.x < 0 || current.y < 0 || current.x >= size.width || current.y >= size.height) continue
      const index = current.y * size.width + current.x
      if (visited[index]) continue
      visited[index] = 1
      const cell = readSimCell(sim, view, current.x + 1, current.y + 1)
      if (!cell || cell.elementHash !== start.elementHash) continue
      cells.push({ x: current.x, y: current.y, patch: elementPatch(nextElement, cell) })
      queue.push({ x: current.x - 1, y: current.y }, { x: current.x + 1, y: current.y }, { x: current.x, y: current.y - 1 }, { x: current.x, y: current.y + 1 })
    }
    commitCells(cells)
  }

  const handleCell = (x: number, y: number) => {
    if (tool === 'inspect' || tool === 'eyedropper') {
      const cell = sim ? getWorldCell(sim, x, y) : undefined
      setLastCell({ x, y })
      if (cell) setSelectedElement(cell.elementHash)
      return
    }
    if (tool === 'fill') {
      fillCell(x, y)
      return
    }
    patchBrush(x, y)
  }

  const beginStroke = () => {
    strokeActiveRef.current = true
    pendingStrokeRef.current.clear()
    previewCellsRef.current.clear()
    refreshPreview(true)
  }

  const endStroke = () => {
    if (!strokeActiveRef.current) return
    strokeActiveRef.current = false
    const updates = [...pendingStrokeRef.current.values()]
    pendingStrokeRef.current.clear()
    previewCellsRef.current.clear()
    refreshPreview(true)
    if (updates.length > 0) commitCells(updates)
  }

  const applyHistory = (edits: MapEdit[], direction: 'undo' | 'redo') => {
    const updates = edits.map((edit) => ({ x: edit.x, y: edit.y, patch: direction === 'undo' ? edit.before : edit.after }))
    const next = sim ? setWorldCells(sim, updates) : undefined
    if (!next) return
    updateSave((current) => assignSimData(current, next))
  }

  const undo = () => {
    const edits = undoStackRef.current.pop()
    if (!edits) return
    redoStackRef.current.push(edits)
    applyHistory(edits, 'undo')
  }

  const redo = () => {
    const edits = redoStackRef.current.pop()
    if (!edits) return
    undoStackRef.current.push(edits)
    applyHistory(edits, 'redo')
  }

  const selectedElementList = elementOptions(selectedCell?.elementHash ?? selectedElement)
  const selectionBounds = selection ? normalizedSelection(selection) : undefined

  return (
    <div className="map-workbench">
      <aside className="map-tool-rail">
        <div className="tool-rail-title">TOOLS</div>
        <div className="tool-rail-buttons">
          <button type="button" className={tool === 'inspect' ? 'selected' : ''} onClick={() => setTool('inspect')} title="选择并查看单元"><Search size={19} /><span>选择</span></button>
          <button type="button" className={tool === 'move' ? 'selected' : ''} onClick={() => setTool('move')} title="移动地图视图"><Hand size={19} /><span>移动</span></button>
          <button type="button" className={tool === 'paint' ? 'selected' : ''} onClick={() => setTool('paint')} disabled={!sim} title="连续涂抹所选元素"><Paintbrush size={19} /><span>画笔</span></button>
          <button type="button" className={tool === 'erase' ? 'selected' : ''} onClick={() => setTool('erase')} disabled={!sim} title="连续擦除单元内容"><Eraser size={19} /><span>橡皮</span></button>
          <button type="button" className={tool === 'eyedropper' ? 'selected' : ''} onClick={() => setTool('eyedropper')} disabled={!sim} title="吸取地图中的元素"><Pipette size={19} /><span>吸管</span></button>
          <button type="button" className={tool === 'fill' ? 'selected' : ''} onClick={() => setTool('fill')} disabled={!sim} title="填充相连的同类区域"><PaintBucket size={19} /><span>油漆桶</span></button>
          <button type="button" className={tool === 'rectangle' ? 'selected' : ''} onClick={() => setTool('rectangle')} disabled={!sim} title="绘制填充矩形"><Square size={19} /><span>矩形</span></button>
          <button type="button" className={tool === 'line' ? 'selected' : ''} onClick={() => setTool('line')} disabled={!sim} title="绘制直线"><Minus size={19} /><span>直线</span></button>
        </div>
        <div className="tool-rail-divider" />
        <div className="tool-rail-bottom"><span className="status-dot" /><span>{size.width} × {size.height}</span><small>{sim ? `SIM v${sim.version}` : '无模拟区'}</small></div>
      </aside>
      <section className="map-center-panel">
        <div className="map-center-toolbar">
          <div className="toolbar-group map-overlay-control"><span className="toolbar-label">分析覆盖</span><select value={overlay} onChange={(event) => setOverlay(event.target.value as MapOverlay)}>
            {MAP_OVERLAYS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></div>
          <div className="toolbar-spacer" />
          <div className="map-readout"><span className="status-dot" />{size.width} × {size.height}<span className="muted">{sim ? `SIM v${sim.version}` : '无模拟区'}</span></div>
        </div>
        <div className="map-canvas-panel">
          <section className={`map-layer-settings map-layer-floating ${layersExpanded ? 'is-expanded' : 'is-collapsed'}`}>
            <button type="button" className="map-layer-toggle" aria-label={layersExpanded ? '收起图层' : '展开图层'} title={layersExpanded ? '收起图层' : '展开图层'} aria-expanded={layersExpanded} onClick={() => setLayersExpanded((expanded) => !expanded)}>
              <span className="map-layer-toggle-expanded">
                <span className="map-layer-toggle-main"><ChevronRight className="map-layer-toggle-chevron" size={15} /><span className="section-icon"><Layers3 size={16} /></span><strong>图层</strong></span>
                <span className="map-layer-toggle-meta"><span>{Object.values(visibleLayers).filter(Boolean).length}/{MAP_LAYERS.length}</span></span>
              </span>
              <Eye className="map-layer-collapsed-eye" size={16} aria-hidden="true" />
            </button>
            <div className="map-layer-stack" aria-hidden={!layersExpanded}>
              <div className="map-layer-stack-inner">
                {MAP_LAYERS.map((item) => <button key={item.id} type="button" tabIndex={layersExpanded ? 0 : -1} className={`map-layer-row ${visibleLayers[item.id] ? 'visible' : 'hidden'}`} aria-pressed={visibleLayers[item.id]} onClick={() => toggleLayer(item.id)} title={`${visibleLayers[item.id] ? '隐藏' : '显示'}${item.label}`}>
                  {visibleLayers[item.id] ? <Eye size={15} /> : <EyeOff size={15} />}
                  <span className={`layer-swatch layer-swatch-${item.id}`} />
                  <span className="map-layer-name">{item.label}</span>
                  <small>{item.detail}</small>
                </button>)}
              </div>
            </div>
          </section>
          <MapCanvas save={save} visibleLayers={visibleLayers} overlay={overlay} tool={tool} brushSize={brushSize} viewport={viewport} onViewportChange={onViewportChange} selectedCell={lastCell} selection={selection} previewCells={previewCellsRef.current} previewVersion={previewVersion} onCell={handleCell} onSelectionChange={(next) => { setSelection(next); if (next) setLastCell(null) }} onShape={previewShape} onStrokeStart={beginStroke} onStrokeEnd={endStroke} />
          <div className="map-legend"><span><i className="legend-visible" />独立图层</span><span><i className="legend-entity" />{overlay === 'none' ? '无分析覆盖' : `${overlayLabel}覆盖`}</span><span><i className="legend-damage" />选中单元</span><span className="legend-help">SIM 网格含四周边界层</span></div>
        </div>
      </section>
      <aside className="map-parameter-rail map-info">
        <section className="map-tool-settings">
            <SectionHeading icon={<SlidersHorizontal size={16} />} title="工具参数" action={tool.toUpperCase()} />
            <label className="rail-control"><span>元素</span><select value={selectedElement} onChange={(event) => setSelectedElement(Number(event.target.value))}>
              {elementOptions(selectedElement).map((element) => <option key={element.hash} value={element.hash}>{element.name}</option>)}
            </select></label>
            <label className="rail-control rail-brush-control"><span>笔刷大小</span><input type="range" min="1" max="21" step="2" value={brushSize} disabled={!sim || !['paint', 'erase', 'line'].includes(tool)} onChange={(event) => setBrushSize(Number(event.target.value))} /><output>{brushSize} × {brushSize}</output></label>
            <div className="history-buttons tool-history"><button type="button" title="撤销上一次编辑" aria-label="撤销上一次编辑" disabled={undoStackRef.current.length === 0} onClick={undo}><Undo2 size={16} /></button><button type="button" title="重做上一次编辑" aria-label="重做上一次编辑" disabled={redoStackRef.current.length === 0} onClick={redo}><Redo2 size={16} /></button></div>
          </section>
          <div className="map-section-divider" />
          <SectionHeading icon={<Settings2 size={16} />} title={selectionBounds ? '区域选择' : '单元检查'} action={selectionBounds ? `${selectionBounds.width}×${selectionBounds.height}` : selectedCell ? formatHash(selectedCell.elementHash) : 'SIM'} />
          <div className="map-info-copy">直接读取存档中的 SIM cell。元素替换、温度和质量会随着导出写回原始二进制结构。</div>
          {selectionBounds ? <>
            <div className="coordinate-box selection-coordinate-box"><span>当前选区</span><strong>{selectionBounds.width}×{selectionBounds.height}</strong><small>{selectionBounds.cells} 格 · {selectionBounds.minX}, {selectionBounds.minY} 至 {selectionBounds.maxX}, {selectionBounds.maxY}</small></div>
            <div className="map-stat"><span>覆盖格子</span><strong>{selectionBounds.cells.toLocaleString()} 格</strong></div>
            <div className="inspector-empty map-empty selection-empty"><Square size={18} /><span>可继续使用其他工具编辑选区</span></div>
          </> : <>
          <div className="coordinate-box"><span>当前单元</span><strong>{lastCell ? `${lastCell.x}, ${lastCell.y}` : '—'}</strong><small>{lastCell ? `world index ${lastCell.y * size.width + lastCell.x}` : '点击地图查看坐标'}</small></div>
          {selectedCell && lastCell ? <>
            <label className="sim-field"><span>元素</span><select value={selectedCell.elementHash} onChange={(event) => patchCell(lastCell, elementPatch(Number(event.target.value), selectedCell))}>
              {selectedElementList.map((element) => <option key={element.hash} value={element.hash}>{element.name}</option>)}
            </select></label>
            <label className="sim-field"><span>温度 °C</span><input type="number" step="0.1" value={(selectedCell.temperature - 273.15).toFixed(2)} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) patchCell(lastCell, { temperature: value + 273.15 }) }} /></label>
            <label className="sim-field"><span>质量 kg</span><input type="number" min="0" step="0.001" value={selectedCell.mass.toFixed(3)} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) patchCell(lastCell, { mass: value }) }} /></label>
            <div className="map-stat"><span>状态</span><strong>{elementForHash(selectedCell.elementHash).state}</strong></div>
            <div className="map-stat"><span>属性字节</span><strong>{formatHash(selectedCell.properties)}</strong></div>
            <div className="map-stat"><span>绝缘 / 强度</span><strong>{selectedCell.insulation} / {selectedCell.strengthInfo}</strong></div>
          </> : <div className="inspector-empty map-empty"><Search size={18} /><span>选择一个单元查看数据</span></div>}
          </>}
          <div className="map-stat"><span>模拟网格</span><strong>{sim ? `${sim.width} × ${sim.height}` : '—'}</strong></div>
      </aside>
    </div>
  )
}

function YamlWorkspace({ template, fileName, documents, selectedPath, onSelect }: { template: YamlTemplate; fileName: string; documents: ImportedYamlTemplate[]; selectedPath: string; onSelect: (path: string) => void }) {
  return <div className="yaml-workspace">
    <div className="content-head content-head-template">
      <div>
        <div className="eyebrow">YAML TERRAIN</div>
        <h1>地形预览</h1>
      </div>
      {documents.length > 1 ? <label className="yaml-source-picker"><span>已导入 {documents.length} 个 YAML</span><select value={selectedPath} onChange={(event) => onSelect(event.target.value)}>{documents.map((document) => <option key={document.path} value={document.path}>{document.path}</option>)}</select></label> : <div className="head-meta"><span className="status-dot template-dot" />已载入<ChevronRight size={14} />{fileName}</div>}
    </div>
    <div className="yaml-preview-layout">
      <section className="yaml-preview-main">
        <TemplateCanvas template={template} />
        <div className="map-legend template-legend"><span><i className="legend-visible" />YAML 地形</span><span><i className="legend-entity" />建筑 / 对象位置</span><span className="legend-help">只读预览</span></div>
      </section>
      <aside className="map-parameter-rail map-info yaml-preview-info"><TemplateDetails template={template} loading={false} error="" /></aside>
    </div>
  </div>
}

function TemplateDetails({ template, loading, error }: { template: YamlTemplate | null; loading: boolean; error: string }) {
  if (!template) {
    return <div className="template-details-empty"><FileText size={21} /><strong>{loading ? '正在读取 YAML' : '尚未选择模板'}</strong><span>{error || '从上方选择一个模板文件'}</span></div>
  }
  const objectCount = template.buildings.length + template.pickupables.length + template.elementalOres.length + template.otherEntities.length
  return <>
    <section className="template-details">
      <SectionHeading icon={<FileText size={16} />} title="YAML 模板" action={template.category} />
      <h2 className="template-name">{template.name}</h2>
      <div className="template-path">{template.path}</div>
      <div className="template-stat-grid">
        <div><span>尺寸</span><strong>{template.width} × {template.height}</strong></div>
        <div><span>原点</span><strong>{template.minX}, {template.minY}</strong></div>
        <div><span>地形格</span><strong>{template.cells.length.toLocaleString()}</strong></div>
        <div><span>对象</span><strong>{objectCount.toLocaleString()}</strong></div>
      </div>
    </section>
    <div className="map-section-divider" />
    <SectionHeading icon={<Layers3 size={16} />} title="内容统计" action="CELLS" />
    <div className="template-count-list">
      <div><span className="template-count-dot solid" />固体地形<strong>{template.solidCount.toLocaleString()}</strong></div>
      <div><span className="template-count-dot fluid" />气体 / 液体<strong>{template.fluidCount.toLocaleString()}</strong></div>
      <div><span className="template-count-dot empty" />真空<strong>{template.vacuumCount.toLocaleString()}</strong></div>
      {template.unknownCount > 0 && <div><span className="template-count-dot unknown" />通用样式元素<strong>{template.unknownCount.toLocaleString()}</strong></div>}
    </div>
    <div className="map-section-divider" />
    <div className="map-info-copy">模板只读预览。地形使用 YAML 的 `location_x` / `location_y` 坐标绘制，建筑和其他对象以位置标记显示。</div>
  </>
}

function TemplateCanvas({ template }: { template: YamlTemplate }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const [textures, setTextures] = useState<Record<string, HTMLImageElement>>({})
  const [zoomPercent, setZoomPercent] = useState(50)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const fitCellSize = viewportSize.width > 0 && viewportSize.height > 0
    ? Math.min(18, viewportSize.width / template.width, viewportSize.height / template.height)
    : 12
  const zoom = .75 + 2.5 * zoomPercent / 100
  const displayCellSize = Math.max(1, fitCellSize * zoom)
  const devicePixelRatio = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  const renderCellSize = Math.max(1, displayCellSize * devicePixelRatio)
  const originX = ((viewportSize.width - template.width * displayCellSize) / 2 + pan.x) * devicePixelRatio
  const originY = ((viewportSize.height - template.height * displayCellSize) / 2 + pan.y) * devicePixelRatio
  const viewportPixelWidth = Math.max(1, Math.ceil(viewportSize.width * devicePixelRatio))
  const viewportPixelHeight = Math.max(1, Math.ceil(viewportSize.height * devicePixelRatio))

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const updateSize = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight })
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    const paths = new Set(template.cells.map((cell) => templateVisualElementForName(cell.element).texture).filter((path): path is string => Boolean(path)))
    paths.forEach((path) => loadAssetImage(path, (image) => { if (active) setTextures((current) => ({ ...current, [path]: image })) }))
    return () => { active = false }
  }, [template])

  const setZoomAround = (requestedPercent: number, clientX?: number, clientY?: number) => {
    const nextPercent = Math.max(0, Math.min(100, Math.round(requestedPercent)))
    if (nextPercent === zoomPercent) return
    const nextZoom = .75 + 2.5 * nextPercent / 100
    const viewport = viewportRef.current
    if (!viewport || clientX === undefined || clientY === undefined) {
      setZoomPercent(nextPercent)
      return
    }
    const rect = viewport.getBoundingClientRect()
    const anchorX = clientX - rect.left
    const anchorY = clientY - rect.top
    const currentOriginX = (viewport.clientWidth - template.width * displayCellSize) / 2 + pan.x
    const currentOriginY = (viewport.clientHeight - template.height * displayCellSize) / 2 + pan.y
    const worldX = (anchorX - currentOriginX) / displayCellSize
    const worldY = (anchorY - currentOriginY) / displayCellSize
    const nextCellSize = fitCellSize * nextZoom
    const nextOriginX = (viewport.clientWidth - template.width * nextCellSize) / 2
    const nextOriginY = (viewport.clientHeight - template.height * nextCellSize) / 2
    setPan({ x: anchorX - nextOriginX - worldX * nextCellSize, y: anchorY - nextOriginY - worldY * nextCellSize })
    setZoomPercent(nextPercent)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !viewportSize.width || !viewportSize.height) return
    if (canvas.width !== viewportPixelWidth) canvas.width = viewportPixelWidth
    if (canvas.height !== viewportPixelHeight) canvas.height = viewportPixelHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#0b1118'
    context.fillRect(0, 0, canvas.width, canvas.height)
    const patterns = createElementPatterns(context, textures, renderCellSize, originX, originY + template.height * renderCellSize)
    const cells = new Map(template.cells.map((cell) => [`${cell.x}:${cell.y}`, cell]))
    const minCellX = template.minX
    const maxCellY = template.minY + template.height - 1
    const minColumn = Math.max(0, Math.floor(-originX / renderCellSize) - 1)
    const maxColumn = Math.min(template.width - 1, Math.ceil((canvas.width - originX) / renderCellSize) + 1)
    const minRow = Math.max(0, Math.floor(-originY / renderCellSize) - 1)
    const maxRow = Math.min(template.height - 1, Math.ceil((canvas.height - originY) / renderCellSize) + 1)
    const cellAt = (x: number, y: number) => cells.get(`${x}:${y}`)
    const solidElementAt = (x: number, y: number) => {
      const cell = cellAt(x, y)
      const element = cell ? templateVisualElementForName(cell.element) : undefined
      return element?.state === 'solid' ? element : undefined
    }
    const materialOrder = (element: ReturnType<typeof templateVisualElementForName> | undefined) => element ? element.terrainOrder ?? element.hash : Number.NEGATIVE_INFINITY

    for (let row = minRow; row <= maxRow; row++) {
      const worldY = maxCellY - row
      for (let column = minColumn; column <= maxColumn; column++) {
        const worldX = minCellX + column
        const cell = cellAt(worldX, worldY)
        if (!cell) continue
        const element = templateVisualElementForName(cell.element)
        const px = originX + column * renderCellSize
        const py = originY + row * renderCellSize
        if (!element) {
          context.fillStyle = '#3b4146'
          context.fillRect(px, py, renderCellSize, renderCellSize)
          continue
        }
        if (element.state === 'solid') {
          const order = materialOrder(element)
          const connected = (x: number, y: number) => {
            const neighbour = solidElementAt(x, y)
            return Boolean(neighbour && materialOrder(neighbour) >= order)
          }
          const boundary = !connected(worldX - 1, worldY) || !connected(worldX + 1, worldY) || !connected(worldX, worldY - 1) || !connected(worldX, worldY + 1)
          const shape = createTerrainCellPath(connected, worldX, worldY)
          context.save()
          context.translate(px, py)
          context.scale(renderCellSize, renderCellSize)
          context.clip(shape)
          context.setTransform(1, 0, 0, 1, 0, 0)
          context.fillStyle = patterns.get(element.texture ?? '') ?? element.color
          context.fillRect(px, py, renderCellSize, renderCellSize)
          context.fillStyle = 'rgba(0, 0, 0, .16)'
          context.fillRect(px, py, renderCellSize, renderCellSize)
          context.restore()
          if (boundary) {
            const edge = createTerrainBoundaryPath(connected, worldX, worldY)
            context.save()
            context.translate(px, py)
            context.scale(renderCellSize, renderCellSize)
            context.strokeStyle = 'rgba(3, 6, 8, .9)'
            context.lineWidth = Math.max(.8, Math.min(2.4, renderCellSize * .055)) / Math.max(1, renderCellSize)
            context.lineJoin = 'round'
            context.stroke(edge)
            context.restore()
          }
        } else if (element.state === 'gas') {
          context.fillStyle = element.fluidMaterial?.gradientBottom ?? element.color
          context.globalAlpha = .26
          context.fillRect(px, py, renderCellSize, renderCellSize)
          context.globalAlpha = 1
        }
      }
    }

    const drawEntities = (entities: TemplateEntity[], color: string, shape: 'square' | 'circle') => {
      context.save()
      context.fillStyle = color
      context.strokeStyle = 'rgba(4, 8, 12, .9)'
      context.lineWidth = Math.max(1, renderCellSize * .06)
      for (const entity of entities) {
        const column = entity.x - minCellX
        const row = maxCellY - entity.y
        if (column < 0 || row < 0 || column >= template.width || row >= template.height) continue
        const centerX = originX + (column + .5) * renderCellSize
        const centerY = originY + (row + .5) * renderCellSize
        const radius = Math.max(2, renderCellSize * .18)
        context.beginPath()
        if (shape === 'circle') context.arc(centerX, centerY, radius, 0, Math.PI * 2)
        else context.rect(centerX - radius, centerY - radius, radius * 2, radius * 2)
        context.fill()
        context.stroke()
      }
      context.restore()
    }
    drawEntities(template.buildings, '#e0b86d', 'square')
    drawEntities([...template.otherEntities, ...template.elementalOres], '#79d5de', 'circle')
    drawEntities(template.pickupables, '#d891c5', 'circle')
    context.strokeStyle = 'rgba(222, 190, 124, .35)'
    context.lineWidth = Math.max(1, devicePixelRatio)
    context.strokeRect(originX, originY, template.width * renderCellSize, template.height * renderCellSize)
  }, [devicePixelRatio, originX, originY, renderCellSize, template, textures, viewportPixelHeight, viewportPixelWidth, viewportSize.height, viewportSize.width])

  return <div
    ref={viewportRef}
    className={`canvas-frame canvas-viewport template-canvas ${isPanning ? 'is-panning' : ''}`}
    onWheel={(event) => { event.preventDefault(); event.stopPropagation(); setZoomAround(zoomPercent + (event.deltaY < 0 ? 5 : -5), event.clientX, event.clientY) }}
    onPointerDown={(event) => {
      if (event.button !== 0 && event.button !== 1) return
      event.currentTarget.setPointerCapture(event.pointerId)
      pointerRef.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y }
      setIsPanning(true)
    }}
    onPointerMove={(event) => {
      const pointer = pointerRef.current
      if (!pointer) return
      setPan({ x: pointer.panX + event.clientX - pointer.startX, y: pointer.panY + event.clientY - pointer.startY })
    }}
    onPointerUp={(event) => {
      pointerRef.current = null
      setIsPanning(false)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }}
    onPointerCancel={() => { pointerRef.current = null; setIsPanning(false) }}
  >
    <canvas ref={canvasRef} className="template-canvas-layer" />
    <div className="canvas-controls" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" title="缩小模板" aria-label="缩小模板" onClick={() => setZoomAround(zoomPercent - 10)}><Minus size={15} /></button>
      <input type="range" min="0" max="100" step="1" value={zoomPercent} aria-label="模板缩放" onChange={(event) => setZoomAround(Number(event.target.value))} />
      <output>{zoomPercent}</output>
      <button type="button" title="放大模板" aria-label="放大模板" onClick={() => setZoomAround(zoomPercent + 10)}><Plus size={15} /></button>
      <button type="button" className="canvas-reset" title="重置模板视图" aria-label="重置模板视图" onClick={() => { setZoomPercent(50); setPan({ x: 0, y: 0 }) }}>50</button>
    </div>
  </div>
}

function rectangleCells(start: { x: number; y: number }, end: { x: number; y: number }): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = []
  for (let y = Math.min(start.y, end.y); y <= Math.max(start.y, end.y); y++) {
    for (let x = Math.min(start.x, end.x); x <= Math.max(start.x, end.x); x++) cells.push({ x, y })
  }
  return cells
}

function normalizedSelection(selection: MapSelection): { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number; cells: number } {
  const minX = Math.min(selection.start.x, selection.end.x)
  const maxX = Math.max(selection.start.x, selection.end.x)
  const minY = Math.min(selection.start.y, selection.end.y)
  const maxY = Math.max(selection.start.y, selection.end.y)
  const width = maxX - minX + 1
  const height = maxY - minY + 1
  return { minX, maxX, minY, maxY, width, height, cells: width * height }
}

function lineCells(start: { x: number; y: number }, end: { x: number; y: number }, brushSize: number, width: number, height: number): Array<{ x: number; y: number }> {
  const cells = new Map<string, { x: number; y: number }>()
  const radius = Math.floor(brushSize / 2)
  const steps = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y))
  for (let step = 0; step <= steps; step++) {
    const progress = steps === 0 ? 0 : step / steps
    const centerX = Math.round(start.x + (end.x - start.x) * progress)
    const centerY = Math.round(start.y + (end.y - start.y) * progress)
    for (let offsetY = -radius; offsetY <= radius; offsetY++) {
      for (let offsetX = -radius; offsetX <= radius; offsetX++) {
        const x = centerX + offsetX
        const y = centerY + offsetY
        if (x >= 0 && y >= 0 && x < width && y < height) cells.set(`${x}:${y}`, { x, y })
      }
    }
  }
  return [...cells.values()]
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('input, select, textarea, button, [contenteditable="true"]'))
}

function createElementPatterns(context: CanvasRenderingContext2D, textures: Record<string, HTMLImageElement>, cellSize: number, worldOriginX: number, worldBottomY: number): Map<string, CanvasPattern | null> {
  const patterns = new Map<string, CanvasPattern | null>()
  Object.entries(textures).forEach(([path, image]) => {
    const pattern = context.createPattern(image, 'repeat')
    if (pattern) {
      const element = ELEMENTS.find((candidate) => candidate.texture === path)
      const worldUvScale = element?.worldUvScale ?? DEFAULT_ELEMENT_WORLD_UV_SCALE
      const scaleX = (cellSize * worldUvScale) / image.naturalWidth
      const scaleY = (cellSize * worldUvScale) / image.naturalHeight
      const yOffset = worldBottomY - cellSize * worldUvScale
      pattern.setTransform(new DOMMatrix([scaleX, 0, 0, scaleY, worldOriginX, yOffset]))
    }
    patterns.set(path, pattern)
  })
  return patterns
}

type RgbColor = { r: number; g: number; b: number }
const gasColorCache = new Map<string, RgbColor>()

function gasRgb(color: string): RgbColor {
  const cached = gasColorCache.get(color)
  if (cached) return cached
  const normalized = color.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized
  const parsed = Number.parseInt(value, 16)
  const result = Number.isFinite(parsed)
    ? { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 }
    : { r: 255, g: 255, b: 255 }
  gasColorCache.set(color, result)
  return result
}

function gasRgba(color: string, alpha: number): string {
  const { r, g, b } = gasRgb(color)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`
}

function gasPressureVisibility(cell: SimCell): number {
  const mass = Math.max(0, cell.mass)
  return mass > 0 ? Math.max(Math.min(mass / 200, 1), .15) : 0
}

function drawGasBase(context: CanvasRenderingContext2D, style: FluidMaterialStyle, cell: SimCell, px: number, py: number, cellSize: number): void {
  const pressure = gasPressureVisibility(cell)
  if (pressure <= 0) return
  // Canvas2D is only a fallback for browsers without WebGL2. Keep its
  // coverage curve aligned with GasTest's _SpaceAlphaScale=2 and _Alpha=.5.
  const alpha = Math.min(1, pressure * 2) * .5
  context.fillStyle = gasRgba(style.gradientBottom, alpha)
  context.fillRect(px, py, cellSize, cellSize)
}

function drawLiquidFallback(context: CanvasRenderingContext2D, style: FluidMaterialStyle, cell: SimCell, px: number, py: number, cellSize: number, fullHeight: boolean): void {
  const massRatio = Math.min(Math.max(cell.mass, 0) / 2000, 1)
  const amount = fullHeight ? 1 : Math.pow(massRatio, .45)
  const alpha = style.opaque ? .48 + amount * .24 : .28 + amount * .28
  context.fillStyle = gasRgba(style.gradientBottom, alpha)
  context.fillRect(px, py, cellSize, cellSize)
  if (!fullHeight) return
  context.fillStyle = gasRgba(style.gradientTop, .22)
  context.fillRect(px, py, cellSize, Math.max(1, cellSize * .07))
}

function drawGeyserTexture(context: CanvasRenderingContext2D, image: HTMLImageElement, definition: GeyserTextureDefinition, cellSize: number, centerX: number, centerY: number, orientation = 0, rotatable?: RotatableVisualizer): void {
  if (!image.naturalWidth || !image.naturalHeight) return
  const width = cellSize * definition.widthCells
  const height = cellSize * (definition.heightCells ?? definition.widthCells * image.naturalHeight / image.naturalWidth)
  context.save()
  context.globalAlpha = .98
  // Building and geyser sprites are scaled between world-cell sizes; smooth
  // interpolation keeps their transparent contours from turning stair-stepped.
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  // KAnim uses a world-space Y-up matrix, while this canvas is screen-space
  // Y-down. Convert Rotatable's pivot/offset before applying its transform.
  const visualizerOffsetX = orientation === 5 ? -(rotatable?.offsetXCells ?? 0) : rotatable?.offsetXCells ?? 0
  const visualizerOffsetY = orientation === 6 ? -1 : -(rotatable?.offsetYCells ?? 0)
  const pivotX = orientation === 5 ? -(rotatable?.pivotXCells ?? 0) : rotatable?.pivotXCells ?? 0
  const pivotY = -(rotatable?.pivotYCells ?? 0)
  context.translate(
    centerX + visualizerOffsetX * cellSize,
    centerY + visualizerOffsetY * cellSize - (definition.verticalOffsetCells ?? 0) * cellSize,
  )
  if (orientation >= 1 && orientation <= 3) {
    context.translate(pivotX * cellSize, pivotY * cellSize)
    context.rotate(orientation * Math.PI / 2)
    context.translate(-pivotX * cellSize, -pivotY * cellSize)
  }
  if (orientation === 5) {
    context.translate(pivotX * cellSize, pivotY * cellSize)
    context.scale(-1, 1)
    context.translate(-pivotX * cellSize, -pivotY * cellSize)
  }
  if (orientation === 6) {
    context.translate(pivotX * cellSize, pivotY * cellSize)
    context.scale(1, -1)
    context.translate(-pivotX * cellSize, -pivotY * cellSize)
  }
  const offsetX = (definition.anchorOffsetXCells ?? 0) * cellSize
  const offsetY = (definition.anchorOffsetYCells ?? 0) * cellSize
  context.drawImage(image, offsetX - width / 2, offsetY - height / 2, width, height)
  context.restore()
}

function visibleMapRange(width: number, height: number, cellSize: number, originX: number, originY: number, viewportWidth: number, viewportHeight: number): { minX: number; maxX: number; minRow: number; maxRow: number } {
  return {
    minX: Math.max(0, Math.floor(-originX / cellSize) - 1),
    maxX: Math.min(width - 1, Math.ceil((viewportWidth - originX) / cellSize) + 1),
    minRow: Math.max(0, Math.floor(-originY / cellSize) - 1),
    maxRow: Math.min(height - 1, Math.ceil((viewportHeight - originY) / cellSize) + 1),
  }
}

function mapObjectAnchor(x: number, y: number, height: number, cellSize: number, originX: number, originY: number): { x: number; y: number } {
  return {
    // Save transforms already use Grid.CellToPosCBC coordinates: x is the
    // cell centre (typically N + .5), while y is the cell bottom.
    x: originX + x * cellSize,
    y: originY + (height - y) * cellSize,
  }
}

function utilityDisplayConnections(
  cells: UtilityCellMap,
  family: UtilityFamily,
  instance: SavedObjectInstance,
  x: number,
  y: number,
): number {
  const ownBits = utilityConnectionBits(instance)
  const physicalBits = cells.get(family)?.get(blockTileCellKey(x, y))?.physicalBits ?? 0
  const fallbackBits = ownBits === undefined ? utilityNeighbourConnections(cells, family, x, y) : ownBits
  // UtilityNetworkManager.GetDisplayConnections() is visualGrid | physicalGrid.
  return (fallbackBits | physicalBits) & 0xf
}

function floodFillCoordinates(
  sim: NonNullable<ParsedSave['simData']>,
  width: number,
  height: number,
  startX: number,
  startY: number,
): Array<{ x: number; y: number }> {
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return []
  const view = new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength)
  const start = readSimCell(sim, view, startX + 1, startY + 1)
  if (!start) return []
  const targetHash = start.elementHash
  const visited = new Uint8Array(width * height)
  const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }]
  const cells: Array<{ x: number; y: number }> = []
  let cursor = 0
  while (cursor < queue.length) {
    const current = queue[cursor++]
    if (current.x < 0 || current.y < 0 || current.x >= width || current.y >= height) continue
    const index = current.y * width + current.x
    if (visited[index]) continue
    visited[index] = 1
    const cell = readSimCell(sim, view, current.x + 1, current.y + 1)
    if (!cell || cell.elementHash !== targetHash) continue
    cells.push(current)
    queue.push(
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
    )
  }
  return cells
}

function MapCanvas({ save, visibleLayers, overlay, tool, brushSize, viewport, onViewportChange, selectedCell, selection, previewCells, previewVersion, onCell, onSelectionChange, onShape, onStrokeStart, onStrokeEnd }: { save: ParsedSave; visibleLayers: MapLayerVisibility; overlay: MapOverlay; tool: MapTool; brushSize: number; viewport: MapViewport; onViewportChange: Dispatch<SetStateAction<MapViewport>>; selectedCell: { x: number; y: number } | null; selection: MapSelection | null; previewCells: Map<string, MapPreviewCell>; previewVersion: number; onCell: (x: number, y: number) => void; onSelectionChange: (selection: MapSelection | null) => void; onShape: (start: { x: number; y: number }, end: { x: number; y: number }) => void; onStrokeStart: () => void; onStrokeEnd: () => void }) {
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const entityBackCanvasRef = useRef<HTMLCanvasElement>(null)
  const entityFrontCanvasRef = useRef<HTMLCanvasElement>(null)
  const fluidBaseCanvasRef = useRef<HTMLCanvasElement>(null)
  const fluidCanvasRef = useRef<HTMLCanvasElement>(null)
  const particleCanvasRef = useRef<HTMLCanvasElement>(null)
  const lightCanvasRef = useRef<HTMLCanvasElement>(null)
  const gridCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const canvasLayerRef = useRef<HTMLDivElement>(null)
  const selectionDraftOverlayRef = useRef<HTMLDivElement>(null)
  const selectionDraftTitleRef = useRef<HTMLElement>(null)
  const selectionDraftCountRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const wheelZoomRef = useRef<{ targetPercent: number; clientX: number; clientY: number; timer: number } | null>(null)
  const focusedSaveRef = useRef<ParsedSave | null>(null)
  const initialGroupTagsRef = useRef((save.manager?.groups ?? []).map((group) => group.tag.trim().toLowerCase()))
  const renderCacheRef = useRef<{ bytes: Uint8Array | null; cells: Map<number, SimCell | undefined>; zoneBytes: Uint8Array | null; zones: Uint8Array | null }>({ bytes: null, cells: new Map(), zoneBytes: null, zones: null })
  const pointerRef = useRef<{ mode: 'pan' | 'select' | 'brush' | 'shape' | 'point'; startX: number; startY: number; panX: number; panY: number; moved: boolean; lastCell: { x: number; y: number } | null; startCell: { x: number; y: number } | null } | null>(null)
  const visitedBrushCellsRef = useRef(new Set<string>())
  const brushCellRef = useRef<{ x: number; y: number } | null>(null)
  const fillRegionCacheRef = useRef<{ bytes: Uint8Array | null; regions: Map<number, Array<{ x: number; y: number }>> }>({ bytes: null, regions: new Map() })
  const spacePanRef = useRef(false)
  const [textures, setTextures] = useState<Record<string, HTMLImageElement>>({})
  const [terrainMaskSets, setTerrainMaskSets] = useState<TerrainMaskSets | null>(null)
  const [biomeBackgrounds, setBiomeBackgrounds] = useState<Record<number, HTMLImageElement>>({})
  const [geyserTextures, setGeyserTextures] = useState<Record<string, HTMLImageElement>>({})
  const [buildingTextures, setBuildingTextures] = useState<Record<string, HTMLImageElement>>({})
  const [generatedBuildingDefinitions, setGeneratedBuildingDefinitions] = useState<Record<string, BuildingTextureDefinition>>({})
  const [minionKanimAssets, setMinionKanimAssets] = useState<MinionKanimAssets | null>(null)
  const minionWearableNames = useMemo(() => saveMinionWearableAnimNames(save), [save])
  const { zoomPercent, pan } = viewport
  const setZoomPercent = (nextZoomPercent: number) => onViewportChange((current) => ({ ...current, zoomPercent: nextZoomPercent }))
  const setPan = (nextPan: { x: number; y: number }) => onViewportChange((current) => ({ ...current, pan: nextPan }))
  const [isPanning, setIsPanning] = useState(false)
  const [spacePan, setSpacePan] = useState(false)
  const [brushCell, setBrushCell] = useState<{ x: number; y: number } | null>(null)
  const selectionDraftRef = useRef<MapSelection | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const size = worldSize(save)
  const fitCellSize = viewportSize.width > 0 && viewportSize.height > 0
    ? Math.min(MAP_CELL_PIXELS, viewportSize.width / size.width, viewportSize.height / size.height)
    : MAP_CELL_PIXELS
  const zoom = MAP_ZOOM_MIN + (MAP_ZOOM_MAX - MAP_ZOOM_MIN) * zoomPercent / 100
  const displayCellSize = fitCellSize * zoom
  const nativePixelRatio = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  // Keep preview canvases within a fixed pixel budget. A full-screen DPR 2
  // canvas has four times the fill cost; exports still use their requested
  // resolution and are unaffected by this interactive preview cap.
  const viewportArea = Math.max(1, viewportSize.width * viewportSize.height)
  const previewPixelRatioBudget = Math.sqrt(2_400_000 / viewportArea)
  const devicePixelRatio = Math.max(1, Math.min(nativePixelRatio, previewPixelRatioBudget))
  // Keep the physical cell size fractional. Rounding every cell independently
  // makes the rendered grid drift away from the CSS hit-test coordinates.
  const renderCellSize = Math.max(1, displayCellSize * devicePixelRatio)
  const originX = ((viewportSize.width - size.width * displayCellSize) / 2 + pan.x) * devicePixelRatio
  const originY = ((viewportSize.height - size.height * displayCellSize) / 2 + pan.y) * devicePixelRatio
  const viewportPixelWidth = Math.max(1, Math.ceil(viewportSize.width * devicePixelRatio))
  const viewportPixelHeight = Math.max(1, Math.ceil(viewportSize.height * devicePixelRatio))
  const mapSeed = worldSeed(save)
  const mapCoordinate = worldCoordinate(save)

  const focusVisibleMap = useCallback(() => {
    const visible = worldGrid(save, 'GridVisible')?.bytes
    if (!visible || !size.width || !size.height || !viewportSize.width || !viewportSize.height) {
      onViewportChange(DEFAULT_MAP_VIEWPORT)
      return
    }
    let minX = size.width
    let minY = size.height
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < size.height; y++) {
      for (let x = 0; x < size.width; x++) {
        if (!visible[y * size.width + x]) continue
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
    if (maxX < minX || maxY < minY) {
      onViewportChange(DEFAULT_MAP_VIEWPORT)
      return
    }
    const marginCells = 12
    const visibleWidth = Math.min(size.width, maxX - minX + 1 + marginCells * 2)
    const visibleHeight = Math.min(size.height, maxY - minY + 1 + marginCells * 2)
    const targetCellSize = Math.min(viewportSize.width / visibleWidth, viewportSize.height / visibleHeight)
    const targetZoom = Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, targetCellSize / fitCellSize))
    const targetPercent = Math.round((targetZoom - MAP_ZOOM_MIN) / (MAP_ZOOM_MAX - MAP_ZOOM_MIN) * 100)
    const displaySize = fitCellSize * targetZoom
    const centerX = (minX + maxX + 1) / 2
    const centerCanvasY = size.height - (minY + maxY + 1) / 2
    onViewportChange({
      zoomPercent: targetPercent,
      pan: {
        x: (size.width / 2 - centerX) * displaySize,
        y: (size.height / 2 - centerCanvasY) * displaySize,
      },
    })
  }, [fitCellSize, onViewportChange, save, size.height, size.width, viewportSize.height, viewportSize.width])

  useEffect(() => {
    if (!viewportSize.width || !viewportSize.height || focusedSaveRef.current === save) return
    focusedSaveRef.current = save
    focusVisibleMap()
  }, [focusVisibleMap, save, viewportSize.height, viewportSize.width])

  const cachedSimCell = (sim: NonNullable<ParsedSave['simData']>, view: DataView, x: number, y: number): SimCell | undefined => {
    const cache = renderCacheRef.current
    if (cache.bytes !== sim.bytes) {
      cache.bytes = sim.bytes
      cache.cells.clear()
    }
    const key = y * sim.width + x
    if (cache.cells.has(key)) return cache.cells.get(key)
    const cell = readSimCell(sim, view, x, y)
    cache.cells.set(key, cell)
    return cell
  }

  const cachedWorldZoneMap = useCallback((sim: NonNullable<ParsedSave['simData']>): Uint8Array => {
    const cache = renderCacheRef.current
    if (cache.zoneBytes !== sim.bytes || !cache.zones) {
      cache.zoneBytes = sim.bytes
      cache.zones = buildWorldZoneMap(save, size.width, size.height)
    }
    return cache.zones
  }, [save, size.height, size.width])

  const setZoomPercentAround = (requestedPercent: number, clientX?: number, clientY?: number) => {
    const nextPercent = Math.max(0, Math.min(100, Math.round(requestedPercent)))
    if (nextPercent === zoomPercent) return
    const nextZoom = MAP_ZOOM_MIN + (MAP_ZOOM_MAX - MAP_ZOOM_MIN) * nextPercent / 100
    const viewport = viewportRef.current
    if (!viewport || clientX === undefined || clientY === undefined) {
      setZoomPercent(nextPercent)
      return
    }
    const rect = viewport.getBoundingClientRect()
    const anchorX = clientX - rect.left - viewport.clientLeft
    const anchorY = clientY - rect.top - viewport.clientTop
    const currentOriginX = (viewport.clientWidth - size.width * displayCellSize) / 2 + pan.x
    const currentOriginY = (viewport.clientHeight - size.height * displayCellSize) / 2 + pan.y
    const worldX = (anchorX - currentOriginX) / displayCellSize
    const worldY = (anchorY - currentOriginY) / displayCellSize
    const nextCellSize = fitCellSize * nextZoom
    const nextOriginX = (viewport.clientWidth - size.width * nextCellSize) / 2
    const nextOriginY = (viewport.clientHeight - size.height * nextCellSize) / 2
    setPan({
      x: anchorX - nextOriginX - worldX * nextCellSize,
      y: anchorY - nextOriginY - worldY * nextCellSize,
    })
    setZoomPercent(nextPercent)
  }

  const queueWheelZoom = (delta: number, clientX: number, clientY: number) => {
    const previous = wheelZoomRef.current
    const targetPercent = Math.max(0, Math.min(100, (previous?.targetPercent ?? zoomPercent) + delta))
    if (targetPercent === (previous?.targetPercent ?? zoomPercent)) return
    if (previous) window.clearTimeout(previous.timer)
    const viewport = viewportRef.current
    const layer = canvasLayerRef.current
    if (viewport && layer) {
      const rect = viewport.getBoundingClientRect()
      const anchorX = clientX - rect.left - viewport.clientLeft
      const anchorY = clientY - rect.top - viewport.clientTop
      const currentZoom = MAP_ZOOM_MIN + (MAP_ZOOM_MAX - MAP_ZOOM_MIN) * zoomPercent / 100
      const targetZoom = MAP_ZOOM_MIN + (MAP_ZOOM_MAX - MAP_ZOOM_MIN) * targetPercent / 100
      layer.style.transformOrigin = `${anchorX}px ${anchorY}px`
      layer.style.transform = `scale(${targetZoom / currentZoom})`
    }
    const timer = window.setTimeout(() => {
      const pending = wheelZoomRef.current
      if (!pending) return
      wheelZoomRef.current = null
      if (canvasLayerRef.current) {
        canvasLayerRef.current.style.transform = 'translate3d(0, 0, 0)'
        canvasLayerRef.current.style.transformOrigin = ''
      }
      setZoomPercentAround(pending.targetPercent, pending.clientX, pending.clientY)
    }, 140)
    wheelZoomRef.current = { targetPercent, clientX, clientY, timer }
  }

  useEffect(() => () => {
    const pending = wheelZoomRef.current
    if (pending) window.clearTimeout(pending.timer)
  }, [])

  const pointToCell = (clientX: number, clientY: number): { x: number; y: number } | undefined => {
    const viewport = viewportRef.current
    if (!viewport || displayCellSize <= 0) return undefined
    const rect = viewport.getBoundingClientRect()
    const mapOriginX = (viewport.clientWidth - size.width * displayCellSize) / 2 + pan.x
    const mapOriginY = (viewport.clientHeight - size.height * displayCellSize) / 2 + pan.y
    const localX = clientX - rect.left - viewport.clientLeft
    const localY = clientY - rect.top - viewport.clientTop
    const mapX = (localX - mapOriginX) / displayCellSize
    const mapY = (localY - mapOriginY) / displayCellSize
    if (mapX < 0 || mapX >= size.width || mapY < 0 || mapY >= size.height) return undefined
    const x = Math.floor(mapX)
    const screenY = Math.floor(mapY)
    return { x, y: size.height - 1 - screenY }
  }

  const updateBrushCell = (cell: { x: number; y: number } | null) => {
    const previous = brushCellRef.current
    if (previous?.x === cell?.x && previous?.y === cell?.y) return
    brushCellRef.current = cell
    setBrushCell(cell)
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const updateSize = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight })
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    const paths = new Set([
      ...Object.values(BUILDING_TEXTURES).map((definition) => definition.path),
      ...Object.values(BLOCK_TILE_TEXTURES).map((definition) => definition.path),
      ...Object.values(UTILITY_DEFINITIONS).map((definition) => definition.path),
    ])
    void loadAssetImages(paths).then((images) => { if (active) setBuildingTextures((current) => ({ ...current, ...images })) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    void loadMinionKanimAssets(minionWearableNames)
      .then((assets) => { if (active) setMinionKanimAssets(assets) })
      .catch(() => { /* Keep the fallback marker if source KAnim assets are unavailable. */ })
    return () => { active = false }
  }, [minionWearableNames])

  useEffect(() => {
    let active = true
    const loadManifest = async (path: string): Promise<Record<string, BuildingTextureDefinition>> => {
      const response = await fetch(assetPath(path))
      return response.ok ? await response.json() as Record<string, BuildingTextureDefinition> : {}
    }
    loadManifest('/assets/buildings/manifest.json')
      .then((bridgeManifest) => {
        if (!active) return
        const definitions: Record<string, BuildingTextureDefinition> = {}
        // ONI_Bridge is the canonical exported KAnim source.  It deliberately
        // supplies every building sprite from one game-derived texture source.
        Object.entries(bridgeManifest).forEach(([tag, definition]) => { definitions[tag.toLowerCase()] = definition })
        setGeneratedBuildingDefinitions(definitions)
        const usedTags = new Set(initialGroupTagsRef.current.flatMap((tag) => buildingTextureLookupKeys(tag)))
        const paths = Object.entries(definitions)
          // Stateful KAnim frames are stored as `<animation>__<state>`.
          // Loading only the base key made a POIDoorInternal choose its
          // correct `closed/open/locked` definition but then skip drawing,
          // because that PNG had never been requested.
          .filter(([tag]) => usedTags.has(tag) || usedTags.has(tag.split('__')[0]))
          .map(([, definition]) => definition.path)
        void loadAssetImages(paths).then((images) => { if (active) setBuildingTextures((current) => ({ ...current, ...images })) })
      })
      .catch(() => { /* Older deployments can run with the legacy texture table. */ })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isEditableTarget(event.target)) return
      event.preventDefault()
      if (spacePanRef.current) return
      spacePanRef.current = true
      setSpacePan(true)
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      spacePanRef.current = false
      setSpacePan(false)
    }
    const clearSpacePan = () => {
      spacePanRef.current = false
      setSpacePan(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', clearSpacePan)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', clearSpacePan)
    }
  }, [])

  useEffect(() => {
    let active = true
    const paths = [...new Set([
      ...ELEMENTS.map((element) => element.texture).filter((path): path is string => Boolean(path)),
      ...ONI_SUBSTANCE_MATERIALS.map((material) => material.textureUrl).filter(Boolean),
      '/assets/render/crackAlpha.png',
      '/assets/render/melt.png',
      '/assets/render/mudmelt.png',
      '/assets/render/normal_metal.png',
      '/assets/render/gasSteam01.png',
      '/assets/render/skullgas.png',
      '/assets/render/noise.png',
      '/assets/render/bubbles.png',
      '/assets/render/bgarray_liquids.png',
      '/assets/render/bgarray_liquids_specular.png',
    ])]
    void loadAssetImages(paths).then((images) => { if (active) setTextures(images) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    loadAssetImage(TERRAIN_MASK_ATLAS_URL, (image) => {
      if (active) setTerrainMaskSets(createTerrainMaskSets(image))
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const loads = Array.from({ length: 19 }, (_, textureIndex) => new Promise<{ textureIndex: number; image: HTMLImageElement } | null>((resolve) => {
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => resolve({ textureIndex, image })
      image.onerror = () => resolve(null)
      image.src = assetPath(biomeBackgroundAsset(textureIndex))
    }))
    void Promise.all(loads).then((entries) => {
      if (!active) return
      const next: Record<number, HTMLImageElement> = {}
      entries.forEach((entry) => {
        if (entry) next[entry.textureIndex] = entry.image
      })
      setBiomeBackgrounds(next)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const paths = new Set(Object.values(GEYSER_TEXTURES).map((definition) => definition.path))
    void loadAssetImages(paths).then((images) => { if (active) setGeyserTextures(images) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const canvas = backgroundCanvasRef.current
    const sim = save.simData
    if (!canvas || !sim || !size.width || !size.height || !viewportSize.width || !viewportSize.height) return
    if (canvas.width !== viewportPixelWidth) canvas.width = viewportPixelWidth
    if (canvas.height !== viewportPixelHeight) canvas.height = viewportPixelHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    const cellSize = renderCellSize
    const range = visibleMapRange(size.width, size.height, cellSize, originX, originY, canvas.width, canvas.height)
    const view = new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength)
    if (visibleLayers.biome) {
      oniWorldRenderer.renderBiome({
        context,
        worldZones: cachedWorldZoneMap(sim),
        width: size.width,
        height: size.height,
        cellSize,
        originX,
        originY,
        range,
        backgrounds: biomeBackgrounds,
      })
    }
    if (visibleLayers.backwall) {
      for (let canvasY = range.minRow; canvasY <= range.maxRow; canvasY++) {
        const y = size.height - 1 - canvasY
        for (let x = range.minX; x <= range.maxX; x++) {
          // Read through the same cache as terrain so changing layers does not
          // decode the SIM cell a second time.
          if (!cachedSimCell(sim, view, x + 1, y + 1)) continue
          const backwall = readSimBackwall(sim, view, x + 1, y + 1)
          const backwallPresent = backwall ? elementForHash(backwall.elementHash).state === 'solid' : false
          if (!backwallPresent) continue
          context.fillStyle = 'rgba(185, 164, 132, .55)'
          context.fillRect(originX + x * cellSize, originY + canvasY * cellSize, cellSize, cellSize)
        }
      }
    }
  }, [biomeBackgrounds, cachedWorldZoneMap, originX, originY, renderCellSize, save, size.height, size.width, viewportPixelHeight, viewportPixelWidth, viewportSize.height, viewportSize.width, visibleLayers.backwall, visibleLayers.biome])

  useEffect(() => {
    const canvas = canvasRef.current
    const sim = save.simData
    if (!canvas || !sim || !size.width || !size.height || !viewportSize.width || !viewportSize.height) return
    const cellSize = renderCellSize
    if (canvas.width !== viewportPixelWidth) canvas.width = viewportPixelWidth
    if (canvas.height !== viewportPixelHeight) canvas.height = viewportPixelHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.imageSmoothingEnabled = false
    // This canvas owns only Ground/Tile terrain and data overlays. Background,
    // backwalls, fluids, and game objects are retained on independent layers.
    context.clearRect(0, 0, canvas.width, canvas.height)
    const view = new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength)
    const worldZones = cachedWorldZoneMap(sim)
    const patterns = createElementPatterns(context, textures, cellSize, originX, originY + size.height * cellSize)
    const visibleGrid = worldGrid(save, 'GridVisible')?.bytes
    const spawnableGrid = worldGrid(save, 'GridSpawnable')?.bytes
    const damageGrid = worldGrid(save, 'GridDamage')?.bytes
    const range = visibleMapRange(size.width, size.height, cellSize, originX, originY, canvas.width, canvas.height)
    const blockTileCells = blockTileCellsByGroup(save)
    const terrainMaskedCells = terrainMaskedCellsByBuilding(save)
    for (const cells of blockTileCells.values()) {
      for (const key of cells) terrainMaskedCells.add(key)
    }
    const isTerrainMaskedAt = (x: number, y: number) => terrainMaskedCells.has(blockTileCellKey(x, y))

    const cellAt = (x: number, y: number) => cachedSimCell(sim, view, x + 1, y + 1)
    const simIndexAt = (x: number, y: number) => (y + 1) * sim.width + x + 1
    const damageView = damageGrid ? new DataView(damageGrid.buffer, damageGrid.byteOffset, damageGrid.byteLength) : undefined
    const damageAt = (x: number, y: number) => {
      const offset = (y * size.width + x) * 4
      return damageView && offset >= 0 && offset + 4 <= damageView.byteLength ? damageView.getFloat32(offset, true) : 0
    }
    const hasBackwallAt = (x: number, y: number) => {
      const backwall = readSimBackwall(sim, view, x + 1, y + 1)
      return backwall ? elementForHash(backwall.elementHash).state === 'solid' : false
    }
    if (visibleLayers.ground) {
      oniWorldRenderer.renderTerrain({
        context,
        width: size.width,
        height: size.height,
        cellSize,
        originX,
        originY,
        range,
        worldZones,
        textures,
        maskSets: terrainMaskSets,
        cellAt,
        isTerrainMaskedAt,
        damageAt,
        hasBackwallAt,
        zoneColors: ONI_WORLD_ZONE_COLORS,
      })
    }
    for (let canvasY = range.minRow; canvasY <= range.maxRow; canvasY++) {
      const y = size.height - 1 - canvasY
      for (let x = range.minX; x <= range.maxX; x++) {
        const cell = cellAt(x, y)
        if (!cell) continue
        const element = elementForHash(cell.elementHash)
        const px = originX + x * cellSize
        const py = originY + canvasY * cellSize
        const isSolid = element.state === 'solid'
        const elementLayerVisible = element.state === 'solid' && visibleLayers.ground
          || element.state === 'liquid' && visibleLayers.liquid
          || element.state === 'gas' && visibleLayers.gas
        if (!isSolid) {
          // Every cell must set its own fill style. Otherwise vacuum and unknown
          // elements inherit the previous cell's texture from the canvas state.
          // Vacuum is transparent in the game; the space scene must remain
          // visible underneath it. Special void cells still keep their fill.
          const showElement = element.state === 'special' || elementLayerVisible
          if (!(showElement && (element.state === 'liquid' || element.state === 'gas') && element.fluidMaterial)) {
            if (showElement) {
              context.fillStyle = patterns.get(element.texture ?? '') ?? element.color
              context.fillRect(px, py, cellSize, cellSize)
            }
          }
        }
        if (overlay === 'temperature') {
          context.fillStyle = temperatureColor(cell.temperature)
          context.globalAlpha = .72
          context.fillRect(px, py, cellSize, cellSize)
          context.globalAlpha = 1
        } else if (overlay === 'mass') {
          const intensity = Math.min(1, Math.log10(1 + Math.max(0, cell.mass)) / 2.2)
          context.fillStyle = `rgba(117, 171, 191, ${0.12 + intensity * 0.88})`
          context.fillRect(px, py, cellSize, cellSize)
        } else if (overlay === 'visibility') {
          const value = visibleGrid?.[y * size.width + x] ?? 0
          context.fillStyle = value > 0 ? `rgba(127, 169, 212, ${.2 + value / 255 * .72})` : 'rgba(16, 23, 25, .84)'
          context.fillRect(px, py, cellSize, cellSize)
        } else if (overlay === 'spawnable') {
          const value = spawnableGrid?.[y * size.width + x] ?? 0
          context.fillStyle = value > 0 ? `rgba(112, 157, 123, ${.2 + value / 255 * .72})` : 'rgba(16, 23, 25, .84)'
          context.fillRect(px, py, cellSize, cellSize)
        } else if (overlay === 'damage') {
          const damageValue = Math.max(0, Math.min(1, damageAt(x, y)))
          context.fillStyle = damageValue > 0 ? `rgba(198, 123, 113, ${.2 + damageValue * .72})` : 'rgba(16, 23, 25, .84)'
          context.fillRect(px, py, cellSize, cellSize)
        } else if (overlay === 'disease') {
          const diseaseOffset = sim.diseaseOffset + simIndexAt(x, y) * SIM_DISEASE_SIZE
          let diseaseLevel = 0
          for (let index = 0; index < SIM_DISEASE_SIZE; index++) diseaseLevel += sim.bytes[diseaseOffset + index]
          const intensity = Math.min(.9, .12 + diseaseLevel / 2040)
          context.fillStyle = diseaseLevel > 0 ? `rgba(194, 102, 111, ${intensity})` : 'rgba(16, 23, 25, .84)'
          context.fillRect(px, py, cellSize, cellSize)
        }
      }
    }

  }, [cachedWorldZoneMap, displayCellSize, originX, originY, overlay, pan.x, pan.y, renderCellSize, save, size.height, size.width, terrainMaskSets, textures, viewportPixelHeight, viewportPixelWidth, viewportSize.height, viewportSize.width, visibleLayers])

  useEffect(() => {
    const backCanvas = entityBackCanvasRef.current
    const frontCanvas = entityFrontCanvasRef.current
    if (!backCanvas || !frontCanvas || !size.width || !size.height || !viewportSize.width || !viewportSize.height) return
    for (const canvas of [backCanvas, frontCanvas]) {
      if (canvas.width !== viewportPixelWidth) canvas.width = viewportPixelWidth
      if (canvas.height !== viewportPixelHeight) canvas.height = viewportPixelHeight
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    }
    if (!visibleLayers.minions && !mapEntityLayersAreVisible(visibleLayers)) return
    const backContext = backCanvas.getContext('2d')
    const frontContext = frontCanvas.getContext('2d')
    if (!backContext || !frontContext) return
    const cellSize = renderCellSize
    const range = visibleMapRange(size.width, size.height, cellSize, originX, originY, backCanvas.width, backCanvas.height)
    const blockTileCells = blockTileCellsByGroup(save)
    const utilityCells = buildUtilityCellMap(save)
    for (const context of [backContext, frontContext]) {
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      context.fillStyle = '#e4b067'
    }
    for (const { group, instance } of mapObjectsInRenderOrder(save)) {
      const sceneLayer = mapObjectSceneLayer(group)
      const context = sceneLayer < TERRAIN_SCENE_LAYER ? backContext : frontContext
      if (group.tag === 'Minion') {
        if (!visibleLayers.minions) continue
        const minionX = Math.round(instance.position.x)
        const minionY = Math.round(size.height - 1 - instance.position.y)
        if (minionX >= 0 && minionY >= 0 && minionX < size.width && minionY < size.height) {
          const anchor = mapObjectAnchor(instance.position.x, instance.position.y, size.height, cellSize, originX, originY)
          if (minionKanimAssets) {
            drawMinionKanim(context, minionKanimAssets, minionAccessoryGuids(instance), minionWearableAnimNames(instance), cellSize, anchor.x, anchor.y, minionFacesLeft(instance))
          } else {
            context.fillRect(originX + minionX * cellSize + 1, originY + minionY * cellSize + 1, Math.max(1, cellSize - 2), Math.max(1, cellSize - 2))
          }
        }
        continue
      }
      const blockTileTexture = blockTileTextureForTag(group.tag)
      const blockTileGroupCells = blockTileTexture ? blockTileCells.get(group) : undefined
      const utilityTexture = utilityTextureForTag(group.tag)
      const utilityFamily = utilityFamilyForTag(group.tag)
      const isBuilding = hasSimpleComponent(instance, 'BuildingComplete')
      const geyserTexture = geyserTextureForTag(group.tag)
      const buildingTexture = buildingTextureForInstance(group.tag, instance, generatedBuildingDefinitions)
      const isGeyser = isGeyserInstance(group.tag, instance, geyserTexture)
      const isCreature = sceneLayer === ONI_SCENE_LAYER_ORDER.Creatures
      if (!isBuilding && !isGeyser && !buildingTexture && !blockTileTexture && !utilityTexture) continue
      if (!mapEntityLayerIsVisible(visibleLayers, isGeyser, isCreature, utilityFamily)) continue
      const x = Math.floor(instance.position.x)
      const y = Math.floor(instance.position.y)
      const canvasY = size.height - 1 - y
      if (x < 0 || canvasY < 0 || x >= size.width || canvasY >= size.height) continue
      const spriteMargin = Math.max(2, Math.ceil(isGeyser
        ? geyserTexture?.widthCells ?? 1
        : buildingTexture
          ? Math.max(buildingTexture.widthCells, buildingTexture.heightCells ?? buildingTexture.widthCells)
          : 1))
      if (x < range.minX - spriteMargin || x > range.maxX + spriteMargin || canvasY < range.minRow - spriteMargin || canvasY > range.maxRow + spriteMargin) continue
      const px = originX + x * cellSize
      const py = originY + canvasY * cellSize
      if (utilityTexture) {
        const image = buildingTextures[utilityTexture.path]
        if (image) {
          const connections = utilityDisplayConnections(utilityCells, utilityFamily!, instance, x, y)
          const anchor = mapObjectAnchor(instance.position.x, instance.position.y, size.height, cellSize, originX, originY)
          drawUtilityTile(context, image, utilityTexture, connections, anchor.x, anchor.y, cellSize)
        }
      } else if (blockTileTexture) {
        const connectionBits = blockTileConnectionBits(
          (neighbourX, neighbourY) => blockTileGroupCells?.has(blockTileCellKey(neighbourX, neighbourY)) ?? false,
          x,
          y,
        )
        const image = buildingTextures[blockTileTexture.path]
        if (image) drawBlockTile(context, image, connectionBits, px, py, cellSize)
      } else if (isGeyser && !buildingTexture) {
        const centerX = originX + instance.position.x * cellSize
        const centerY = originY + (size.height - instance.position.y - .5) * cellSize
        const image = geyserTexture ? geyserTextures[geyserTexture.path] : undefined
        if (image && geyserTexture) {
          drawGeyserTexture(context, image, geyserTexture, cellSize, centerX, centerY)
        }
      } else if (buildingTexture) {
        const anchor = mapObjectAnchor(instance.position.x, instance.position.y, size.height, cellSize, originX, originY)
        const image = buildingTextures[buildingTexture.path]
        if (image) drawGeyserTexture(context, image, buildingTexture, cellSize, anchor.x, anchor.y, instanceOrientation(instance), rotatableVisualizerForTag(group.tag))
      }
    }
  }, [buildingTextures, generatedBuildingDefinitions, geyserTextures, minionKanimAssets, originX, originY, renderCellSize, save, size.height, size.width, viewportPixelHeight, viewportPixelWidth, viewportSize.height, viewportSize.width, visibleLayers])

  useEffect(() => {
    const canvas = fluidCanvasRef.current
    const baseCanvas = fluidBaseCanvasRef.current
    const sim = save.simData
    if (!canvas || !baseCanvas || !sim || !size.width || !size.height || !viewportSize.width || !viewportSize.height) return
    if (canvas.width !== viewportPixelWidth) canvas.width = viewportPixelWidth
    if (canvas.height !== viewportPixelHeight) canvas.height = viewportPixelHeight
    if (baseCanvas.width !== viewportPixelWidth) baseCanvas.width = viewportPixelWidth
    if (baseCanvas.height !== viewportPixelHeight) baseCanvas.height = viewportPixelHeight
    const context = canvas.getContext('2d')
    const baseContext = baseCanvas.getContext('2d')
    if (!context || !baseContext) return
    context.imageSmoothingEnabled = false
    baseContext.imageSmoothingEnabled = false
    const view = new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength)
    const cellSize = renderCellSize
    const range = visibleMapRange(size.width, size.height, cellSize, originX, originY, canvas.width, canvas.height)
    const cellAt = (x: number, y: number) => cachedSimCell(sim, view, x + 1, y + 1)
    baseContext.clearRect(0, 0, baseCanvas.width, baseCanvas.height)
    context.clearRect(0, 0, canvas.width, canvas.height)
    const gasRendered = overlay === 'none' && visibleLayers.gas && oniWorldRenderer.renderGas({
      context: baseContext,
      width: size.width,
      height: size.height,
      cellSize,
      originX,
      originY,
      range,
      worldZones: cachedWorldZoneMap(sim),
      textures,
      maskSets: terrainMaskSets,
      cellAt,
      propertyCacheKey: sim.bytes,
      isTerrainMaskedAt: () => false,
      zoneColors: ONI_WORLD_ZONE_COLORS,
    })
    const liquidRendered = overlay === 'none' && visibleLayers.liquid && oniWorldRenderer.renderLiquid({
      context: baseContext,
      width: size.width,
      height: size.height,
      cellSize,
      originX,
      originY,
      range,
      worldZones: cachedWorldZoneMap(sim),
      textures,
      maskSets: terrainMaskSets,
      cellAt,
      propertyCacheKey: sim.bytes,
      isTerrainMaskedAt: () => false,
      zoneColors: ONI_WORLD_ZONE_COLORS,
    })
    if (overlay === 'none') {
      for (let canvasY = range.minRow; canvasY <= range.maxRow; canvasY++) {
        const y = size.height - 1 - canvasY
        for (let x = range.minX; x <= range.maxX; x++) {
          const cell = cellAt(x, y)
          if (!cell) continue
          const element = elementForHash(cell.elementHash)
          const isVisible = element.state === 'gas' && visibleLayers.gas || element.state === 'liquid' && visibleLayers.liquid
          if (!isVisible || !element.fluidMaterial || (element.state !== 'gas' && element.state !== 'liquid')) continue
          if (element.state === 'gas' && gasRendered) continue
          if (element.state === 'liquid') {
            if (!liquidRendered) {
              const above = cellAt(x, y + 1)
              const aboveState = above ? elementForHash(above.elementHash).state : undefined
              drawLiquidFallback(baseContext, element.fluidMaterial, cell, originX + x * cellSize, originY + canvasY * cellSize, cellSize, aboveState === 'liquid' || aboveState === 'solid')
            }
            continue
          }
          drawGasBase(baseContext, element.fluidMaterial, cell, originX + x * cellSize, originY + canvasY * cellSize, cellSize)
        }
      }
    }
  }, [cachedWorldZoneMap, originX, originY, overlay, renderCellSize, save, size.height, size.width, terrainMaskSets, textures, viewportPixelHeight, viewportPixelWidth, viewportSize.height, viewportSize.width, visibleLayers.gas, visibleLayers.liquid])

  useEffect(() => {
    const canvas = particleCanvasRef.current
    if (!canvas || !size.width || !size.height || !viewportSize.width || !viewportSize.height) return
    if (canvas.width !== viewportPixelWidth) canvas.width = viewportPixelWidth
    if (canvas.height !== viewportPixelHeight) canvas.height = viewportPixelHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (overlay !== 'none') return
    let cancelled = false
    void loadOniParticleTextures().then((particleTextures) => {
      if (cancelled) return
      context.clearRect(0, 0, canvas.width, canvas.height)
      drawOniSavedParticles(context, save, particleTextures, {
        worldHeight: size.height,
        cellSize: renderCellSize,
        originX,
        originY,
      })
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [originX, originY, overlay, renderCellSize, save, size.height, size.width, viewportPixelHeight, viewportPixelWidth, viewportSize.height, viewportSize.width])

  useEffect(() => {
    const canvas = lightCanvasRef.current
    const sim = save.simData
    if (!canvas || !sim || !size.width || !size.height || !viewportSize.width || !viewportSize.height) return
    if (canvas.width !== viewportPixelWidth) canvas.width = viewportPixelWidth
    if (canvas.height !== viewportPixelHeight) canvas.height = viewportPixelHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (overlay !== 'none') return
    const lights: OniLightInstance[] = []
    for (const group of save.manager?.groups ?? []) {
      const definition = oniLightDefinitionForTag(group.tag)
      if (!definition) continue
      for (const instance of group.instances) {
        if (!oniLightIsEnabled(instance, definition.requiresActive)) continue
        if (instance.position.x < 0 || instance.position.y < 0 || instance.position.x >= size.width || instance.position.y >= size.height) continue
        lights.push({ x: instance.position.x, y: instance.position.y, definition })
      }
    }
    const view = new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength)
    drawOniLightBuffer({
      context,
      lights,
      width: size.width,
      height: size.height,
      worldHeight: size.height,
      cellSize: renderCellSize,
      originX,
      originY,
      cellAt: (x, y) => cachedSimCell(sim, view, x + 1, y + 1),
    })
  }, [originX, originY, overlay, renderCellSize, save, size.height, size.width, viewportPixelHeight, viewportPixelWidth, viewportSize.height, viewportSize.width])

  useEffect(() => {
    const canvas = gridCanvasRef.current
    if (!canvas || !size.width || !size.height || !viewportSize.width || !viewportSize.height) return
    if (canvas.width !== viewportPixelWidth) canvas.width = viewportPixelWidth
    if (canvas.height !== viewportPixelHeight) canvas.height = viewportPixelHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (!visibleLayers.grid || displayCellSize < 3) return
    const range = visibleMapRange(size.width, size.height, renderCellSize, originX, originY, canvas.width, canvas.height)
    context.strokeStyle = 'rgba(237, 230, 207, .14)'
    context.lineWidth = Math.max(1, Math.ceil(renderCellSize / displayCellSize))
    context.beginPath()
    for (let x = range.minX; x <= range.maxX + 1; x++) {
      const position = originX + x * renderCellSize
      context.moveTo(position, 0)
      context.lineTo(position, canvas.height)
    }
    for (let y = range.minRow; y <= range.maxRow + 1; y++) {
      const position = originY + y * renderCellSize
      context.moveTo(0, position)
      context.lineTo(canvas.width, position)
    }
    context.stroke()
  }, [displayCellSize, originX, originY, renderCellSize, size.height, size.width, viewportPixelHeight, viewportPixelWidth, viewportSize.height, viewportSize.width, visibleLayers.grid])

  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas || !size.width || !size.height || !viewportSize.width || !viewportSize.height) return
    const cellSize = renderCellSize
    if (canvas.width !== viewportPixelWidth) canvas.width = viewportPixelWidth
    if (canvas.height !== viewportPixelHeight) canvas.height = viewportPixelHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, canvas.width, canvas.height)
    const range = visibleMapRange(size.width, size.height, cellSize, originX, originY, canvas.width, canvas.height)
    let patterns: ReturnType<typeof createElementPatterns> | undefined
    const sim = save.simData
    for (const preview of previewCells.values()) {
      const element = elementForHash(preview.elementHash)
      const px = originX + preview.x * cellSize
      const py = originY + (size.height - 1 - preview.y) * cellSize
      const baseCell = sim ? getWorldCell(sim, preview.x, preview.y) : undefined
      // Draft cells are not part of the SIMSAVE property textures, so the
      // original Water shader cannot render them faithfully. Liquid previews
      // remain transparent until those source properties exist.
      if (element.state === 'liquid') continue
      if (baseCell && element.state === 'gas' && element.fluidMaterial) {
        const previewCell: SimCell = { ...baseCell, elementHash: preview.elementHash }
        drawGasBase(context, element.fluidMaterial, previewCell, px, py, cellSize)
      } else {
        patterns ??= createElementPatterns(context, textures, cellSize, originX, originY + size.height * cellSize)
        context.fillStyle = patterns.get(element.texture ?? '') ?? element.color
        context.fillRect(px, py, cellSize, cellSize)
        context.strokeStyle = 'rgba(240, 208, 141, .8)'
        context.lineWidth = Math.max(1, Math.ceil(cellSize / 4))
        context.strokeRect(px + .5, py + .5, cellSize - 1, cellSize - 1)
      }
    }
    if (tool === 'fill' && !spacePan && brushCell && sim) {
      const fillCache = fillRegionCacheRef.current
      if (fillCache.bytes !== sim.bytes) {
        fillCache.bytes = sim.bytes
        fillCache.regions.clear()
      }
      const startIndex = brushCell.y * size.width + brushCell.x
      let fillCells = fillCache.regions.get(startIndex)
      if (!fillCells) {
        fillCells = floodFillCoordinates(sim, size.width, size.height, brushCell.x, brushCell.y)
        fillCells.forEach((cell) => fillCache.regions.set(cell.y * size.width + cell.x, fillCells!))
      }
      if (fillCells.length > 0) {
        const fillSet = new Set(fillCells.map((cell) => `${cell.x}:${cell.y}`))
        const fillPath = new Path2D()
        const boundaryPath = new Path2D()
        const inViewport = (cell: { x: number; y: number }) => {
          const canvasY = size.height - 1 - cell.y
          return cell.x >= range.minX && cell.x <= range.maxX && canvasY >= range.minRow && canvasY <= range.maxRow
        }
        fillCells.forEach((cell) => {
          if (!inViewport(cell)) return
          const px = originX + cell.x * cellSize
          const py = originY + (size.height - 1 - cell.y) * cellSize
          fillPath.rect(px, py, cellSize + .25, cellSize + .25)
          if (!fillSet.has(`${cell.x - 1}:${cell.y}`)) {
            boundaryPath.moveTo(px, py)
            boundaryPath.lineTo(px, py + cellSize)
          }
          if (!fillSet.has(`${cell.x + 1}:${cell.y}`)) {
            boundaryPath.moveTo(px + cellSize, py)
            boundaryPath.lineTo(px + cellSize, py + cellSize)
          }
          if (!fillSet.has(`${cell.x}:${cell.y - 1}`)) {
            boundaryPath.moveTo(px, py + cellSize)
            boundaryPath.lineTo(px + cellSize, py + cellSize)
          }
          if (!fillSet.has(`${cell.x}:${cell.y + 1}`)) {
            boundaryPath.moveTo(px, py)
            boundaryPath.lineTo(px + cellSize, py)
          }
        })
        context.save()
        context.fillStyle = 'rgba(240, 208, 141, .2)'
        context.fill(fillPath)
        context.strokeStyle = 'rgba(240, 208, 141, .9)'
        context.lineWidth = Math.max(1, Math.min(3, cellSize * .06))
        context.lineJoin = 'round'
        context.stroke(boundaryPath)
        context.restore()
      }
    }
    if (selectedCell) {
      context.strokeStyle = '#f0d08d'
      context.lineWidth = Math.max(1, Math.ceil(cellSize / 4))
      context.strokeRect(originX + selectedCell.x * cellSize + .5, originY + (size.height - 1 - selectedCell.y) * cellSize + .5, cellSize - 1, cellSize - 1)
    }
    const brushTool = tool === 'paint' || tool === 'erase' || tool === 'line'
    if (brushTool && !spacePan && brushCell) {
      const radius = Math.floor(brushSize / 2)
      const left = originX + (brushCell.x - radius) * cellSize
      const top = originY + (size.height - 1 - brushCell.y - radius) * cellSize
      const brushPixels = brushSize * cellSize
      context.fillStyle = tool === 'erase' ? 'rgba(255, 226, 196, .16)' : 'rgba(240, 208, 141, .18)'
      context.strokeStyle = tool === 'erase' ? '#f3c59e' : '#f0d08d'
      context.lineWidth = Math.max(1, Math.min(3, cellSize * .08))
      context.fillRect(left, top, brushPixels, brushPixels)
      context.strokeRect(left + context.lineWidth / 2, top + context.lineWidth / 2, brushPixels - context.lineWidth, brushPixels - context.lineWidth)
    }
    if (!brushTool && tool !== 'move' && !spacePan && !isSelecting && brushCell) {
      const left = originX + brushCell.x * cellSize
      const top = originY + (size.height - 1 - brushCell.y) * cellSize
      const hoverColor = tool === 'eyedropper' ? '#8cebf1' : '#f0d08d'
      context.save()
      context.fillStyle = tool === 'eyedropper' ? 'rgba(140, 235, 241, .12)' : 'rgba(240, 208, 141, .1)'
      context.strokeStyle = hoverColor
      context.lineWidth = Math.max(1, Math.min(3, cellSize * .08))
      context.setLineDash(tool === 'eyedropper' ? [Math.max(2, cellSize * .18), Math.max(2, cellSize * .12)] : [])
      context.fillRect(left, top, cellSize, cellSize)
      context.strokeRect(left + context.lineWidth / 2, top + context.lineWidth / 2, cellSize - context.lineWidth, cellSize - context.lineWidth)
      context.restore()
    }
  }, [brushCell, brushSize, isSelecting, originX, originY, pan.x, pan.y, previewCells, previewVersion, renderCellSize, save, selectedCell, size.height, size.width, spacePan, textures, tool, viewportPixelHeight, viewportPixelWidth, viewportSize.height, viewportSize.width, visibleLayers.ground])

  const canvasStyle = {
    width: '100%',
    height: '100%',
  }
  const mapBackgroundStyle = {
    '--map-space-background': `url("${assetPath('/assets/background/space_bg.png')}")`,
    '--map-starfield-background': `url("${assetPath('/assets/background/starfield.png')}")`,
  } as CSSProperties

  const loadMapImage = (path: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`无法加载地图背景：${path}`))
    image.src = assetPath(path)
  })

  const paintMapBackground = (context: CanvasRenderingContext2D, width: number, height: number, spaceBackground: HTMLImageElement, starfield: HTMLImageElement) => {
    context.fillStyle = '#090d16'
    context.fillRect(0, 0, width, height)
    const coverScale = Math.max(width / spaceBackground.naturalWidth, height / spaceBackground.naturalHeight)
    const coverWidth = spaceBackground.naturalWidth * coverScale
    const coverHeight = spaceBackground.naturalHeight * coverScale
    context.globalAlpha = .86
    context.drawImage(spaceBackground, (width - coverWidth) / 2, (height - coverHeight) / 2, coverWidth, coverHeight)
    context.globalCompositeOperation = 'screen'
    context.globalAlpha = .2
    for (let y = -starfield.naturalHeight; y < height; y += starfield.naturalHeight) {
      for (let x = -starfield.naturalWidth; x < width; x += starfield.naturalWidth) {
        context.drawImage(starfield, x, y)
      }
    }
    context.globalCompositeOperation = 'source-over'
    context.globalAlpha = 1
    context.imageSmoothingEnabled = false
  }

  const drawMapWatermark = (context: CanvasRenderingContext2D, width: number, height: number) => {
    const scale = Math.max(1, Math.min(3, Math.max(width, height) / 1600))
    const padding = 14 * scale
    const lineHeight = 14 * scale
    const title = '缺氧存档编辑器'
    const seed = `地图种子 ${mapCoordinate ?? (mapSeed === undefined ? '未知' : mapSeed)}`
    const textRight = width - padding - 12 * scale
    context.save()
    context.font = `600 ${12 * scale}px "Microsoft YaHei", sans-serif`
    const titleWidth = context.measureText(title).width
    context.font = `${9 * scale}px Consolas, monospace`
    const linkWidth = context.measureText(MAP_EDITOR_URL).width
    const seedWidth = context.measureText(seed).width
    const boxWidth = Math.max(titleWidth, linkWidth, seedWidth) + 24 * scale
    const boxHeight = 12 * scale + lineHeight * 3 + 12 * scale
    const boxLeft = Math.max(8 * scale, width - boxWidth - padding)
    const boxTop = Math.max(8 * scale, height - boxHeight - padding)
    context.fillStyle = 'rgba(8, 12, 18, .78)'
    context.fillRect(boxLeft, boxTop, boxWidth, boxHeight)
    context.strokeStyle = 'rgba(240, 208, 141, .38)'
    context.lineWidth = Math.max(1, scale)
    context.strokeRect(boxLeft + context.lineWidth / 2, boxTop + context.lineWidth / 2, boxWidth - context.lineWidth, boxHeight - context.lineWidth)
    context.textAlign = 'right'
    context.textBaseline = 'middle'
    context.font = `600 ${12 * scale}px "Microsoft YaHei", sans-serif`
    context.fillStyle = '#fff4d6'
    context.fillText(title, textRight, boxTop + 15 * scale)
    context.font = `${9 * scale}px Consolas, monospace`
    context.fillStyle = 'rgba(255, 244, 214, .72)'
    context.fillText(MAP_EDITOR_URL, textRight, boxTop + 15 * scale + lineHeight)
    context.fillStyle = 'rgba(255, 244, 214, .88)'
    context.fillText(seed, textRight, boxTop + 15 * scale + lineHeight * 2)
    context.restore()
  }

  const downloadMapCanvas = async (canvas: HTMLCanvasElement, fileName: string) => {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const exportCurrentMapImage = async () => {
    const baseCanvas = canvasRef.current
    const backgroundCanvas = backgroundCanvasRef.current
    const entityBackCanvas = entityBackCanvasRef.current
    const entityFrontCanvas = entityFrontCanvasRef.current
    const gasBaseCanvas = fluidBaseCanvasRef.current
    const gasCanvas = fluidCanvasRef.current
    const particleCanvas = particleCanvasRef.current
    const lightCanvas = lightCanvasRef.current
    const gridCanvas = gridCanvasRef.current
    if (!baseCanvas || !backgroundCanvas || !entityBackCanvas || !entityFrontCanvas || !gasBaseCanvas || !gasCanvas || !particleCanvas || !lightCanvas || !gridCanvas || !baseCanvas.width || !baseCanvas.height) return
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = baseCanvas.width
    exportCanvas.height = baseCanvas.height
    const context = exportCanvas.getContext('2d')
    if (!context) return
    try {
      const [spaceBackground, starfield] = await Promise.all([
        loadMapImage('/assets/background/space_bg.png'),
        loadMapImage('/assets/background/starfield.png'),
      ])
      paintMapBackground(context, exportCanvas.width, exportCanvas.height, spaceBackground, starfield)
      context.drawImage(backgroundCanvas, 0, 0)
      context.drawImage(entityBackCanvas, 0, 0)
      context.drawImage(gasBaseCanvas, 0, 0)
      context.drawImage(gasCanvas, 0, 0)
      context.drawImage(baseCanvas, 0, 0)
      context.drawImage(entityFrontCanvas, 0, 0)
      context.drawImage(particleCanvas, 0, 0)
      context.drawImage(lightCanvas, 0, 0)
      context.drawImage(gridCanvas, 0, 0)
      drawMapWatermark(context, exportCanvas.width, exportCanvas.height)
      await downloadMapCanvas(exportCanvas, '缺氧地图-当前视图.png')
    } catch {
      return
    }
  }

  const exportPanoramaImage = async () => {
    const sim = save.simData
    if (!sim || !size.width || !size.height) return
    const exportCellSize = Math.max(1, Math.min(PANORAMA_CELL_PIXELS, Math.floor(16000 / Math.max(size.width, size.height))))
    const exportWidth = size.width * exportCellSize
    const exportHeight = size.height * exportCellSize
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = exportWidth
    exportCanvas.height = exportHeight
    const context = exportCanvas.getContext('2d')
    if (!context) return

    try {
      const [spaceBackground, starfield, ...loadedBiomeBackgrounds] = await Promise.all([
        loadMapImage('/assets/background/space_bg.png'),
        loadMapImage('/assets/background/starfield.png'),
        ...Array.from({ length: 19 }, (_, textureIndex) => loadMapImage(biomeBackgroundAsset(textureIndex))),
      ])
      paintMapBackground(context, exportWidth, exportHeight, spaceBackground, starfield)

      const view = new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength)
      const worldZones = cachedWorldZoneMap(sim)
      const exportBiomeBackgrounds: Record<number, HTMLImageElement> = { ...biomeBackgrounds }
      loadedBiomeBackgrounds.forEach((image, textureIndex) => { exportBiomeBackgrounds[textureIndex] = image })
      const originX = 0
      const originY = 0
      const cellSize = exportCellSize
      const fullRange = { minX: 0, maxX: size.width - 1, minRow: 0, maxRow: size.height - 1 }
      if (visibleLayers.biome) {
        oniWorldRenderer.renderBiome({
          context,
          worldZones,
          width: size.width,
          height: size.height,
          cellSize,
          originX,
          originY,
          range: fullRange,
          backgrounds: exportBiomeBackgrounds,
        })
      }
      const patterns = createElementPatterns(context, textures, cellSize, originX, originY + size.height * cellSize)
      const visibleGrid = worldGrid(save, 'GridVisible')?.bytes
      const spawnableGrid = worldGrid(save, 'GridSpawnable')?.bytes
      const damageGrid = worldGrid(save, 'GridDamage')?.bytes
      const terrainMaskedCells = terrainMaskedCellsByBuilding(save)
      for (const cells of blockTileCellsByGroup(save).values()) {
        for (const key of cells) terrainMaskedCells.add(key)
      }
      const isTerrainMaskedAt = (x: number, y: number) => terrainMaskedCells.has(blockTileCellKey(x, y))
      const cellAt = (x: number, y: number) => cachedSimCell(sim, view, x + 1, y + 1)
      const simIndexAt = (x: number, y: number) => (y + 1) * sim.width + x + 1
      const damageView = damageGrid ? new DataView(damageGrid.buffer, damageGrid.byteOffset, damageGrid.byteLength) : undefined
      const damageAt = (x: number, y: number) => {
        const offset = (y * size.width + x) * 4
        return damageView && offset >= 0 && offset + 4 <= damageView.byteLength ? damageView.getFloat32(offset, true) : 0
      }
      const hasBackwallAt = (x: number, y: number) => {
        const backwall = readSimBackwall(sim, view, x + 1, y + 1)
        return backwall ? elementForHash(backwall.elementHash).state === 'solid' : false
      }
      const gasRendered = overlay === 'none' && visibleLayers.gas && oniWorldRenderer.renderGas({
        context,
        width: size.width,
        height: size.height,
        cellSize,
        originX,
        originY,
        range: fullRange,
        worldZones,
        textures,
        maskSets: terrainMaskSets,
        cellAt,
        propertyCacheKey: sim.bytes,
        isTerrainMaskedAt,
        damageAt,
        hasBackwallAt,
        zoneColors: ONI_WORLD_ZONE_COLORS,
      })
      const liquidRendered = overlay === 'none' && visibleLayers.liquid && oniWorldRenderer.renderLiquid({
        context,
        width: size.width,
        height: size.height,
        cellSize,
        originX,
        originY,
        range: fullRange,
        worldZones,
        textures,
        maskSets: terrainMaskSets,
        cellAt,
        propertyCacheKey: sim.bytes,
        isTerrainMaskedAt,
        damageAt,
        hasBackwallAt,
        zoneColors: ONI_WORLD_ZONE_COLORS,
      })

      // Data overlays must remain above terrain. In the normal view terrain is
      // emitted after fluid/backwall passes, matching Ground (29) over Liquid
      // (29); overlay views render terrain first and paint their data last.
      if (visibleLayers.ground && overlay !== 'none') {
        oniWorldRenderer.renderTerrain({
          context,
          width: size.width,
          height: size.height,
          cellSize,
          originX,
          originY,
          range: fullRange,
          worldZones,
          textures,
          maskSets: terrainMaskSets,
          cellAt,
          isTerrainMaskedAt,
          damageAt,
          hasBackwallAt,
          zoneColors: ONI_WORLD_ZONE_COLORS,
        })
      }

      // Render every cell at export resolution. This does not depend on the current
      // viewport, zoom, device pixel ratio, selection, or brush preview.
      for (let canvasY = 0; canvasY < size.height; canvasY++) {
        const y = size.height - 1 - canvasY
        for (let x = 0; x < size.width; x++) {
          const cell = cellAt(x, y)
          if (!cell) continue
          const element = elementForHash(cell.elementHash)
          const px = originX + x * cellSize
          const py = originY + canvasY * cellSize
          const backwall = readSimBackwall(sim, view, x + 1, y + 1)
          const backwallPresent = backwall ? elementForHash(backwall.elementHash).state === 'solid' : false
          if (visibleLayers.backwall && backwallPresent) {
            context.fillStyle = 'rgba(185, 164, 132, .55)'
            context.fillRect(px, py, cellSize, cellSize)
          }
          const isSolid = element.state === 'solid'
          const elementLayerVisible = element.state === 'solid' && visibleLayers.ground
            || element.state === 'liquid' && visibleLayers.liquid
            || element.state === 'gas' && visibleLayers.gas
          if (!isSolid) {
            const showElement = element.state === 'special' || elementLayerVisible
            if (element.state === 'gas' && gasRendered) continue
            if (element.state === 'liquid' && liquidRendered) continue
            if (showElement && element.state === 'liquid' && element.fluidMaterial) {
              const above = cellAt(x, y + 1)
              const aboveState = above ? elementForHash(above.elementHash).state : undefined
              drawLiquidFallback(context, element.fluidMaterial, cell, px, py, cellSize, aboveState === 'liquid' || aboveState === 'solid')
            } else if (showElement && element.state === 'gas' && element.fluidMaterial) {
              drawGasBase(context, element.fluidMaterial, cell, px, py, cellSize)
            } else if (showElement) {
              context.fillStyle = patterns.get(element.texture ?? '') ?? element.color
              context.fillRect(px, py, cellSize, cellSize)
            }
          }
          if (overlay === 'temperature') {
            context.fillStyle = temperatureColor(cell.temperature)
            context.globalAlpha = .72
            context.fillRect(px, py, cellSize, cellSize)
            context.globalAlpha = 1
          } else if (overlay === 'mass') {
            const intensity = Math.min(1, Math.log10(1 + Math.max(0, cell.mass)) / 2.2)
            context.fillStyle = `rgba(117, 171, 191, ${0.12 + intensity * 0.88})`
            context.fillRect(px, py, cellSize, cellSize)
          } else if (overlay === 'visibility') {
            const value = visibleGrid?.[y * size.width + x] ?? 0
            context.fillStyle = value > 0 ? `rgba(127, 169, 212, ${.2 + value / 255 * .72})` : 'rgba(16, 23, 25, .84)'
            context.fillRect(px, py, cellSize, cellSize)
          } else if (overlay === 'spawnable') {
            const value = spawnableGrid?.[y * size.width + x] ?? 0
            context.fillStyle = value > 0 ? `rgba(112, 157, 123, ${.2 + value / 255 * .72})` : 'rgba(16, 23, 25, .84)'
            context.fillRect(px, py, cellSize, cellSize)
          } else if (overlay === 'damage') {
            const damageValue = Math.max(0, Math.min(1, damageAt(x, y)))
            context.fillStyle = damageValue > 0 ? `rgba(198, 123, 113, ${.2 + damageValue * .72})` : 'rgba(16, 23, 25, .84)'
            context.fillRect(px, py, cellSize, cellSize)
          } else if (overlay === 'disease') {
            const diseaseOffset = sim.diseaseOffset + simIndexAt(x, y) * SIM_DISEASE_SIZE
            let diseaseLevel = 0
            for (let index = 0; index < SIM_DISEASE_SIZE; index++) diseaseLevel += sim.bytes[diseaseOffset + index]
            const intensity = Math.min(.9, .12 + diseaseLevel / 2040)
            context.fillStyle = diseaseLevel > 0 ? `rgba(194, 102, 111, ${intensity})` : 'rgba(16, 23, 25, .84)'
            context.fillRect(px, py, cellSize, cellSize)
          }
        }
      }

      if (visibleLayers.ground && overlay === 'none') {
        oniWorldRenderer.renderTerrain({
          context,
          width: size.width,
          height: size.height,
          cellSize,
          originX,
          originY,
          range: fullRange,
          worldZones,
          textures,
          maskSets: terrainMaskSets,
          cellAt,
          isTerrainMaskedAt,
          damageAt,
          hasBackwallAt,
          zoneColors: ONI_WORLD_ZONE_COLORS,
        })
      }

      context.save()
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      context.fillStyle = '#e4b067'
      if (visibleLayers.minions || mapEntityLayersAreVisible(visibleLayers)) {
        const utilityCells = buildUtilityCellMap(save)
        const tileCells = blockTileCellsByGroup(save)
        for (const { group, instance } of mapObjectsInRenderOrder(save)) {
          const sceneLayer = mapObjectSceneLayer(group)
          if (group.tag === 'Minion') {
            if (!visibleLayers.minions) continue
            const minionX = Math.round(instance.position.x)
            const minionY = Math.round(size.height - 1 - instance.position.y)
            if (minionX >= 0 && minionY >= 0 && minionX < size.width && minionY < size.height) {
              const anchor = mapObjectAnchor(instance.position.x, instance.position.y, size.height, cellSize, originX, originY)
              if (minionKanimAssets) {
                drawMinionKanim(context, minionKanimAssets, minionAccessoryGuids(instance), minionWearableAnimNames(instance), cellSize, anchor.x, anchor.y, minionFacesLeft(instance))
              } else {
                context.fillRect(originX + minionX * cellSize + 1, originY + minionY * cellSize + 1, Math.max(1, cellSize - 2), Math.max(1, cellSize - 2))
              }
            }
            continue
          }
          const blockTileTexture = blockTileTextureForTag(group.tag)
          const blockTileCells = blockTileTexture ? tileCells.get(group) : undefined
          const utilityTexture = utilityTextureForTag(group.tag)
          const utilityFamily = utilityFamilyForTag(group.tag)
          const isBuilding = hasSimpleComponent(instance, 'BuildingComplete')
          const geyserTexture = geyserTextureForTag(group.tag)
          const buildingTexture = buildingTextureForInstance(group.tag, instance, generatedBuildingDefinitions)
          const isGeyser = isGeyserInstance(group.tag, instance, geyserTexture)
          const isCreature = sceneLayer === ONI_SCENE_LAYER_ORDER.Creatures
          if (!isBuilding && !isGeyser && !buildingTexture && !blockTileTexture && !utilityTexture) continue
          if (!mapEntityLayerIsVisible(visibleLayers, isGeyser, isCreature, utilityFamily)) continue
          const x = Math.floor(instance.position.x)
          const y = Math.floor(instance.position.y)
          const canvasY = size.height - 1 - y
          if (x < 0 || canvasY < 0 || x >= size.width || canvasY >= size.height) continue
          const px = originX + x * cellSize
          const py = originY + canvasY * cellSize
          if (utilityTexture) {
            const image = buildingTextures[utilityTexture.path]
            if (image) {
              const connections = utilityDisplayConnections(utilityCells, utilityFamily!, instance, x, y)
              const anchor = mapObjectAnchor(instance.position.x, instance.position.y, size.height, cellSize, originX, originY)
              drawUtilityTile(context, image, utilityTexture, connections, anchor.x, anchor.y, cellSize)
            }
          } else if (blockTileTexture) {
            const connectionBits = blockTileConnectionBits(
              (neighbourX, neighbourY) => blockTileCells?.has(blockTileCellKey(neighbourX, neighbourY)) ?? false,
              x,
              y,
            )
            const image = buildingTextures[blockTileTexture.path]
            if (image) {
              drawBlockTile(context, image, connectionBits, px, py, cellSize)
            }
          } else if (isGeyser && !buildingTexture) {
              const centerX = originX + instance.position.x * cellSize
              const centerY = originY + (size.height - instance.position.y - .5) * cellSize
              const image = geyserTexture ? geyserTextures[geyserTexture.path] : undefined
              if (image && geyserTexture) {
                drawGeyserTexture(context, image, geyserTexture, cellSize, centerX, centerY)
              } else {
                const fallbackX = px + cellSize / 2
                const fallbackY = py + cellSize / 2
                const radius = Math.max(2, cellSize * .34)
                context.fillStyle = 'rgba(112, 190, 203, .9)'
                context.strokeStyle = '#e8d096'
                context.lineWidth = Math.max(1, Math.ceil(cellSize / 8))
                context.beginPath()
                context.arc(fallbackX, fallbackY, radius, 0, Math.PI * 2)
                context.fill()
                context.stroke()
                context.fillStyle = '#2a5965'
                context.fillRect(fallbackX - Math.max(1, cellSize * .08), fallbackY - Math.max(1, cellSize * .08), Math.max(2, cellSize * .16), Math.max(2, cellSize * .16))
              }
          } else if (buildingTexture) {
            const image = buildingTextures[buildingTexture.path]
            if (image) {
              const anchor = mapObjectAnchor(instance.position.x, instance.position.y, size.height, cellSize, originX, originY)
              drawGeyserTexture(context, image, buildingTexture, cellSize, anchor.x, anchor.y, instanceOrientation(instance), rotatableVisualizerForTag(group.tag))
            }
          }
        }
      }
      context.restore()
      if (overlay === 'none') {
        const particleTextures = await loadOniParticleTextures()
        drawOniSavedParticles(context, save, particleTextures, { worldHeight: size.height, cellSize, originX, originY })
        const lights: OniLightInstance[] = []
        for (const group of save.manager?.groups ?? []) {
          const definition = oniLightDefinitionForTag(group.tag)
          if (!definition) continue
          for (const instance of group.instances) {
            if (!oniLightIsEnabled(instance, definition.requiresActive)) continue
            if (instance.position.x < 0 || instance.position.y < 0 || instance.position.x >= size.width || instance.position.y >= size.height) continue
            lights.push({ x: instance.position.x, y: instance.position.y, definition })
          }
        }
        drawOniLightBuffer({ context, lights, width: size.width, height: size.height, worldHeight: size.height, cellSize, originX, originY, cellAt })
      }
      drawMapWatermark(context, exportWidth, exportHeight)
      await downloadMapCanvas(exportCanvas, `缺氧地图-全景-${exportCellSize}px.png`)
    } catch {
      return
    }
  }

  const activeSelectionBounds = selection ? normalizedSelection(selection) : undefined
  const updateSelectionDraftOverlay = (draft: MapSelection | null) => {
    const node = selectionDraftOverlayRef.current
    if (!node) return
    if (!draft) {
      node.hidden = true
      return
    }
    const bounds = normalizedSelection(draft)
    node.hidden = false
    node.style.left = `${originX / devicePixelRatio + bounds.minX * displayCellSize}px`
    node.style.top = `${originY / devicePixelRatio + (size.height - 1 - bounds.maxY) * displayCellSize}px`
    node.style.width = `${bounds.width * displayCellSize}px`
    node.style.height = `${bounds.height * displayCellSize}px`
    const showLabel = bounds.width * displayCellSize >= 52 && bounds.height * displayCellSize >= 34
    const label = node.querySelector<HTMLElement>('.map-selection-label')
    if (label) label.hidden = !showLabel
    if (showLabel) {
      if (selectionDraftTitleRef.current) selectionDraftTitleRef.current.textContent = `${bounds.width}×${bounds.height}`
      if (selectionDraftCountRef.current) selectionDraftCountRef.current.textContent = `${bounds.cells.toLocaleString()}格`
    }
  }

  return <div
    ref={viewportRef}
    style={mapBackgroundStyle}
    className={`canvas-frame canvas-viewport ${isPanning ? 'is-panning' : ''} ${isSelecting ? 'is-selecting' : ''} ${spacePan ? 'is-space-pan' : ''} ${tool === 'inspect' ? 'is-select-mode' : ''} ${tool !== 'inspect' && tool !== 'move' ? 'is-brush-mode' : ''}`}
    onWheel={(event) => { event.preventDefault(); event.stopPropagation(); queueWheelZoom(event.deltaY < 0 ? 5 : -5, event.clientX, event.clientY) }}
    onPointerDown={(event) => {
      if (event.button !== 0 && event.button !== 1) return
      if (event.button === 1) event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      const temporaryPan = event.button === 1 || spacePanRef.current
      const mode = temporaryPan || tool === 'move' ? 'pan' : tool === 'inspect' ? 'select' : tool === 'paint' || tool === 'erase' ? 'brush' : tool === 'rectangle' || tool === 'line' ? 'shape' : 'point'
      const startCell = pointToCell(event.clientX, event.clientY) ?? null
      pointerRef.current = { mode, startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y, moved: false, lastCell: null, startCell }
      if (mode === 'brush') {
        visitedBrushCellsRef.current.clear()
        onStrokeStart()
        const cell = startCell
        if (cell) {
          const key = `${cell.x}:${cell.y}`
          visitedBrushCellsRef.current.add(key)
          pointerRef.current.lastCell = cell
          onCell(cell.x, cell.y)
        }
      } else if (mode === 'shape') {
        onStrokeStart()
        if (startCell) onShape(startCell, startCell)
      } else if (mode === 'point') {
        if (startCell) onCell(startCell.x, startCell.y)
      } else if (mode === 'select') {
        onSelectionChange(null)
        if (startCell) {
          selectionDraftRef.current = { start: startCell, end: startCell }
          updateSelectionDraftOverlay(selectionDraftRef.current)
          setIsSelecting(true)
        } else {
          selectionDraftRef.current = null
          updateSelectionDraftOverlay(null)
          setIsSelecting(false)
        }
      } else {
        if (canvasLayerRef.current) canvasLayerRef.current.style.transform = 'translate3d(0, 0, 0)'
        setIsPanning(true)
      }
    }}
    onPointerMove={(event) => {
      const pointer = pointerRef.current
      const cell = pointToCell(event.clientX, event.clientY) ?? null
      const cursorTool = tool !== 'move'
      if (cursorTool && !spacePanRef.current && pointer?.mode !== 'pan') updateBrushCell(cell)
      else updateBrushCell(null)
      if (!pointer) return
      if (pointer.mode === 'brush') {
        if (!cell) return
        const path = pointer.lastCell ? lineCells(pointer.lastCell, cell, 1, size.width, size.height) : [cell]
        path.forEach((point) => {
          const key = `${point.x}:${point.y}`
          if (visitedBrushCellsRef.current.has(key)) return
          visitedBrushCellsRef.current.add(key)
          onCell(point.x, point.y)
        })
        pointer.lastCell = cell
        return
      }
      if (pointer.mode === 'shape') {
        if (cell && pointer.startCell) onShape(pointer.startCell, cell)
        return
      }
      if (pointer.mode === 'select') {
        const dx = event.clientX - pointer.startX
        const dy = event.clientY - pointer.startY
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) pointer.moved = true
        if (pointer.moved && pointer.startCell && cell) {
          const currentDraft = selectionDraftRef.current
          if (currentDraft?.start.x !== pointer.startCell.x || currentDraft.start.y !== pointer.startCell.y || currentDraft.end.x !== cell.x || currentDraft.end.y !== cell.y) {
            selectionDraftRef.current = { start: pointer.startCell, end: cell }
            updateSelectionDraftOverlay(selectionDraftRef.current)
          }
        }
        return
      }
      if (pointer.mode === 'point') return
      const dx = event.clientX - pointer.startX
      const dy = event.clientY - pointer.startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) pointer.moved = true
      if (pointer.moved && canvasLayerRef.current) {
        canvasLayerRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
      }
    }}
    onPointerUp={(event) => {
      const pointer = pointerRef.current
      if (pointer?.mode === 'select') {
        const endCell = pointToCell(event.clientX, event.clientY) ?? selectionDraftRef.current?.end ?? pointer.startCell
        if (!pointer.moved && pointer.startCell) {
          onSelectionChange(null)
          onCell(pointer.startCell.x, pointer.startCell.y)
        } else if (pointer.moved && pointer.startCell && endCell) {
          onSelectionChange({ start: pointer.startCell, end: endCell })
        }
        selectionDraftRef.current = null
        updateSelectionDraftOverlay(null)
        setIsSelecting(false)
      }
      if (pointer?.mode === 'brush' || pointer?.mode === 'shape') onStrokeEnd()
      if (pointer?.mode === 'pan' && pointer.moved) {
        const dx = event.clientX - pointer.startX
        const dy = event.clientY - pointer.startY
        setPan({ x: pointer.panX + dx, y: pointer.panY + dy })
      }
      if (canvasLayerRef.current) canvasLayerRef.current.style.transform = 'translate3d(0, 0, 0)'
      pointerRef.current = null
      visitedBrushCellsRef.current.clear()
      setIsPanning(false)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }}
    onPointerLeave={() => { if (!pointerRef.current) updateBrushCell(null) }}
    onPointerCancel={() => { if (pointerRef.current?.mode === 'brush' || pointerRef.current?.mode === 'shape') onStrokeEnd(); if (canvasLayerRef.current) canvasLayerRef.current.style.transform = 'translate3d(0, 0, 0)'; pointerRef.current = null; selectionDraftRef.current = null; visitedBrushCellsRef.current.clear(); updateBrushCell(null); updateSelectionDraftOverlay(null); setIsSelecting(false); setIsPanning(false) }}
  >
    <div ref={canvasLayerRef} className="canvas-layer">
      <canvas ref={backgroundCanvasRef} className="canvas-background" style={canvasStyle} aria-hidden="true" />
      <canvas
        className="canvas-terrain"
        ref={canvasRef}
        style={canvasStyle}
      />
      <canvas ref={entityBackCanvasRef} className="canvas-entities-back" style={canvasStyle} aria-hidden="true" />
      <canvas
        ref={entityFrontCanvasRef}
        className="canvas-entities-front"
        style={canvasStyle}
        aria-hidden="true"
        data-minion-kanim={minionKanimAssets ? 'ready' : 'loading'}
      />
      <canvas ref={fluidBaseCanvasRef} className="canvas-fluid-base" style={canvasStyle} aria-hidden="true" />
      <canvas ref={fluidCanvasRef} className="canvas-fluid" style={canvasStyle} aria-hidden="true" />
      <canvas ref={particleCanvasRef} className="canvas-particles" style={canvasStyle} aria-hidden="true" />
      <canvas ref={lightCanvasRef} className="canvas-light" style={canvasStyle} aria-hidden="true" />
      <canvas ref={gridCanvasRef} className="canvas-grid" style={canvasStyle} aria-hidden="true" />
      <canvas ref={overlayRef} className="canvas-overlay" style={canvasStyle} aria-hidden="true" />
      {activeSelectionBounds && <div
        className="map-selection-overlay"
        style={{
          left: `${originX / devicePixelRatio + activeSelectionBounds.minX * displayCellSize}px`,
          top: `${originY / devicePixelRatio + (size.height - 1 - activeSelectionBounds.maxY) * displayCellSize}px`,
          width: `${activeSelectionBounds.width * displayCellSize}px`,
          height: `${activeSelectionBounds.height * displayCellSize}px`,
        }}
      >
        {activeSelectionBounds.width * displayCellSize >= 52 && activeSelectionBounds.height * displayCellSize >= 34 && <span className="map-selection-label"><strong>{activeSelectionBounds.width}×{activeSelectionBounds.height}</strong><small>{activeSelectionBounds.cells.toLocaleString()}格</small></span>}
      </div>}
      <div ref={selectionDraftOverlayRef} className="map-selection-overlay is-draft" hidden aria-hidden="true">
        <span className="map-selection-label" hidden><strong ref={selectionDraftTitleRef} /><small ref={selectionDraftCountRef} /></span>
      </div>
    </div>
    <div className="canvas-controls" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" title="缩小地图" aria-label="缩小地图" onClick={() => setZoomPercentAround(zoomPercent - 10)}><Minus size={15} /></button>
      <input type="range" min="0" max="100" step="1" value={zoomPercent} aria-label="地图缩放" onChange={(event) => setZoomPercentAround(Number(event.target.value))} />
      <output>{zoomPercent}</output>
      <button type="button" title="放大地图" aria-label="放大地图" onClick={() => setZoomPercentAround(zoomPercent + 10)}><Plus size={15} /></button>
      <button type="button" className="canvas-reset" title="重置视图" aria-label="重置视图" onClick={focusVisibleMap}>适配</button>
      <button type="button" title="导出当前地图视图" aria-label="导出当前地图视图" onClick={() => { void exportCurrentMapImage() }}><Download size={15} /></button>
      <button type="button" title="导出整张高清全景地图" aria-label="导出整张高清全景地图" onClick={() => { void exportPanoramaImage() }}><Maximize2 size={15} /></button>
    </div>
  </div>
}

function temperatureColor(kelvin: number): string {
  const celsius = kelvin - 273.15
  const hue = Math.max(0, Math.min(220, 220 - (celsius + 40) * 0.75))
  const lightness = Math.max(30, Math.min(70, 46 + Math.abs(celsius - 20) * 0.04))
  return `hsl(${hue} 58% ${lightness}%)`
}

function DupesView({ save, updateSave, onOpenObject }: { save: ParsedSave; updateSave: (update: (save: ParsedSave) => void) => void; onOpenObject: (index: number) => void }) {
  const group = groupByTag(save, 'Minion')
  const rows = groupRows(group)
  const [selected, setSelected] = useState(0)
  const [minionKanimAssets, setMinionKanimAssets] = useState<MinionKanimAssets | null>(null)
  const minionWearableNames = useMemo(() => saveMinionWearableAnimNames(save), [save])
  const active = rows[selected]
  useEffect(() => {
    let active = true
    void loadMinionKanimAssets(minionWearableNames).then((assets) => { if (active) setMinionKanimAssets(assets) }).catch(() => {})
    return () => { active = false }
  }, [minionWearableNames])
  return (
    <div className="view-stack">
      <div className="view-intro"><div><p>已解析的殖民者实例</p><strong>{rows.length} 名复制人</strong></div><button className="button button-quiet" type="button" onClick={() => onOpenObject(selected)}><Boxes size={15} />打开对象详情</button></div>
      <section className="surface dupes-layout">
        <div className="dupe-list">
          <div className="list-head"><span>复制人</span><span>位置</span></div>
          {rows.map((row) => <button key={row.index} className={`dupe-row ${active?.index === row.index ? 'selected' : ''}`} type="button" onClick={() => setSelected(row.index)}><MinionAvatar instance={row.instance} assets={minionKanimAssets} fallback={row.name.slice(0, 1)} /><span className="dupe-name"><strong>{row.name}</strong><small>Minion #{row.index + 1}</small></span><span className="dupe-pos">{formatNumber(row.position.x, 1)}, {formatNumber(row.position.y, 1)}</span><ChevronRight size={15} /></button>)}
        </div>
        {active && <DupeInspector instance={active.instance} updateSave={updateSave} />}
      </section>
    </div>
  )
}

function MinionAvatar({ instance, assets, fallback }: { instance: SavedObjectInstance; assets: MinionKanimAssets | null; fallback: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !assets) return
    const ratio = Math.max(1, window.devicePixelRatio || 1)
    canvas.width = Math.round(64 * ratio)
    canvas.height = Math.round(64 * ratio)
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    drawMinionKanim(context, assets, minionAccessoryGuids(instance), minionWearableAnimNames(instance), 28 * ratio, 32 * ratio, 53 * ratio, minionFacesLeft(instance))
  }, [assets, instance])
  return <span className="dupe-avatar" data-kanim={assets ? 'ready' : 'loading'}>
    {assets ? <canvas ref={canvasRef} aria-hidden="true" /> : fallback}
  </span>
}

function DupeInspector({ instance, updateSave }: { instance: SavedObjectInstance; updateSave: (update: (save: ParsedSave) => void) => void }) {
  const identity = component(instance, 'MinionIdentity')?.value
  const health = scalarNumber(member(component(instance, 'Health')?.value, 'canBeIncapacitated')?.value)
  const temperature = scalarNumber(member(component(instance, 'PrimaryElement')?.value, '_Temperature')?.value)
  const edit = (memberName: string, text: string) => updateSave(() => { const value = member(component(instance, 'MinionIdentity')?.value, memberName)?.value; if (value) setValueFromText(value, text) })
  return <aside className="dupe-inspector"><SectionHeading icon={<Users size={16} />} title={objectName('Minion', instance, 0)} action="INSPECTOR" /><div className="inspector-grid"><EditableField label="名称" value={member(identity, 'name')?.value} onCommit={(text) => edit('name', text)} /><TransformFields instance={instance} updateSave={updateSave} /></div><div className="dupe-facts"><InfoRow label="体温" value={temperature === undefined ? '—' : `${formatNumber(temperature - 273.15, 1)} °C`} /><InfoRow label="组件" value={`${instance.components.length}`} /><InfoRow label="禁用伤残" value={health === undefined ? '—' : health ? '是' : '否'} /></div></aside>
}

function ObjectsView({ save, selectedGroup, selectedIndex, onSelect, updateSave }: { save: ParsedSave; selectedGroup: string; selectedIndex: number; onSelect: (tag: string, index: number) => void; updateSave: (update: (save: ParsedSave) => void) => void }) {
  const [query, setQuery] = useState('')
  const [groupQuery, setGroupQuery] = useState('')
  const groupList = topGroups(save).filter((group) => group.tag.toLowerCase().includes(groupQuery.toLowerCase()))
  const group = groupByTag(save, selectedGroup)
  const rows = groupRows(group).filter((row) => row.name.toLowerCase().includes(query.toLowerCase()) || String(row.index + 1).includes(query))
  const active = group?.instances[selectedIndex] ?? rows[0]?.instance
  const activeIndex = active && group ? group.instances.indexOf(active) : selectedIndex
  return (
    <div className="objects-layout">
      <section className="surface object-groups"><div className="panel-title"><div><span className="eyebrow">SAVE MANAGER</span><h2>对象分组</h2></div><span className="panel-count">{groupList.length}</span></div><label className="search-box"><Search size={15} /><input value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} placeholder="搜索分组" /></label><div className="object-group-list">{groupList.map((item) => <button key={item.tag} className={`object-group-row ${selectedGroup === item.tag ? 'selected' : ''}`} type="button" onClick={() => onSelect(item.tag, 0)}><span className="group-symbol"><Boxes size={14} /></span><span>{item.tag}</span><strong>{item.count.toLocaleString()}</strong></button>)}</div></section>
      <section className="surface object-records"><div className="panel-title"><div><span className="eyebrow">{selectedGroup}</span><h2>实例列表</h2></div><span className="panel-count">{group?.instances.length ?? 0}</span></div><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称或编号" /></label><div className="records-table"><div className="records-head"><span>名称 / ID</span><span>位置</span><span>组件</span></div>{rows.slice(0, 100).map((row) => <button key={row.index} type="button" className={`record-row ${activeIndex === row.index ? 'selected' : ''}`} onClick={() => onSelect(selectedGroup, row.index)}><span><strong>{row.name}</strong><small>#{row.index + 1}</small></span><span>{formatNumber(row.position.x, 1)}, {formatNumber(row.position.y, 1)}</span><span>{row.components}</span></button>)}{rows.length > 100 && <div className="table-note">仅显示前 100 条匹配结果</div>}</div></section>
      <ObjectInspector instance={active} groupTag={selectedGroup} updateSave={updateSave} />
    </div>
  )
}

function ObjectInspector({ instance, groupTag, updateSave }: { instance: SavedObjectInstance | undefined; groupTag: string; updateSave: (update: (save: ParsedSave) => void) => void }) {
  const [componentName, setComponentName] = useState('')
  useEffect(() => { setComponentName(instance?.components.find((item) => item.value && editableMembers(item.value).length > 0)?.typeName ?? instance?.components[0]?.typeName ?? '') }, [instance])
  const active = component(instance, componentName) ?? instance?.components[0]
  if (!instance) return <aside className="surface inspector-empty"><Boxes size={22} /><span>选择一个实例查看详情</span></aside>
  return <aside className="surface object-inspector"><div className="panel-title"><div><span className="eyebrow">{groupTag} INSPECTOR</span><h2>{objectName(groupTag, instance, 0)}</h2></div><Settings2 size={17} className="title-icon" /></div><TransformFields instance={instance} updateSave={updateSave} /><div className="component-heading"><span>组件</span><span>{instance.components.length}</span></div><div className="component-tabs">{instance.components.map((item) => <button key={item.typeName} type="button" className={active?.typeName === item.typeName ? 'selected' : ''} onClick={() => setComponentName(item.typeName)}>{item.typeName.split('.').pop()}<span>{item.value ? item.value.members.length : 'raw'}</span></button>)}</div>{active && <div className="component-editor"><div className="component-name"><span>{active.typeName}</span><small>{active.value ? `${active.value.members.length} fields` : `${active.raw?.length ?? active.details?.length ?? 0} bytes`}</small></div>{active.value ? <div className="field-list">{editableMembers(active.value).map((item) => <EditableField key={item.name} label={item.name} value={item.value} onCommit={(text) => updateSave(() => { setValueFromText(item.value, text) })} />)}</div> : <div className="raw-notice"><AlertTriangle size={15} />该组件保留为原始字节，暂不直接编辑。</div>}</div>}</aside>
}

function TransformFields({ instance, updateSave }: { instance: SavedObjectInstance; updateSave: (update: (save: ParsedSave) => void) => void }) {
  return <div className="transform-fields"><div className="field-label">位置 <span>WORLD COORDINATES</span></div><div className="transform-grid">{(['x', 'y', 'z'] as const).map((axis) => <label key={axis}><span>{axis}</span><input value={instance.position[axis]} type="number" step="0.5" onChange={(event) => updateSave(() => { instance.position[axis] = Number(event.target.value) })} /></label>)}</div></div>
}

function InlineMember({ label, value, updateSave, componentName, memberName }: { label: string; value: Value | undefined; updateSave: (update: (save: ParsedSave) => void) => void; componentName: string; memberName: string }) {
  return <div className="inline-member"><span>{label}</span><EditableField compact value={value} onCommit={(text) => updateSave((save) => { const instance = saveGameInstance(save); const current = member(instance?.components.find((item) => item.typeName === componentName)?.value, memberName)?.value; if (current) setValueFromText(current, text) })} /></div>
}

function EditableField({ label, value, onCommit, compact = false }: { label?: string; value: Value | undefined; onCommit: (text: string) => void; compact?: boolean }) {
  const [draft, setDraft] = useState(scalarText(value))
  useEffect(() => setDraft(scalarText(value)), [value])
  if (!value || !isEditable(value)) return <div className="field-value muted">{scalarText(value)}</div>
  if (value.kind === 'boolean') return <label className={`toggle-field ${compact ? 'compact' : ''}`}><span>{label}</span><input type="checkbox" checked={value.v} onChange={(event) => onCommit(event.target.checked ? 'true' : 'false')} /><i /></label>
  return <label className={`editable-field ${compact ? 'compact' : ''}`}><span>{label}</span><input value={draft} type={value.kind === 'string' ? 'text' : 'number'} onChange={(event) => setDraft(event.target.value)} onBlur={() => { onCommit(draft); setDraft(scalarText(value)) }} /></label>
}

function Metric({ icon, label, value, note, accent }: { icon: React.ReactNode; label: string; value: string; note: string; accent: string }) {
  return <div className={`metric surface accent-${accent}`}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>
}

function SectionHeading({ icon, title, action }: { icon: React.ReactNode; title: string; action: string }) {
  return <div className="section-heading"><div><span className="section-icon">{icon}</span><h2>{title}</h2></div><span className="section-action">{action}</span></div>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="info-row"><span>{label}</span><strong>{value}</strong></div>
}

export default App
