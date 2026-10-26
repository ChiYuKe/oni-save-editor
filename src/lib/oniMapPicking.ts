import { component, member, objectName, scalarNumber, scalarText, worldSize } from './editor'
import { elementForHash } from './elements'
import { getWorldCell, readSimBackwall } from './sim'
import { inspectOniCell, type OniCellInspection } from './oniCellInspection'
import { ONI_SUBSTANCE_BY_HASH } from './oniSubstances.generated'
import { ONI_ELEMENT_IDS } from './oniElementIds.generated'
import type { OniChunkLayerVisibility } from './oniWorldChunkRenderer'
import { buildingPlacementCells, mapObjectSceneLayer, oniBuildingDefinitionForSaveTag } from './oniObjectPlacement'
import { utilityFamilyForTag } from './utilityTiles'
import type { ParsedSave } from './save'
import type { SavedObjectGroup, SavedObjectInstance, Value } from './model'

export type PickBounds = { minX: number; minY: number; maxX: number; maxY: number }
export type OniMapTarget = { id: string; kind: 'object' | 'cell' | 'backwall'; layer: string; order: number; bounds: PickBounds;
  group?: SavedObjectGroup; instance?: SavedObjectInstance; inspection: OniCellInspection }
type IndexedObject = { id: string; group: SavedObjectGroup; instance: SavedObjectInstance; order: number; bounds: PickBounds; cells: Set<string>; visibility: keyof OniChunkLayerVisibility; layer: string }
const key = (x: number, y: number) => `${x}:${y}`
const temperature = (v: number) => `${(v - 273.15).toFixed(2)} °C · ${v.toFixed(2)} K`
const pointBounds = (x: number, y: number): PickBounds => ({ minX:x, minY:y, maxX:x, maxY:y })

/** Index occupied cells once; clicking never scans the full save or loads artwork. */
export function createOniMapPicker(save: ParsedSave) {
  const objects = new Map<string, IndexedObject[]>()
  let sequence = 0
  for (const group of save.manager?.groups ?? []) for (const instance of group.instances) {
    const id = `object:${sequence++}`
    const x = Math.floor(instance.position.x), y = Math.floor(instance.position.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    const definition = oniBuildingDefinitionForSaveTag(group.tag)
    const family = utilityFamilyForTag(group.tag)
    const creature = group.tag === 'Minion' || definition?.sceneLayer === 'Creatures'
    const isGeyser = /geyser/i.test(group.tag)
    // Global save managers are data containers, not map objects.
    if (!definition && !family && !creature && !isGeyser && !component(instance,'PrimaryElement')) continue
    const cells = buildingPlacementCells(instance, definition)
    if (!cells.length) cells.push({x,y})
    if (group.tag === 'Minion') cells.push({x,y:y+1})
    const bounds = {minX:Math.min(...cells.map(c=>c.x)), minY:Math.min(...cells.map(c=>c.y)), maxX:Math.max(...cells.map(c=>c.x)), maxY:Math.max(...cells.map(c=>c.y))}
    const visibility = group.tag === 'Minion' ? 'minions' : creature ? 'entities' : isGeyser ? 'geysers'
      : family === 'electrical' ? 'power' : family === 'liquid' ? 'plumbing' : family === 'gas' ? 'ventilation'
      : family === 'logic' ? 'automation' : family === 'solid' ? 'shipment' : 'buildings'
    const layer = family === 'electrical' ? '电线' : family === 'liquid' ? '液体管道' : family === 'gas' ? '气体管道'
      : family === 'logic' ? '自动化' : family === 'solid' ? '运输轨道' : creature ? '生物 / 复制人' : isGeyser ? '间歇泉' : definition?.sceneLayer === 'InteriorWall' ? '建筑背墙' : '建筑 / 对象'
    const entry: IndexedObject = {id,group,instance,bounds,cells:new Set(cells.map(c=>key(c.x,c.y))),visibility,layer,order:mapObjectSceneLayer(group)}
    for (const cell of entry.cells) {const bucket=objects.get(cell)??[];bucket.push(entry);objects.set(cell,bucket)}
  }
  return (x: number, y: number, visible: OniChunkLayerVisibility): OniMapTarget[] => {
    const size=worldSize(save)
    if (!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=size.width||y>=size.height) return []
    const targets: OniMapTarget[] = (objects.get(key(x,y))??[]).filter(o=>visible[o.visibility]!==false).map(o=>{
      const rows: Array<[string,string]> = [['对象 ID',o.group.tag],['图层',o.layer],['位置',`${o.instance.position.x.toFixed(2)}, ${o.instance.position.y.toFixed(2)}`],['占地',`${o.bounds.maxX-o.bounds.minX+1} × ${o.bounds.maxY-o.bounds.minY+1}`]]
      const prefab=scalarNumber(member(component(o.instance,'KPrefabID')?.value,'InstanceID')?.value)
      if(prefab!==undefined)rows.push(['实例 ID',String(prefab)])
      const primary=component(o.instance,'PrimaryElement')?.value
      const t=scalarNumber(member(primary,'_Temperature')?.value)??scalarNumber(member(primary,'Temperature')?.value)??scalarNumber(member(primary,'temperature')?.value)
      const mass=scalarNumber(member(primary,'Mass')?.value)??scalarNumber(member(primary,'mass')?.value)
      const element=scalarNumber(member(primary,'ElementID')?.value)??scalarNumber(member(primary,'elementID')?.value)
      if(t!==undefined)rows.push(['温度',temperature(t)])
      const units=scalarNumber(member(primary,'Units')?.value)
      if(units!==undefined)rows.push(['数量',String(units)])
      if(mass!==undefined)rows.push(['质量',`${mass.toFixed(3)} kg`])
      if(element!==undefined)rows.push(['材质元素',ONI_ELEMENT_IDS.get(element)??String(element)])
      rows.push(['组件数量',String(o.instance.components.length)])
      return {id:o.id,kind:'object',group:o.group,instance:o.instance,bounds:o.bounds,layer:o.layer,order:o.order,inspection:{name:objectName(o.group.tag,o.instance,Number(o.id.split(':')[1])),position:`X ${x} · Y ${y}`,rows}}
    })
    const cell=save.simData&&getWorldCell(save.simData,x,y),inspection=inspectOniCell(save,x,y)
    if(cell&&inspection){
      const state=elementForHash(cell.elementHash).state
      const enabled=state==='solid'||state==='special'?visible.ground:state==='liquid'?visible.liquid:visible.gas
      if(enabled)targets.push({id:`cell:${x}:${y}`,kind:'cell',layer:state==='solid'?'自然地形':state==='liquid'?'液体':'气体',order:state==='solid'||state==='special'?29:state==='liquid'?28:2,bounds:pointBounds(x,y),inspection})
      const sim=save.simData!,wall=readSimBackwall(sim,new DataView(sim.bytes.buffer,sim.bytes.byteOffset,sim.bytes.byteLength),x+1,y+1)
      if(visible.backwall&&wall&&wall.mass>0&&elementForHash(wall.elementHash).state==='solid')targets.push({id:`backwall:${x}:${y}`,kind:'backwall',layer:'天然背墙',order:1,bounds:pointBounds(x,y),inspection:{name:elementForHash(wall.elementHash).name+' · 天然背墙',position:`X ${x} · Y ${y}`,rows:[['元素 ID',ONI_ELEMENT_IDS.get(ONI_SUBSTANCE_BY_HASH.get(wall.elementHash)?.elementId ?? wall.elementHash)??'未识别'],['温度',temperature(wall.temperature)],['质量',`${wall.mass.toFixed(3)} kg`]]}})
    }
    return targets.sort((a,b)=>Number(b.kind==='object')-Number(a.kind==='object') || b.order-a.order || (a.instance&&b.instance ? a.instance.position.z-b.instance.position.z : 0) || Number(b.id.split(':')[1])-Number(a.id.split(':')[1]))
  }
}

export function cycleMapTarget(targets: OniMapTarget[], previousId?: string): OniMapTarget | undefined {
  return targets[(targets.findIndex(t=>t.id===previousId)+1)%targets.length]
}

/** Bounded read-only component details, including nested saved values. */
export function mapComponentRows(value: Value | null, prefix = '', budget = 100): Array<[string,string]> {
  if(!value||budget<=0)return []
  if(value.kind==='object')return value.members.flatMap(m=>mapComponentRows(m.value,prefix?`${prefix}.${m.name}`:m.name,Math.max(0,Math.floor(budget/Math.max(1,value.members.length))))).slice(0,budget)
  if(value.kind==='list')return value.items.slice(0,Math.min(12,budget)).flatMap((v,i)=>mapComponentRows(v,`${prefix}[${i}]`,Math.max(1,Math.floor(budget/Math.max(1,value.items.length))))).slice(0,budget)
  return [[prefix,scalarText(value)]]
}
