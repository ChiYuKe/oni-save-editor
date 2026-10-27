import {readFile,writeFile,copyFile} from 'node:fs/promises'
import path from 'node:path'
const args=process.argv.slice(2),index=args.indexOf('--project')
if(index<0||!args[index+1])throw new Error('Usage: node tools/seed-engine/setup.mjs --project PATH_TO_UNITY_PROJECT')
const project=path.resolve(args[index+1])
const patches=[
 ['Assets/Plugins/Assembly-CSharp-firstpass/Util.cs','ONI_SEED_ENGINE_ROOT','\tpublic static string RootFolder()\n\t{',`\tpublic static string RootFolder()\n\t{\n\t\t// Isolate native seed jobs from player saves.\n\t\tstring seedEngineRoot = Environment.GetEnvironmentVariable("ONI_SEED_ENGINE_ROOT");\n\t\tif (!string.IsNullOrEmpty(seedEngineRoot)) return Path.GetFullPath(seedEngineRoot);`],
 ['Assets/Plugins/Assembly-CSharp-firstpass/DlcManager.cs','ONI_SEED_ENGINE_DLCS','\tpublic static bool IsContentSubscribed(string dlcId)\n\t{',`\tpublic static bool IsContentSubscribed(string dlcId)\n\t{\n\t\tstring seedEngineDlcs = Environment.GetEnvironmentVariable("ONI_SEED_ENGINE_DLCS");\n\t\tif (seedEngineDlcs != null && !string.IsNullOrEmpty(dlcId) &&\n\t\t\t!Array.Exists(seedEngineDlcs.Split(','), value => value == dlcId)) return false;`]
]
// Read and validate both targets before modifying either file.
const changes=await Promise.all(patches.map(async([file,marker,from,to])=>{
 const dest=path.join(project,file),original=await readFile(dest,'utf8'),text=original.replaceAll('\r\n','\n')
 if(text.includes(marker))return null
 if(text.split(from).length!==2)throw new Error('Unsupported engine source signature: '+file)
 return {dest,original,text:text.replace(from,to)}
}))
for(const change of changes.filter(Boolean)){await writeFile(change.dest+'.seed-engine-backup',change.original,{flag:'wx'});await writeFile(change.dest,change.text)}
await copyFile(new URL('./SeedEngineBatch.cs',import.meta.url),path.join(project,'Assets/Editor/SeedEngineBatch.cs'))
console.log('Installed native seed adapter. World generation and geyser algorithms are unchanged.')
