"""Generate resource metadata from the local exported Unity source and Chinese strings.
Usage: python scripts/generate-oni-resource-data.py <ExportedProject>
"""
import ast, json, re, sys
from pathlib import Path
root=Path(sys.argv[1]); target=Path(__file__).resolve().parents[1]/'src/lib/oniResourceData.generated.ts'
po=(root/'Assets/StreamingAssets/strings/strings_preinstalled_zh_klei.po').read_text(encoding='utf-8-sig')
strings={}
for block in re.split(r'\n\s*\n',po):
 context='';translated='';field=''
 for line in block.splitlines():
  if line.startswith('msgctxt '): context=ast.literal_eval(line[8:]);field='context'
  elif line.startswith('msgstr '): translated=ast.literal_eval(line[7:]);field='translation'
  elif line.startswith('msgid '):field='id'
  elif line.startswith('"') and field=='translation':translated+=ast.literal_eval(line)
 if translated and context.endswith('.NAME') and (context.startswith('STRINGS.WORLDS.') or context.startswith('STRINGS.CREATURES.SPECIES.GEYSER.') or context.startswith('STRINGS.ELEMENTS.')):
  strings[context]=re.sub(r'<[^>]+>','',translated)
def hash_id(text):
 h=0
 for c in text.lower():h=(ord(c)+h*65599)&0xffffffff
 return h if h<2**31 else h-2**32
def number(text):
 text=re.sub(r'(?<=\d)[fFdD]\b','',text.strip())
 node=ast.parse(text,mode='eval').body
 def calc(n):
  if isinstance(n,ast.Constant) and type(n.value) in (int,float):return n.value
  if isinstance(n,ast.UnaryOp) and isinstance(n.op,ast.USub):return -calc(n.operand)
  if isinstance(n,ast.BinOp) and isinstance(n.op,(ast.Add,ast.Sub,ast.Mult,ast.Div)):
   a,b=calc(n.left),calc(n.right)
   return {ast.Add:lambda:a+b,ast.Sub:lambda:a-b,ast.Mult:lambda:a*b,ast.Div:lambda:a/b}[type(n.op)]()
  raise ValueError(text)
 return calc(node)
source=(root/'Assets/Scripts/Assembly-CSharp/GeyserGenericConfig.cs').read_text(encoding='utf-8')
defaults=[60,1140,.1,.9,15000,135000,.4,.8,372.15]
fields=['minIterationLength','maxIterationLength','minIterationPercent','maxIterationPercent','minYearLength','maxYearLength','minYearPercent','maxYearPercent','geyserTemperature']
records=[]
for match in re.finditer(r'new GeyserConfigurator.GeyserType\(([^)]+)\)',source):
 args=[s.strip() for s in match.group(1).split(',')];id=ast.literal_eval(args[0]);element=args[1].split('.')[-1]
 record={'id':id,'hash':hash_id(id),'name':strings.get('STRINGS.CREATURES.SPECIES.GEYSER.'+id.upper()+'.NAME',id),'element':element,'elementHash':hash_id(element)&65535,'temperature':number(args[3]),'minRatePerCycle':number(args[4]),'maxRatePerCycle':number(args[5]),'maxPressure':number(args[6])}
 record.update({f:number(args[i+9]) if len(args)>i+9 else defaults[i] for i,f in enumerate(fields)})
 records.append(record)
assert len(records)>=25, 'Expected native geyser definitions'
body='// Generated from GeyserGenericConfig.cs and strings_preinstalled_zh_klei.po.\n// Regenerate with scripts/generate-oni-resource-data.py <ExportedProject>.\n'
body+='export const ONI_GEYSER_TYPES = '+json.dumps(records,ensure_ascii=False,indent=2)+' as const\n'
body+='export const ONI_RESOURCE_NAMES: Readonly<Record<string,string>> = '+json.dumps(strings,ensure_ascii=False,indent=2)+'\n'
target.write_text(body,encoding='utf-8')
print(f'Generated {len(records)} geyser types and {len(strings)} localized resource names')
