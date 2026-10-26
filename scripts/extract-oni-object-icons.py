"""Bake compact native UI icons for object groups. Usage: script <ExportedProject>."""
import importlib.util,json,re,sys,hashlib
from pathlib import Path
from PIL import Image
project=Path(__file__).resolve().parents[1];root=Path(sys.argv[1])/'Assets'
spec=importlib.util.spec_from_file_location('oni_kanim',project/'scripts/render-oni-kanims.py')
kanim=importlib.util.module_from_spec(spec);spec.loader.exec_module(kanim)
out=project/'public/assets/object-icons';out.mkdir(parents=True,exist_ok=True)
icons={};cache={};failed=[]
def save_icon(key,image):
 box=image.getchannel('A').getbbox()
 if not box:return None
 image=image.crop(box);image.thumbnail((64,64),Image.Resampling.LANCZOS)
 file=hashlib.sha256(key.encode()).hexdigest()[:20]+'.webp'
 image.save(out/file,format='WEBP',lossless=True,method=6)
 return '/assets/object-icons/'+file

def bake(animation,default='idle',prefix=''):
 key=(animation,default,prefix)
 if key in cache:return cache[key]
 name=animation.removesuffix('_kanim')
 png=root/'Texture2D'/(name+'_0.png');build=root/'TextAsset'/(name+'_build.bytes');anim=root/'TextAsset'/(name+'_anim.bytes')
 if not all(p.exists() for p in [png,build,anim]):cache[key]=None;return None
 try:
  banks=kanim.parse_anim(anim)
  variants=[]
  for stem in [name,name+'_build']:
   bp=root/'TextAsset'/(stem+'_build.bytes');pp=root/'Texture2D'/(stem+'_0.png')
   if bp.exists() and pp.exists():
    symbols,names=kanim.parse_build_with_names(bp,hide_locators=True)
    if prefix:
     symbols,_=kanim.symbols_with_affix_override(symbols,{h:n for h,n in names.items() if h in symbols},prefix)
    variants.append((pp,symbols,names))
  frames=[frame for state in ['ui',default,'idle_full','idle_loop','object','idle'] if (frame:=kanim.frame_for_bank(banks,state)) is not None]
  frames.extend(frame for _,frame in kanim.candidate_frames(banks))
  result=None
  for frame in frames:
   try:
    image,*_=kanim.render_from_variants(variants,frame)
    result=save_icon(animation+':'+default+':'+prefix,image)
    if result:break
   except ValueError:continue
  if not result:raise ValueError('No drawable native frame')
 except Exception as error:
  failed.append((animation,str(error)));result=None
 cache[key]=result
 return result

for definition in kanim.definitions(project/'src/lib/oniBuildingDefs.generated.ts'):
 path=bake(definition['animation'],definition['defaultAnim'],definition.get('symbolOverridePrefix',''))
 if path:icons[definition['id'].lower()]=path
# Substance pickup KAnims are referenced by GUID rather than prefab definitions.
guid_to_anim={}
for meta in (root/'MonoBehaviour').glob('*_kanim.asset.meta'):
 match=re.search(r'^guid: (\w+)',meta.read_text(),re.M)
 if match:guid_to_anim[match[1]]=meta.name.removesuffix('.asset.meta')
hash_names={int(value):name for name,value in re.findall(r'^\s*(\w+) = (-?\d+)',(root/'Scripts/Assembly-CSharp/SimHashes.cs').read_text(),re.M)}
for hookup in [root/'Resources/SubstanceHookup.asset',*(root/'MonoBehaviour').glob('*SubstanceHookup.asset')]:
 for block in re.split(r'(?m)^  - name: ',hookup.read_text())[1:]:
  name=block.splitlines()[0].strip();element=re.search(r'elementID: (-?\d+)',block)
  if element:name=hash_names.get(int(element[1]),name)
  match=re.search(r'anim: \{[^}]*guid: (\w+)',block)
  animation=guid_to_anim.get(match[1]) if match else None
  if animation and (path:=bake(animation,'object')):icons[name.lower()]=path
# Seed and egg animations are explicitly paired with their generated IDs in configs.
for config in (root/'Scripts/Assembly-CSharp').glob('*Config.cs'):
 source=config.read_text(encoding='utf-8-sig')
 for constant,token in [('SEED_ID','seed'),('EGG_ID','egg')]:
  tag=re.search(r'const string '+constant+r' = "([^"\n]+)"',source)
  animations=set(re.findall(r'"([^"\n]*'+token+r'[^"\n]*_kanim)"',source))
  if tag and len(animations)==1:
   if path:=bake(next(iter(animations)),'object'):icons[tag[1].lower()]=path
# Existing exact prefab/animation sprites cover special cases without additional large downloads.
manifest=json.loads((project/'public/assets/buildings/manifest.json').read_text())
for key,record in manifest.items():
 if '__' in key or key in icons:continue
 file=project/'public'/record['path'].lstrip('/')
 if file.exists():
  path=save_icon(record['path'],Image.open(file).convert('RGBA'))
  if path:icons[key]=path
(project/'src/lib/oniObjectIcons.generated.ts').write_text('// Generated native UI icons; scripts/extract-oni-object-icons.py.\nexport const ONI_OBJECT_ICONS: Readonly<Record<string,string>> = '+json.dumps(icons,indent=2,sort_keys=True)+'\n',encoding='utf-8')
used={Path(path).name for path in icons.values()}
for file in out.glob('*.webp'):
 if file.name not in used:file.unlink()
print(json.dumps({'tags':len(icons),'images':len(list(out.glob('*.webp'))),'bytes':sum(f.stat().st_size for f in out.glob('*.webp')),'renderFailures':failed},ensure_ascii=False))
