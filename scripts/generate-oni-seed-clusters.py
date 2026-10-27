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
  records.append(dict(id=scope+'clusters/'+file.stem,name=names.get(key,key.split('.')[-2].replace('_',' ').title()),prefix=prefix,required=ids('requiredDlcIds'),forbidden=ids('forbiddenDlcIds')))
assert len(records)>20
out.write_text('// Generated from native cluster YAML headers and Chinese localization. No simulated results.\nexport const ONI_SEED_CLUSTERS = '+json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Generated {len(records)} native cluster choices')
