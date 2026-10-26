import { component, member, scalarNumber, scalarText, worldCoordinate, worldSeed, worldSize, gameValue } from './editor'
import { elementForHash } from './elements'
import { ONI_GEYSER_TYPES, ONI_RESOURCE_NAMES } from './oniResourceData.generated'
import type { ParsedSave } from './save'
import type { ObjectValue, SavedObjectInstance } from './model'

export const SECONDS_PER_CYCLE = 600
export interface ResourcePlanet { id:number; name:string; type:string; source:string; x:number; y:number; width:number; height:number; discovered:boolean; start:boolean }
export interface GeyserStatistics {
  id:string; tag:string; index:number; name:string; typeId:string; typeName:string; planetId:number; x:number; y:number
  kind:'geyser'|'circulator'|'unknown'; studied:boolean; output:string; temperature?:number; maxPressure?:number
  emitRate?:number; averageRate?:number; activeAverageRate?:number; massPerCycle?:number
  iterationLength?:number; eruptDuration?:number; idleDuration?:number
  yearLength?:number; activeDuration?:number; dormantDuration?:number
  activity:'active'|'dormant'|'unknown'|'circulator'; remainingSeason?:number; eruption?:'on'|'off'
  parameterSource:'saved'|'rolls'|'unavailable'; note?:string
}
export interface ResourceStatistics { seed?:number; coordinate?:string; time?:number; planets:ResourcePlanet[]; geysers:GeyserStatistics[] }
const text=(o:ObjectValue|null|undefined,key:string)=>scalarText(member(o,key)?.value)
const num=(o:ObjectValue|null|undefined,key:string)=>{const n=scalarNumber(member(o,key)?.value);return n!==undefined&&Number.isFinite(n)?n:undefined}
const flag=(o:ObjectValue|null|undefined,key:string)=>{const v=member(o,key)?.value;return v?.kind==='boolean'&&v.v}
const object=(o:ObjectValue|null|undefined,key:string)=>{const v=member(o,key)?.value;return v?.kind==='object'?v:undefined}
const vector=(o:ObjectValue,key:string)=>{const v=member(o,key)?.value;return v?.kind==='vector2i'||v?.kind==='vector2'?{x:v.x,y:v.y}:undefined}
const clean=(s:string)=>s.replace(/<[^>]*>/g,'')
const localized=(s:string)=>ONI_RESOURCE_NAMES[s]??clean(s)
const typesById=new Map(ONI_GEYSER_TYPES.map(t=>[t.id as string,t]))
const typesByHash=new Map(ONI_GEYSER_TYPES.map(t=>[t.hash as number,t]))

/** GeyserConfigurator.Resample: native inverse-logistic sampling, not linear interpolation. */
export function resampleGeyserRoll(t:number,min:number,max:number):number {
  const p=t*(1-.002472623*2)+.002472623
  return (-Math.log(1/p-1)+6)/12*(max-min)+min
}
export function geyserSeason(time:number,yearLength:number,activeDuration:number) {
  const phase=((time%yearLength)+yearLength)%yearLength
  const active=activeDuration>0&&phase<activeDuration
  return {activity:active?'active' as const:'dormant' as const,
    remainingSeason:activeDuration<=0||activeDuration>=yearLength?undefined:active?activeDuration-phase:yearLength-phase}
}

export function readResourcePlanets(save:ParsedSave):ResourcePlanet[] {
  const result:ResourcePlanet[]=[]
  for(const group of save.manager?.groups??[])for(const instance of group.instances){
    const world=component(instance,'WorldContainer')?.value
    if(!world||flag(world,'isModuleInterior'))continue
    const id=num(world,'id'),offset=vector(world,'worldOffset'),size=vector(world,'worldSize')
    if(id===undefined||!offset||!size||size.x<=0||size.y<=0)continue
    const asteroid=component(instance,'AsteroidGridEntity')?.value
    const source=text(world,'worldName'),typeKey=text(world,'worldType')
    const type=localized(typeKey)||source.split('/').pop()||'未知类型'
    const name=clean(text(asteroid,'m_name'))||localized(text(world,'overrideName'))||type
    result.push({id,name,type,source,x:offset.x,y:offset.y,width:size.x,height:size.y,discovered:flag(world,'isDiscovered'),start:flag(world,'isStartWorld')})
  }
  if(!result.length){const size=worldSize(save);result.push({id:0,name:String(save.gameInfoJson.baseName??'主星'),type:'未记录星球类型',source:'',x:0,y:0,width:size.width,height:size.height,discovered:true,start:true})}
  return result.sort((a,b)=>Number(b.start)-Number(a.start)||a.id-b.id)
}

function geyserParameters(configuration:ObjectValue,base:typeof ONI_GEYSER_TYPES[number]|undefined) {
  const scaled={rate:num(configuration,'scaledRate'),iteration:num(configuration,'scaledIterationLength'),fraction:num(configuration,'scaledIterationPercent'),year:num(configuration,'scaledYearLength'),yearFraction:num(configuration,'scaledYearPercent')}
  const saved=scaled.rate!==undefined&&scaled.rate>=0&&scaled.iteration!==undefined&&scaled.iteration>0&&scaled.year!==undefined&&scaled.year>0&&scaled.fraction!==undefined&&scaled.fraction>=0&&scaled.fraction<=1&&scaled.yearFraction!==undefined&&scaled.yearFraction>=0&&scaled.yearFraction<=1
  if(saved)return {...scaled,source:'saved' as const}
  if(!base)return {source:'unavailable' as const}
  const sample=(key:string,min:number,max:number)=>{const roll=num(configuration,key);return roll!==undefined&&roll>=0&&roll<=1?resampleGeyserRoll(roll,min,max):undefined}
  return {rate:sample('rateRoll',base.minRatePerCycle,base.maxRatePerCycle),iteration:sample('iterationLengthRoll',base.minIterationLength,base.maxIterationLength),fraction:sample('iterationPercentRoll',base.minIterationPercent,base.maxIterationPercent),year:sample('yearLengthRoll',base.minYearLength,base.maxYearLength),yearFraction:sample('yearPercentRoll',base.minYearPercent,base.maxYearPercent),source:'rolls' as const}
}

/** Read generated worlds and each saved instance. Never mutate the save or regenerate its seed. */
export function resourceStatistics(save:ParsedSave):ResourceStatistics {
  const planets=readResourcePlanets(save),geysers:GeyserStatistics[]=[]
  const cycle=scalarNumber(gameValue(save,'GameClock','cycle')),within=scalarNumber(gameValue(save,'GameClock','timeSinceStartOfCycle'))
  const time=cycle!==undefined&&within!==undefined?cycle*SECONDS_PER_CYCLE+within:undefined
  for(const group of save.manager?.groups??[])group.instances.forEach((instance:SavedObjectInstance,index:number)=>{
    const geyser=component(instance,'Geyser')?.value
    if(!geyser&&!/geyser|fountain/i.test(group.tag)&&!instance.components.some(c=>/(?:^|[.+])Geyser$/i.test(c.typeName)))return
    const x=instance.position.x,y=instance.position.y
    if(!Number.isFinite(x)||!Number.isFinite(y))return
    const planet=planets.find(p=>x>=p.x&&y>=p.y&&x<p.x+p.width&&y<p.y+p.height)
    const config=object(geyser,'configuration'),hash=num(object(config,'typeId'),'hash')
    const fallback=group.tag.replace(/^GeyserGeneric_/,'')
    const base=hash!==undefined?typesByHash.get(hash):typesById.get(fallback)
    const typeId=base?.id??fallback
    const circulator=group.tag==='SmallReefGeyser'
    const typeName=base?.name??ONI_RESOURCE_NAMES['STRINGS.CREATURES.SPECIES.GEYSER.'+group.tag.toUpperCase()+'.NAME']??group.tag
    const entry:GeyserStatistics={id:`${group.tag}:${index}`,tag:group.tag,index,name:clean(text(component(instance,'UserNameable')?.value,'savedName'))||typeName,typeId,typeName,planetId:planet?.id??-1,x,y,kind:circulator?'circulator':geyser?'geyser':'unknown',studied:flag(component(instance,'Studyable')?.value,'studied'),output:base?(ONI_RESOURCE_NAMES['STRINGS.ELEMENTS.'+base.element.toUpperCase()+'.NAME']??elementForHash(base.elementHash).name):'未记录',temperature:base?.temperature,maxPressure:base?.maxPressure,activity:circulator?'circulator':'unknown',parameterSource:'unavailable'}
    if(circulator){entry.output='吸入的液体';entry.note='吸入后再排出液体，不产生新增资源；排出上限 166.667 kg/s，取决于液体供给。'}
    else if(config){
      const p=geyserParameters(config,base)
      entry.parameterSource=p.source
      if('iteration' in p){
        entry.iterationLength=p.iteration;entry.yearLength=p.year
        if(p.iteration!==undefined&&p.fraction!==undefined){entry.eruptDuration=p.iteration*p.fraction;entry.idleDuration=p.iteration*(1-p.fraction)}
        if(p.year!==undefined&&p.yearFraction!==undefined){entry.activeDuration=p.year*p.yearFraction;entry.dormantDuration=p.year*(1-p.yearFraction)}
        if(p.rate!==undefined&&p.fraction!==undefined&&p.fraction>0){entry.activeAverageRate=p.rate/SECONDS_PER_CYCLE;entry.emitRate=entry.activeAverageRate/p.fraction}
        if(p.fraction===0){entry.emitRate=0;entry.activeAverageRate=0}
        if(p.rate!==undefined&&p.yearFraction!==undefined){entry.averageRate=p.fraction===0?0:p.rate/SECONDS_PER_CYCLE*p.yearFraction;entry.massPerCycle=p.fraction===0?0:p.rate*p.yearFraction}
        if(time!==undefined&&p.year!==undefined&&p.year>0&&entry.activeDuration!==undefined){
          Object.assign(entry,geyserSeason(time+(num(geyser,'serializedTimeShift')??0),p.year,entry.activeDuration))
          if(p.iteration!==undefined&&p.iteration>0&&entry.eruptDuration!==undefined){const phase=((time+(num(geyser,'serializedTimeShift')??0))%p.iteration+p.iteration)%p.iteration;entry.eruption=phase<entry.eruptDuration?'on':'off'}
        }
      }
    }
    if(!base&&!circulator)entry.note='未识别类型的固定配置；仅显示存档中可读取的参数。'
    geysers.push(entry)
  })
  if(geysers.some(g=>g.planetId===-1))planets.push({id:-1,name:'未匹配星球',type:'位置不在已记录星球范围内',source:'',x:0,y:0,width:0,height:0,discovered:false,start:false})
  return {seed:worldSeed(save),coordinate:worldCoordinate(save),time,planets,geysers}
}
