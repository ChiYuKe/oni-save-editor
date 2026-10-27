import { SelectMenu } from './SelectMenu'
import { ONI_GEYSER_TYPES } from './lib/oniResourceData.generated'
import { geyserTextureForTag } from './lib/oniObjectVisuals'
import { ONI_PLANET_ICONS } from './lib/oniPlanetIcons.generated'
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Globe2, Search, Waves, Layers3, Moon, MapPin } from 'lucide-react'
import type { ParsedSave } from './lib/save'
import { resourceStatistics, SECONDS_PER_CYCLE, type GeyserStatistics, type ResourcePlanet } from './lib/oniResourceStatistics'
import './resourceStatistics.css'

const geyserIcons=new Map<string,string>(ONI_GEYSER_TYPES.map(type=>[type.id,type.iconPath]))
const number=(n:number|undefined,digits=1)=>n===undefined||!Number.isFinite(n)?'—':n.toLocaleString('zh-CN',{minimumFractionDigits:digits,maximumFractionDigits:digits})
const resourceRate=(n:number|undefined)=>n===undefined?'—':n<1?`${number(n*1000,1)} g/s`:`${number(n,3)} kg/s`
const seconds=(n:number|undefined)=>n===undefined?'—':`${number(n)} 秒`
const cycles=(n:number|undefined)=>n===undefined?'—':`${number(n/SECONDS_PER_CYCLE)} 周期`
const status=(g:GeyserStatistics)=>g.activity==='active'?'活跃期':g.activity==='dormant'?'休眠期':g.activity==='circulator'?'液体循环':'周期未知'

export interface ResourceViewState { planetId:string; query:string; typeId:string; expanded:string|null }
export function ResourceStatisticsView({save,initialState,onLocate}:{save:ParsedSave;initialState?:ResourceViewState;onLocate:(geyser:GeyserStatistics,state:ResourceViewState)=>void}) {
  const data=useMemo(()=>resourceStatistics(save),[save])
  const [planetId,setPlanetId]=useState(initialState?.planetId??'all'),[query,setQuery]=useState(initialState?.query??''),[typeId,setTypeId]=useState(initialState?.typeId??'all')
  const [expanded,setExpanded]=useState<string|null>(initialState?.expanded??null)
  const types=useMemo(()=>[...new Map(data.geysers.map(g=>[g.typeId,g.typeName])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'zh-CN')),[data])
  const filtered=data.geysers.filter(g=>(planetId==='all'||g.planetId===Number(planetId))&&(typeId==='all'||g.typeId===typeId)&&`${g.name} ${g.typeId} ${g.tag} ${g.output} ${data.planets.find(p=>p.id===g.planetId)?.name??''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const visiblePlanets=data.planets.filter(p=>planetId==='all'||p.id===Number(planetId))
  const native=data.geysers.filter(g=>g.kind==='geyser'),circulators=data.geysers.filter(g=>g.kind==='circulator')
  const totals=new Map<string,number>()
  for(const g of filtered)if(g.kind==='geyser'&&g.averageRate!==undefined)totals.set(g.output,(totals.get(g.output)??0)+g.averageRate)
  const choosePlanet=(id:string)=>{setPlanetId(id);setExpanded(null)}
  return <div className="resource-statistics">
    <div className="resource-seed"><span>世界种子 <strong>{data.seed??'未记录'}</strong></span>{data.coordinate&&<span title={data.coordinate}>坐标 <code>{data.coordinate}</code></span>}<span>存档时刻 {cycles(data.time)}</span></div>
    <div className="metric-grid resource-metrics">
      {[{label:'星球',value:data.planets.filter(p=>p.id!==-1).length,detail:'包含未发现星球',Icon:Globe2},{label:'产出型间歇泉',value:native.length,detail:`另有 ${circulators.length} 处液体循环喷泉`,Icon:Waves},{label:'喷泉种类',value:types.length,detail:'按存档中的类型统计',Icon:Layers3},{label:'当前休眠',value:native.filter(g=>g.activity==='dormant').length,detail:'按存档时刻计算',Icon:Moon}].map(({label,value,detail,Icon})=><section className="metric surface" key={label}><div className="metric-icon"><Icon size={18}/></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></section>)}
    </div>
    <div className="resource-layout">
      <aside className="resource-planets surface" aria-label="星球列表"><h2>星球</h2><button type="button" aria-pressed={planetId==='all'} onClick={()=>choosePlanet('all')}><Globe2 size={15}/><span><strong>全部星球</strong><small>{data.geysers.length} 处喷泉</small></span></button>{data.planets.map(planet=><button type="button" key={planet.id} aria-pressed={planetId===String(planet.id)} onClick={()=>choosePlanet(String(planet.id))}><PlanetIcon planet={planet}/><span><strong>{planet.name}</strong><small>{planet.type}</small><small>{data.geysers.filter(g=>g.planetId===planet.id).length} 处 · {planet.start?'初始星球':planet.discovered?'已发现':'未发现'}</small></span></button>)}</aside>
      <div className="resource-content">
        <section className="resource-filter surface"><div><h2>间歇泉资源</h2><span>{filtered.length} 处匹配</span></div><label className="search-box"><Search size={15}/><input aria-label="搜索喷泉或资源" placeholder="搜索喷泉、资源或星球" value={query} onChange={e=>setQuery(e.target.value)}/></label><SelectMenu label="筛选喷泉种类" value={typeId} onChange={setTypeId} options={[{value:'all',label:'全部种类'},...types.map(([value,label])=>({value,label}))]} /></section>
        <p className="resource-note">全周期平均已计入休眠；产量为基础理论值，未计地质调谐、超压堵塞与模组加成。1 周期 = 600 秒。循环喷泉不计入新增资源。</p>
        {totals.size>0&&<details className="resource-yield-summary"><summary>资源产量汇总 · {totals.size} 种资源<small>全周期平均</small></summary><section className="resource-yields" aria-label="筛选范围内的平均资源产量">{[...totals].map(([name,rate])=><div key={name}><span>{name}</span><strong>{resourceRate(rate)}</strong><small>全周期平均</small></div>)}</section></details>}
        {visiblePlanets.map(planet=>{
          const priority={geyser:0,unknown:1,circulator:2}
          const rows=filtered.filter(g=>g.planetId===planet.id).sort((a,b)=>priority[a.kind]-priority[b.kind]||a.typeName.localeCompare(b.typeName,'zh-CN')||a.x-b.x||a.y-b.y)
          if(!rows.length&&(query||typeId!=='all'))return null
          return <section className="resource-world surface" key={planet.id}>
            <header><div className="resource-world-title"><PlanetIcon planet={planet} large/><div><h2>{planet.name}</h2><p>{planet.type} · 星球 ID {planet.id}</p></div></div><span>{rows.length} 处喷泉</span></header>
            {!rows.length?<p className="resource-empty">该星球没有已记录的间歇泉。</p>:<div className="resource-table-scroll"><table className="resource-table"><thead><tr><th>喷泉 / 资源</th><th>喷发产量</th><th title="喷发产量 × 喷发占比 × 活跃占比">全周期平均</th><th>喷发 / 间隔</th><th>活跃 / 休眠</th><th>周期状态</th></tr></thead><tbody>{rows.map(g=><GeyserRows key={g.id} geyser={g} open={expanded===g.id} toggle={()=>setExpanded(expanded===g.id?null:g.id)} planetX={planet.x} planetY={planet.y} locate={()=>onLocate(g,{planetId,query,typeId,expanded})}/>)}</tbody></table></div>}
          </section>
        })}
        {!filtered.length&&(query||typeId!=='all')&&<section className="resource-empty surface">没有匹配的喷泉，请调整搜索或种类筛选。</section>}
      </div>
    </div>
  </div>
}

function GeyserRows({geyser:g,open,toggle,planetX,planetY,locate}:{geyser:GeyserStatistics;open:boolean;toggle:()=>void;planetX:number;planetY:number;locate:()=>void}) {
  const details=[['英文类型 ID',g.typeId],['预制体 ID',g.tag],['全局位置',`${number(g.x,2)}, ${number(g.y,2)}`],['星球内位置',`${number(g.x-planetX,2)}, ${number(g.y-planetY,2)}`],['喷出温度',g.temperature===undefined?'—':`${number(g.temperature-273.15,2)} °C`],['超压阈值',g.maxPressure===undefined?'—':`${number(g.maxPressure)} kg/格`],['活跃期平均',resourceRate(g.activeAverageRate)],['每周期平均产量',g.massPerCycle===undefined?'—':`${number(g.massPerCycle,2)} kg/周期`],['单次喷发周期',seconds(g.iterationLength)],['活跃休眠总周期',cycles(g.yearLength)],['分析状态',g.studied?'已分析':'未分析'],['参数来源',g.parameterSource==='saved'?'存档实例参数':g.parameterSource==='rolls'?'存档随机参数计算':'未记录']]
  return <><tr className={open?'is-expanded':''}><td><div className="resource-geyser-actions"><button type="button" className="resource-geyser-expand" aria-label={`${open?'收起':'展开'} ${g.name} 数据`} aria-expanded={open} onClick={toggle}>{open?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button><button type="button" className="resource-geyser-name" title="在地图中定位并选中" aria-label={`定位 ${g.name}`} onClick={locate}><GeyserIcon geyser={g}/><span><strong>{g.name}</strong><small>{g.output} · X {Math.floor(g.x-planetX)} / Y {Math.floor(g.y-planetY)}</small></span><MapPin className="resource-locate-icon" size={14}/></button></div></td><td>{g.kind==='circulator'?'循环排液':resourceRate(g.emitRate)}</td><td><strong>{g.kind==='circulator'?'无新增资源':resourceRate(g.averageRate)}</strong>{g.massPerCycle!==undefined&&<small>{number(g.massPerCycle)} kg/周期</small>}</td><td><span>{seconds(g.eruptDuration)}</span><small>间隔 {seconds(g.idleDuration)}</small></td><td><span>{cycles(g.activeDuration)}</span><small>休眠 {cycles(g.dormantDuration)}</small></td><td><span className={`resource-status resource-status-${g.activity}`}>{status(g)}</span>{g.remainingSeason!==undefined?<small>{g.activity==='dormant'?'距活跃':'距休眠'} {cycles(g.remainingSeason)}</small>:g.activity==='active'&&g.dormantDuration===0?<small>无休眠</small>:null}{g.activity==='active'&&g.eruption&&<small>{g.eruption==='on'?'喷发时段':'间歇时段'}</small>}</td></tr>{open&&<tr className="resource-detail-row"><td colSpan={6}><dl>{details.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{g.note&&<p>{g.note}</p>}</td></tr>}</>
}

function PlanetIcon({planet,large=false}:{planet:ResourcePlanet;large?:boolean}) {
  const path=planet.iconAnimation?ONI_PLANET_ICONS[planet.iconAnimation]:undefined
  const [failedPath,setFailedPath]=useState<string>()
  return <span className={`resource-planet-icon${large?' is-large':''}`} aria-hidden="true">{path&&failedPath!==path?<img src={`${import.meta.env.BASE_URL.replace(/\/$/,'')}${path}`} alt="" loading="lazy" decoding="async" onError={()=>setFailedPath(path)}/>:<Globe2 size={large?26:18}/>}</span>
}

function GeyserIcon({geyser}:{geyser:GeyserStatistics}) {
  const path=geyserIcons.get(geyser.typeId)??geyserTextureForTag(geyser.tag)?.path
  const [failedPath,setFailedPath]=useState<string>()
  return <span className="resource-geyser-icon" aria-hidden="true">{path&&failedPath!==path?<img src={`${import.meta.env.BASE_URL.replace(/\/$/,'')}${path}`} alt="" loading="lazy" decoding="async" onError={()=>setFailedPath(path)}/>:<Waves size={18}/>}</span>
}
