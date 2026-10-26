import type { SavedObjectGroup, SavedObjectInstance } from './model'
import { oniBuildingDefinitionForAnimation, oniBuildingDefinitionForTag, type OniBuildingDefinition } from './oniBuildingDefs.generated'
import { ONI_SCENE_LAYER_ORDER } from './oniRenderLayers'
import { blockTileTextureForTag } from './blockTiles'
import { utilityFamilyForTag, type UtilityFamily } from './utilityTiles'

export const BUILDING_TAG_ALIASES: Record<string, string> = {
  flushtoilet: 'toiletflush', toiletwall: 'toilet_wall', washbasin: 'wash_sink', liquidvent: 'ventliquid',
  solidconduitinbox: 'conveyorin', solidconduitoutbox: 'conveyorout', warpconduitsender: 'warp_conduit_sender',
  warpconduitreceiver: 'warp_conduit_receiver', door: 'door_internal', pneumaticdoor: 'door_internal',
  manualairlock: 'door_manual', manualpressuredoor: 'door_manual', mechanizedairlock: 'door_external',
  insulateddoor: 'door_insulated', bunkerdoor: 'door_bunker', woodendoor: 'door_wood', facilitydoor: 'door_facility',
  poibunkerexteriordoor: 'door_poi', poidoorinternal: 'door_poi_internal', logicgateand: 'logic_and',
  poicerestechunlock: 'research_unlock', poidlc4techunlock: 'research_unlock_dino',
  poidlc5techunlock: 'research_unlock_aquatic', gravitasdoor: 'gravitas_door_internal',
  storagenetworkorderproductioncenter: 'storagenetwork_orderproductioncenter',
}

const BUILDING_DEFINITION_OVERRIDES: Record<string, OniBuildingDefinition> = {
  logicgateand: { id: 'LogicGateAND', width: 2, height: 2, animation: 'logic_and_kanim', defaultAnim: 'off', sceneLayer: 'LogicGates', foregroundLayer: 'BuildingFront', objectLayer: 'LogicGate', source: 'LogicGateANDConfig.cs' },
}

export function oniBuildingDefinitionForSaveTag(tag: string): OniBuildingDefinition | undefined {
  const key = tag.trim().toLowerCase()
  const alias = BUILDING_TAG_ALIASES[key]
  return BUILDING_DEFINITION_OVERRIDES[key] ?? oniBuildingDefinitionForTag(key) ?? (alias ? oniBuildingDefinitionForAnimation(alias) : undefined)
}

export function instanceOrientation(instance: SavedObjectInstance): number {
  const rotatable = instance.components.find((item) => item.typeName.split(/[.+]/).pop()?.toLowerCase() === 'rotatable')
  const orientation = rotatable?.value?.members.find((item) => item.name === 'orientation')?.value
  return orientation?.kind === 'enum' ? orientation.v : 0
}

function utilitySceneLayer(family: UtilityFamily): number {
  switch (family) {
    case 'gas': return ONI_SCENE_LAYER_ORDER.GasConduits
    case 'liquid': return ONI_SCENE_LAYER_ORDER.LiquidConduits
    case 'solid': return ONI_SCENE_LAYER_ORDER.SolidConduits
    case 'electrical': return ONI_SCENE_LAYER_ORDER.Wires
    case 'logic': return ONI_SCENE_LAYER_ORDER.LogicWires
  }
}

export function mapObjectSceneLayer(group: SavedObjectGroup): number {
  if (group.tag === 'Minion') return ONI_SCENE_LAYER_ORDER.Creatures
  if (blockTileTextureForTag(group.tag)) return ONI_SCENE_LAYER_ORDER.TileMain
  const family = utilityFamilyForTag(group.tag)
  if (family) return utilitySceneLayer(family)
  const definition = oniBuildingDefinitionForSaveTag(group.tag)
  return ONI_SCENE_LAYER_ORDER[definition?.sceneLayer ?? ''] ?? ONI_SCENE_LAYER_ORDER.Building
}

function rotatedBuildingOffset(x: number, y: number, orientation: number): { x: number; y: number } {
  switch (orientation) {
    case 1: return { x: y, y: -x }
    case 2: return { x: -x, y: -y }
    case 3: return { x: -y, y: x }
    case 5: return { x: -x, y }
    case 6: return { x, y: -y }
    default: return { x, y }
  }
}

export function buildingPlacementCells(instance: SavedObjectInstance, footprint: OniBuildingDefinition | undefined): Array<{ x: number; y: number }> {
  if (!footprint) return []
  const startX = Math.floor(footprint.width / 2) - footprint.width + 1
  const baseX = Math.floor(instance.position.x)
  const baseY = Math.floor(instance.position.y)
  const orientation = instanceOrientation(instance)
  const cells: Array<{ x: number; y: number }> = []
  for (let localY = 0; localY < footprint.height; localY++) for (let localX = 0; localX < footprint.width; localX++) {
    const offset = rotatedBuildingOffset(startX + localX, localY, orientation)
    cells.push({ x: baseX + offset.x, y: baseY + offset.y })
  }
  return cells
}

