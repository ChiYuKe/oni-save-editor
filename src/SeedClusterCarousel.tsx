import {useEffect,useRef,useState} from 'react'
import {ChevronLeft,ChevronRight,Globe2} from 'lucide-react'

type Cluster={id:string;name:string;prefix:string;icon:string}
export function SeedClusterCarousel({value,options,onChange,disabled=false}:{value:string;options:readonly Cluster[];onChange:(id:string)=>void;disabled?:boolean}){
  const track=useRef<HTMLDivElement>(null)
  const timer=useRef<number|undefined>(undefined)
  const scrollChoice=useRef('')
  const wheelState=useRef({delta:0,at:0})
  const previousOptions=useRef('')
  const optionsKey=options.map(option=>option.id).join('|')
  const index=options.findIndex(option=>option.id===value),current=options[index]
  useEffect(()=>{
    const element=track.current,button=element?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
    if(!element||!button)return
    const changed=previousOptions.current!==optionsKey
    previousOptions.current=optionsKey
    if(scrollChoice.current===value&&!changed){scrollChoice.current='';return}
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollTo({left:button.offsetLeft-(element.clientWidth-button.offsetWidth)/2,behavior:changed||reduced?'instant':'smooth'})
  },[value,optionsKey])
  useEffect(()=>()=>window.clearTimeout(timer.current),[optionsKey,disabled])
  useEffect(()=>{
    const element=track.current
    if(!element)return
    const observer=new ResizeObserver(()=>{
      const button=element.querySelector<HTMLButtonElement>('[aria-checked="true"]')
      if(button)element.scrollTo({left:button.offsetLeft-(element.clientWidth-button.offsetWidth)/2,behavior:'instant'})
    })
    observer.observe(element)
    return()=>observer.disconnect()
  },[])
  useEffect(()=>{
    const element=track.current
    if(!element)return
    const wheel=(event:WheelEvent)=>{
      if(disabled||event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||element.scrollWidth<=element.clientWidth)return
      event.preventDefault()
      const amount=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?element.clientWidth:1)
      const now=performance.now()
      if(now-wheelState.current.at<140)return
      wheelState.current.delta+=amount
      if(Math.abs(wheelState.current.delta)<24)return
      const next=Math.max(0,Math.min(options.length-1,index+Math.sign(wheelState.current.delta)))
      wheelState.current={delta:0,at:now}
      if(options[next]){scrollChoice.current='';onChange(options[next].id)}
    }
    element.addEventListener('wheel',wheel,{passive:false})
    return()=>element.removeEventListener('wheel',wheel)
  },[disabled,optionsKey,index,onChange,options])
  function choose(next:number,focus=false){
    if(disabled||!options[next])return
    window.clearTimeout(timer.current)
    scrollChoice.current=''
    onChange(options[next].id)
    if(focus)track.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus({preventScroll:true})
  }
  function settled(){
    window.clearTimeout(timer.current)
    if(disabled)return
    timer.current=window.setTimeout(()=>{
      const element=track.current
      if(!element)return
      const center=element.scrollLeft+element.clientWidth/2
      const buttons=[...element.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
      const nearest=buttons.reduce((best,button,i)=>Math.abs(button.offsetLeft+button.offsetWidth/2-center)<Math.abs(buttons[best].offsetLeft+buttons[best].offsetWidth/2-center)?i:best,0)
      const id=options[nearest]?.id
      if(id&&id!==value){scrollChoice.current=id;onChange(id)}
    },180)
  }
  return <div className="seed-cluster-picker">
    <div className="seed-cluster-controls"><span>滚轮或左右滑动选择</span><div><button type="button" aria-label="上一个星群" disabled={disabled||index<=0} onClick={()=>choose(index-1)}><ChevronLeft size={16}/></button><button type="button" aria-label="下一个星群" disabled={disabled||index>=options.length-1} onClick={()=>choose(index+1)}><ChevronRight size={16}/></button></div></div>
    <div ref={track} className="seed-cluster-track" role="radiogroup" aria-label="星群类型" aria-disabled={disabled} onScroll={event=>{if(!('onscrollend' in event.currentTarget))settled()}} onScrollEnd={settled} onKeyDown={event=>{
      const next=event.key==='ArrowRight'?index+1:event.key==='ArrowLeft'?index-1:event.key==='Home'?0:event.key==='End'?options.length-1:undefined
      if(next!==undefined){event.preventDefault();choose(next,true)}
    }}>
      {options.map(option=><button type="button" key={option.id} role="radio" aria-checked={option.id===value} aria-label={`${option.name} · ${option.prefix}`} tabIndex={option.id===value?0:-1} disabled={disabled} onClick={()=>choose(options.indexOf(option))}><ClusterImage path={option.icon}/></button>)}
    </div>
    {current?<div className="seed-cluster-caption" aria-live="polite"><strong>{current.name}</strong><span>{current.prefix}<i/> {index+1} / {options.length}</span></div>:<p className="seed-note">当前 DLC 组合没有可选星群。</p>}
  </div>
}
function ClusterImage({path}:{path:string}){
  const [failed,setFailed]=useState(false)
  return failed?<Globe2 className="seed-cluster-fallback" size={80} aria-hidden="true"/>:<img src={`${import.meta.env.BASE_URL.replace(/\/$/,'')}${path}`} alt="" aria-hidden="true" draggable={false} decoding="async" loading="lazy" onError={()=>setFailed(true)}/>
}
