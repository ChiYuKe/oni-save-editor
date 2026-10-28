import {ThemeToggle} from './ThemeToggle'
import {useEffect,useRef,useState} from 'react'
import {ArrowLeft, Cpu, Download, Map, Play} from 'lucide-react'
import {SelectMenu} from './SelectMenu'
import {ONI_SEED_CLUSTERS} from './lib/oniSeedClusters.generated'
import './seedCalculator.css'

const endpoint=import.meta.env.DEV && import.meta.env.VITE_ONI_SEED_ENDPOINT ? String(import.meta.env.VITE_ONI_SEED_ENDPOINT) : 'http://127.0.0.1:5191'
const companionDownload='https://github.com/ChiYuKe/oni-save-editor/releases/download/seed-companion-v0.2.1-preview.1/OniSeedCompanion-win-x64.zip'
const dlcs=[['EXPANSION1_ID','眼冒金星'],['DLC2_ID','寒霜行星包'],['DLC3_ID','仿生强化包'],['DLC4_ID','史前行星包'],['DLC5_ID','海洋行星包'],['COSMETIC1_ID','装饰包']]
type Progress={id:string;status:string;message:string;coordinate?:string;worldCount?:number;engineId?:string}
async function request(path:string,init?:RequestInit){const response=await fetch(endpoint+path,{...init,signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw new Error(data.message);return data}
export function SeedCalculator({onBack,onGenerated}:{onBack:()=>void;onGenerated:(file:File)=>Promise<void>}){
  const [nativeCompanion,setNativeCompanion]=useState(false)
  const [supportsWarmup,setSupportsWarmup]=useState(false)
  const [connected,setConnected]=useState(false),[error,setError]=useState(''),[input,setInput]=useState(''),[cluster,setCluster]=useState('expansion1::clusters/SandstoneStartCluster')
  const [selected,setSelected]=useState<string[]>(['EXPANSION1_ID']),[progress,setProgress]=useState<Progress|null>(null)
  const [busy,setBusy]=useState(false),[elapsed,setElapsed]=useState(0)
  const started=useRef(0), mounted=useRef(true)
  const available=ONI_SEED_CLUSTERS.filter(c=>c.required.every(id=>selected.includes(id))&&!c.forbidden.some(id=>selected.includes(id)))
  const effectiveCluster=available.some(c=>c.id===cluster)?cluster:available[0]?.id||''
  useEffect(()=>{mounted.current=true;void request('/health').then(health=>{setConnected(true);setSupportsWarmup(health.supportsWarmup===true);setNativeCompanion(health.nativeRuntime===true && health.requiresUnityEditor===false)}).catch(()=>setConnected(false));return()=>{mounted.current=false}},[])
  const dlcKey=[...selected].sort().join(',')
  useEffect(()=>{
    if(!connected||!supportsWarmup||busy)return
    const timer=setTimeout(()=>{void fetch(endpoint+'/warmup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dlcKey?dlcKey.split(','):[]),signal:AbortSignal.timeout(5000)}).catch(()=>{})},800)
    return()=>clearTimeout(timer)
  },[connected,supportsWarmup,busy,dlcKey])
  useEffect(()=>{if(!busy)return;const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-started.current)/1000)),1000);return()=>clearInterval(timer)},[busy])
  const connect=async()=>{setError('');try{const health=await request('/health');setConnected(true);setSupportsWarmup(health.supportsWarmup===true);setNativeCompanion(health.nativeRuntime===true && health.requiresUnityEditor===false)}catch{setConnected(false);setError('无法连接本机演算引擎。请先打开独立演算器，并允许浏览器访问本地网络。')}}
  const calculate=async()=>{
    if(busy)return
    setError('');setBusy(true);setElapsed(0);started.current=Date.now()
    try{
      const coordinate=input.trim(),numeric=/^\d+$/.test(coordinate)
      if(!coordinate)throw new Error('请输入数字种子或游戏中的完整坐标码')
      const job=await request('/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...(numeric?{seed:Number(coordinate),cluster:effectiveCluster}:{coordinate}),dlcIds:selected})}) as Progress
      let state=job
      for(;;){
        if(!mounted.current)return
        setProgress(state)
        if(state.status==='failed')throw new Error(state.message)
        if(state.status==='complete'){
          const response=await fetch(endpoint+'/jobs/'+job.id+'/save',{signal:AbortSignal.timeout(120000)})
          if(!response.ok)throw new Error('无法读取引擎生成结果')
          await onGenerated(new File([await response.arrayBuffer()],`种子-${numeric?coordinate:(state.coordinate?.match(/-(\d+)-/)?.[1]??'演算结果')}.sav`,{type:'application/octet-stream'}))
          break
        }
        await new Promise(resolve=>setTimeout(resolve,500))
        if(!mounted.current)return
        state=await request('/jobs/'+job.id) as Progress
      }
    }catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'演算失败')}
    finally{if(mounted.current)setBusy(false)}
  }
  return <main className="seed-page">
    <div className="seed-top"><button className="seed-back" onClick={onBack} disabled={busy}><ArrowLeft size={16}/>返回首页</button><ThemeToggle/></div>
    <header><div className="eyebrow">NATIVE WORLD GENERATION</div><h1>种子演算</h1><p>在本机运行游戏生成流程，查看所有星球的地图与间歇泉。</p></header>
    <div className="seed-grid"><section className="seed-panel"><h2><Cpu size={19}/>生成设置</h2>
      <label>种子 / 完整坐标码<input value={input} onChange={e=>setInput(e.target.value)} placeholder="1234567 或 SNDST-…" disabled={busy}/></label>
      {/^\d*$/.test(input)&&<fieldset disabled={busy}><legend>星群类型</legend><SelectMenu label="星群类型" value={effectiveCluster} options={available.map(c=>({value:c.id,label:`${c.name} · ${c.prefix}`}))} onChange={setCluster}/><p className="seed-note">完整坐标码会自动解析星群与混入设置。</p></fieldset>}
      <fieldset disabled={busy}><legend>引擎 DLC 组合</legend><div className="seed-dlcs">{dlcs.map(([id,name])=><label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={e=>setSelected(e.target.checked?[...selected,id]:selected.filter(x=>x!==id))}/>{name}</label>)}</div></fieldset>
      <p className="seed-note">引擎按所选 DLC 启动，缺少内容时会明确报错。数字种子使用生存模式默认设置、关闭故事与内容混入；完整坐标码沿用其中设置。</p>
      <button className="button button-primary" disabled={!connected||busy} onClick={()=>void calculate()}><Play size={15}/>{busy?'引擎演算中…':'开始演算'}</button>
    </section><aside className="seed-panel"><h2><Map size={19}/>演算状态</h2>
      <div className="seed-connection"><span className={connected?'status-dot':''}/>{connected?(nativeCompanion?'独立演算器已连接':'本机引擎已连接'):'等待本机演算器'}<button onClick={()=>void connect()}>重新连接</button></div>
      {!connected&&<p className="seed-note">下载并解压 Windows 演算器，双击启动后选择游戏目录。无需 Unity 编辑器或手动安装模组。</p>}
      <a className="seed-download" href={companionDownload} target="_blank" rel="noreferrer"><Download size={16}/>下载 Windows 演算器（预览版）</a>
      {supportsWarmup&&<p className="seed-note">已启用提前预载：填写种子时准备引擎，查看结果时准备下一次演算。相同设置的已生成种子直接读取缓存。</p>}
      <ol className="seed-stages">{[['starting','启动游戏引擎'],['generating','生成星群与地形'],['spawning','生成原生对象与泉数据'],['complete','打开地图与资源统计']].map(([stage,label])=><li key={stage} data-active={progress?.status===stage}>{label}</li>)}</ol>
      {busy&&<p role="status">已用时 {elapsed} 秒 · 正在执行游戏原生生成流程</p>}
      {progress?.coordinate&&<p className="seed-coordinate">{progress.coordinate}</p>}
      {progress?.worldCount? <p>{progress.worldCount} 个星球</p>:null}
      {error&&<p className="seed-error" role="alert">{error}</p>}
      <p className="seed-note">生成完成后复用现有高清地图和资源统计。结果仅来自本机引擎，不上传个人存档。</p>
    </aside></div>
  </main>
}
