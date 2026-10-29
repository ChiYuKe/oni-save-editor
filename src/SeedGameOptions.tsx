import { useEffect, useState } from 'react'
import { SelectMenu } from './SelectMenu'

export type SeedChoice = {id:string;value:string}
export type SeedOptions = {mode:'survival'|'nosweat';quality:SeedChoice[];stories:SeedChoice[];mixing:SeedChoice[]}
type Setting = {id:string;label:string;tooltip:string;survivalDefault:string;nosweatDefault:string;levels:{id:string;label:string}[]}
type Catalog = {ready:boolean;dlcIds:string[];quality:Setting[];stories:Setting[];mixing:Setting[]}
const clean=(text:string)=>text.replace(/<[^>]+>/g,'')
export function SeedGameOptions({endpoint,dlcKey,disabled,onChange}:{endpoint:string;dlcKey:string;disabled:boolean;onChange:(key:string,options:SeedOptions)=>void}) {
  const [catalog,setCatalog]=useState<Catalog|null>(null),[error,setError]=useState('')
  const [settingsKey,setSettingsKey]=useState(dlcKey)
  const [mode,setMode]=useState<'survival'|'nosweat'>('survival')
  const [values,setValues]=useState<Record<string,Record<string,string>>>({quality:{},stories:{},mixing:{}})
  useEffect(()=>{
    let active=true,timer:ReturnType<typeof setTimeout>|undefined
    const controller=new AbortController()
    setSettingsKey(dlcKey);setCatalog(null);setError('');setMode('survival');setValues({quality:{},stories:{},mixing:{}})
    const poll=async()=>{
      try {
        const response=await fetch(`${endpoint}/settings?dlcs=${encodeURIComponent(dlcKey)}`,{signal:controller.signal})
        if(!response.ok)throw new Error('无法读取游戏开局设置')
        const data=await response.json() as Catalog
        if(!active)return
        if(data.ready&&[...data.dlcIds].sort().join(',')===dlcKey){setCatalog(data);setError('');return}
        await fetch(`${endpoint}/warmup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dlcKey?dlcKey.split(','):[]),signal:controller.signal})
      }catch(cause){if(!active)return;setError(cause instanceof Error?cause.message:'无法读取游戏开局设置')}
      if(active)timer=setTimeout(()=>void poll(),1500)
    }
    void poll()
    return()=>{active=false;controller.abort();if(timer)clearTimeout(timer)}
  },[endpoint,dlcKey])
  useEffect(()=>{
    if(settingsKey!==dlcKey)return
    const choices=(group:string)=>Object.entries(values[group]).map(([id,value])=>({id,value}))
    onChange(dlcKey,{mode,quality:choices('quality'),stories:choices('stories'),mixing:choices('mixing')})
  },[mode,values,dlcKey,settingsKey,onChange])
  const change=(group:string,id:string,value:string)=>setValues(current=>({...current,[group]:{...current[group],[id]:value}}))
  return <fieldset className="seed-game-options" disabled={disabled}>
    <legend>开局设置 <span className="seed-options-source">读取自游戏</span></legend>
    {!catalog?<p className="seed-note" role="status">{error||'正在预载引擎并读取设置；也可以直接使用默认设置开始。'}</p>:<>
      <div className="seed-option-row"><span>游戏预设</span><SelectMenu label="游戏预设" value={mode} options={[{value:'survival',label:'生存模式'},{value:'nosweat',label:'轻松模式'}]} onChange={value=>{setMode(value as typeof mode);setValues(current=>({...current,quality:{}}))}}/></div>
      {(['quality','stories','mixing'] as const).map((group,index)=><details key={group} className="seed-option-group"><summary>{['难度与规则','故事特质','内容混入'][index]}<span>{catalog[group].length} 项</span></summary>
        {catalog[group].map(setting=>{const fallback=group==='stories'?'Disabled':group==='quality'&&mode==='nosweat'?setting.nosweatDefault:setting.survivalDefault;return <div className="seed-option-row" key={setting.id} title={clean(setting.tooltip)}><span>{clean(setting.label)||setting.id}</span><SelectMenu label={clean(setting.label)||setting.id} value={values[group][setting.id]??fallback} options={setting.levels.map(level=>({value:level.id,label:clean(level.label)||(group==='stories'?(level.id==='Guaranteed'?'保证生成':'关闭'):level.id)}))} onChange={value=>change(group,setting.id,value)}/></div>})}
        {!catalog[group].length&&<p className="seed-note">当前 DLC 组合没有可用选项。</p>}
      </details>)}
      <p className="seed-note">切换预设会恢复对应难度。内容混入受星群和 DLC 组合限制，不兼容时引擎会说明原因。</p>
    </>}
  </fieldset>
}
