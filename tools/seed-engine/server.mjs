import http from 'node:http'
import {spawn} from 'node:child_process'
import {readFile,writeFile,mkdir,stat,readdir} from 'node:fs/promises'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'

const args=process.argv.slice(2)
const arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback
const project=path.resolve(arg('--project',''))
const unity=arg('--unity','E:/Unity/Unity 6000.3.5f2/Editor/Unity.exe')
const port=Number(arg('--port','5191'))
const root=path.resolve(arg('--data',path.join(project,'../PreviewDiagnostics/seed-engine-jobs')))
if(!args.includes('--project')) throw new Error('--project is required')
await stat(path.join(project,'Assets/Editor/SeedEngineBatch.cs'))
await stat(unity)
await mkdir(root,{recursive:true})
async function engineFingerprint(){
 const fingerprint=createHash('sha256')
 async function visit(dir){
   const entries=(await readdir(path.join(project,dir),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))
   for(const entry of entries){const file=dir+'/'+entry.name;if(entry.isDirectory())await visit(file);else if(/\.(cs|dll|yaml|yml|json|txt|bytes)$/.test(entry.name)){fingerprint.update(file);fingerprint.update(await readFile(path.join(project,file)))}}
 }
 for(const dir of ['Assets/Editor','Assets/Scripts','Assets/Plugins','Assets/StreamingAssets'])await visit(dir)
 fingerprint.update(await readFile(path.join(project,'ProjectSettings/ProjectVersion.txt')))
 return fingerprint.digest('hex')
}
let engineId=await engineFingerprint()
// A per-run identifier prevents stale results surviving untracked data/mod changes.
const session=randomUUID(), jobs=new Map(), cache=new Map()
let active=null
const allowed=new Set(['https://chiyuke.github.io',arg('--origin','http://127.0.0.1:5178')])
function originAllowed(origin){if(!origin)return true; if(allowed.has(origin))return true; try{const u=new URL(origin);return ['http:','https:'].includes(u.protocol)&&['localhost','127.0.0.1'].includes(u.hostname)}catch{return false}}
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function progress(job){try{return {...JSON.parse(await readFile(path.join(job.dir,'progress.json'),'utf8')),id:job.id,engineId:job.engineId}}catch{return {id:job.id,status:job.status,message:job.message,engineId:job.engineId}}}
async function body(req){let data='';for await(const chunk of req){data+=chunk;if(data.length>8192)throw new Error('Request too large')}return JSON.parse(data)}
const server=http.createServer(async(req,res)=>{
  const host=req.headers.host||''
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(host)||!originAllowed(req.headers.origin))return json(res,403,{message:'Origin or host is not allowed'})
  if(req.headers.origin)res.setHeader('Access-Control-Allow-Origin',req.headers.origin)
  res.setHeader('Vary','Origin')
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers','Content-Type')
  if(req.headers['access-control-request-private-network']==='true')res.setHeader('Access-Control-Allow-Private-Network','true')
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  const url=new URL(req.url,'http://127.0.0.1:'+port)
  try{
    if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{engine:'ONI Unity native',engineId,session,busy:Boolean(active),protocol:1})
    if(req.method==='POST'&&url.pathname==='/jobs'){
      if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{message:'JSON is required'})
      const input=await body(req)
      if(!Array.isArray(input.dlcIds)||input.dlcIds.some(x=>!['EXPANSION1_ID','DLC2_ID','DLC3_ID','DLC4_ID','DLC5_ID','COSMETIC1_ID'].includes(x)))throw new Error('请选择明确的 DLC 组合')
      if(input.coordinate){if(typeof input.coordinate!=='string'||input.coordinate.length>200||!/^[-A-Za-z0-9]+$/.test(input.coordinate))throw new Error('坐标码格式无效')}
      else if(!Number.isInteger(input.seed)||input.seed<1||input.seed>2147483647||typeof input.cluster!=='string'||!/^[-A-Za-z0-9_/:]+$/.test(input.cluster))throw new Error('数字种子需要搭配有效的星群路径')
      if(active)return json(res,409,{message:'本机引擎正在演算另一个种子，请稍后再试。'})
      // Reserve before awaiting fingerprint I/O so two requests cannot start two editors.
      active='preparing'
      engineId=await engineFingerprint()
      const cacheKey=JSON.stringify([engineId,input.coordinate||'',input.seed||0,input.cluster||'',[...new Set(input.dlcIds)].sort()])
      const cached=cache.get(cacheKey)
      if(cached){active=null;return json(res,200,{...(await progress(cached)),cached:true})}
      const id=randomUUID(),dir=path.join(root,id)
      await mkdir(dir)
      const request={seed:input.seed||0,cluster:input.cluster||'',coordinate:input.coordinate||'',dlcIds:[...new Set(input.dlcIds)],outputDirectory:dir}
      await writeFile(path.join(dir,'request.json'),JSON.stringify(request))
      await writeFile(path.join(dir,'engine-info.json'),JSON.stringify({engineId,session,createdAt:new Date().toISOString()}))
      const job={id,dir,status:'starting',message:'正在启动本机游戏引擎',engineId}
      jobs.set(id,job);active=id
      const child=spawn(unity,['-batchmode','-force-d3d11','-projectPath',project,'-executeMethod','SeedEngineBatch.Run','-oniSeedRequest',path.join(dir,'request.json'),'-logFile',path.join(dir,'engine.log')],{windowsHide:true,stdio:'ignore'})
      job.child=child
      const finish=async(message)=>{
        const result=await progress(job)
        if(result.status==='complete')cache.set(cacheKey,job)
        if(result.status!=='complete'){
          job.status='failed';job.message=message
          if(result.status!=='failed')await writeFile(path.join(dir,'progress.json'),JSON.stringify({status:'failed',message}))
        }
        if(active===id)active=null
      }
      child.once('error',e=>{void finish(e.message)})
      child.once('exit',code=>{void finish('引擎退出，代码 '+code+'。请查看本机任务目录的 engine.log。')})
      const timeout=setTimeout(()=>{child.kill();void finish('本机引擎超过 22 分钟未完成，请查看任务日志。')},22*60000)
      child.once('exit',()=>clearTimeout(timeout))
      child.once('error',()=>clearTimeout(timeout))
      return json(res,202,{id,status:'starting',engineId})
    }
    const match=url.pathname.match(/^\/jobs\/([a-f0-9-]+)(\/save)?$/)
    const job=match&&jobs.get(match[1])
    if(req.method==='GET'&&job){
      const result=await progress(job)
      if(!match[2])return json(res,200,result)
      if(result.status!=='complete')return json(res,409,{message:'真实引擎尚未完成演算'})
      const bytes=await readFile(path.join(job.dir,'generated.sav'))
      res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);return
    }
    json(res,404,{message:'Not found'})
  }catch(e){if(active==='preparing')active=null;json(res,400,{message:e.message})}
})
server.listen(port,'127.0.0.1',()=>process.stdout.write(`ONI seed engine: http://127.0.0.1:${port}\n`))
