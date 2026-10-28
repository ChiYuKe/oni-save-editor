"""Extract selectable cluster metadata and translations, never world-generation results."""
import ast,json,re,sys
from pathlib import Path
root=Path(sys.argv[1]);out=Path(sys.argv[2]) if len(sys.argv)>2 else Path(__file__).resolve().parents[1]/'src/lib/oniSeedClusters.generated.ts'
po=(root/'Assets/StreamingAssets/strings/strings_preinstalled_zh_klei.po').read_text(encoding='utf-8-sig')
names={}
for block in re.split(r'\n\s*\n',po):
 key='';value='';field=''
 for line in block.splitlines():
  if line.startswith('msgctxt '):key=ast.literal_eval(line[8:]);field='key'
  elif line.startswith('msgstr '):value=ast.literal_eval(line[7:]);field='value'
  elif line.startswith('msgid '):field='id'
  elif line.startswith('"') and field=='value':value+=ast.literal_eval(line)
 if key and value:names[key]=re.sub(r'<[^>]*>','',value)
base=root/'Assets/StreamingAssets';folders=[(base/'worldgen/clusters','')]+[(folder/'worldgen/clusters',folder.name+'::') for folder in sorted((base/'dlc').iterdir()) if folder.is_dir()]
from PIL import Image
import importlib.util
spec=importlib.util.spec_from_file_location('oni_kanim',Path(__file__).with_name('render-oni-kanims.py'))
kanim=importlib.util.module_from_spec(spec);spec.loader.exec_module(kanim)
def resolve_world(world):
 scope,relative=world.split('::',1) if '::' in world else ('',world)
 return (base/'dlc'/scope/'worldgen'/relative if scope else base/'worldgen'/relative).with_suffix('.yaml')
records=[]
for folder,scope in folders:
 for file in sorted(folder.glob('*.yaml')):
  text=file.read_text(encoding='utf-8-sig')
  def field(key):
   found=re.search(r'^'+re.escape(key)+r':\s*([^\n#]+)',text,re.M)
   return found.group(1).strip() if found else ''
  prefix=field('coordinatePrefix');key=field('name')
  if not prefix or field('skip') in ('Always','EditorOnly','99','100'):continue
  def ids(key):
   value=field(key)
   return [x.strip().strip('\"\'') for x in value.strip('[]').split(',') if x.strip()] if value else []
  worlds=re.findall(r'^\s*-\s*world:\s*([^#\s]+)',text,re.M)
  world=resolve_world(worlds[int(field('startWorldIndex') or '0')]).read_text(encoding='utf-8-sig')
  icon_match=re.search(r'^asteroidIcon:\s*([^#\s]+)',world,re.M)
  icon_name=icon_match.group(1) if icon_match else 'asteroid_sandstone_start_kanim'
  icon='/assets/planets/cluster-'+icon_name+'.webp'
  target=out.parents[2]/'public'/icon.lstrip('/')
  target.parent.mkdir(parents=True,exist_ok=True)
  if icon_name.endswith('_kanim'):
   anim_name=icon_name.removesuffix('_kanim')
   frame=kanim.frame_for_bank(kanim.parse_anim(root/'Assets/TextAsset'/(anim_name+'_anim.bytes')),'idle_loop')
   assert frame is not None,f'Missing native icon frame: {icon_name}'
   image,*_=kanim.render(root/'Assets/Texture2D'/(anim_name+'_0.png'),kanim.parse_build(root/'Assets/TextAsset'/(anim_name+'_build.bytes')),frame)
  else:
   texture=root/'Assets/Texture2D'/(icon_name+'.png')
   assert texture.exists(),f'Missing native cluster icon: {icon_name}'
   image=Image.open(texture).convert('RGBA')
  image=image.crop(image.getchannel('A').getbbox())
  image.thumbnail((320,320),Image.Resampling.LANCZOS)
  image.save(target,format='WEBP',lossless=True,method=6)
  records.append(dict(id=scope+'clusters/'+file.stem,name=names.get(key,key.split('.')[-2].replace('_',' ').title()),prefix=prefix,icon=icon,required=ids('requiredDlcIds'),forbidden=ids('forbiddenDlcIds')))
assert len(records)>20
out.write_text('// Generated from native cluster YAML headers and Chinese localization. No simulated results.\nexport const ONI_SEED_CLUSTERS = '+json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Generated {len(records)} native cluster choices')
