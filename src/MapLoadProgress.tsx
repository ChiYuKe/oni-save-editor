import './mapLoadProgress.css'
export type MapLoadStage = 'reading' | 'display' | 'details' | 'error'
export interface MapLoadCount { completed:number; total:number; pending:number }
export function MapLoadProgress({stage,detail,counts}:{stage:MapLoadStage;detail?:string;counts?:MapLoadCount}) {
  const current=stage==='reading'?0:stage==='display'?1:2
  return <section className={`map-load-progress ${stage==='reading'?'save-load-progress':'map-loading-status'}`} data-stage={stage} role="status" aria-live="polite" aria-busy={stage!=='error'}>
    <strong>{stage==='reading'?'正在读取存档':stage==='display'?'正在显示地图':stage==='error'?'地图加载未完成':'正在补齐高清细节'}</strong>
    <ol aria-label="地图加载阶段">{['读取存档','显示地图','补齐高清细节'].map((name,index)=><li key={name} data-state={index<current?'done':index===current?'active':'waiting'}>{name}</li>)}</ol>
    <p>{detail??'正在读取文件并解析世界数据…'}</p>
    {counts&&counts.total>0&&<><progress aria-label="当前视野地图分块" max={counts.total} value={counts.completed}/><small>当前视野 {counts.completed} / {counts.total} 块{counts.pending>0?` · 待补图像 ${counts.pending} 项`:''}</small></>}
  </section>
}
