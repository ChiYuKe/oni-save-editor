import type { ParsedSave } from './save'
import { resourceStatistics } from './oniResourceStatistics'
import { worldSize } from './editor'
export type NativeSeedSnapshot={coordinate:string;unityVersion?:string;worlds?:{id:number;x:number;y:number;width:number;height:number;source:string}[];geysers:{typeId:string;x:number;y:number;emitRate:number;eruptDuration:number;idleDuration:number;activeDuration:number;dormantDuration:number;temperature:number}[]}
export function verifyNativeSeed(save:ParsedSave,native:NativeSeedSnapshot){
  const check=(ok:boolean,message:string)=>{if(!ok)throw new Error(`演算结果核验失败：${message}`)}
  const data=resourceStatistics(save),size=worldSize(save)
  check(data.coordinate===native.coordinate,'存档坐标码与原生生成结果不同')
  check(Boolean(save.simData)&&size.width>0&&size.height>0,'地图网格不完整')
  check(Array.isArray(native.worlds)&&native.worlds.length>0,'引擎未提供星球核验清单，请更新演算器')
  check(data.planets.length===native.worlds!.length,'星球数量不一致')
  for(const world of native.worlds!){const planet=data.planets.find(p=>p.id===world.id);check(Boolean(planet)&&planet!.x===world.x&&planet!.y===world.y&&planet!.width===world.width&&planet!.height===world.height&&planet!.source===world.source,`星球 ${world.id} 的位置、尺寸或类型不同`)}
  const geysers=data.geysers.filter(g=>g.kind==='geyser')
  check(geysers.length===native.geysers.length,'间歇泉数量不一致')
  const remaining=new Set(geysers)
  for(const geyser of native.geysers){
    const match=[...remaining].find(g=>g.typeId===geyser.typeId&&Math.abs(g.x-geyser.x)<.001&&Math.abs(g.y-geyser.y)<.001)
    check(Boolean(match)&&match!.planetId!==-1,`缺少间歇泉 ${geyser.typeId}（${geyser.x}, ${geyser.y}）`)
    remaining.delete(match!)
    for(const key of ['emitRate','eruptDuration','idleDuration','activeDuration','dormantDuration','temperature'] as const){const value=match![key];check(typeof value==='number'&&Number.isFinite(value)&&Number.isFinite(geyser[key])&&Math.abs(value-geyser[key])<=Math.max(.001,Math.abs(geyser[key])*1e-5),`${geyser.typeId} 的 ${key} 与原生 API 不一致`)}
  }
  return {planets:data.planets.length,geysers:geysers.length}
}
