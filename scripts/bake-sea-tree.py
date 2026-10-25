"""Bake SeaTree roots and segmented branches, with the native tracked fruit meter."""
import importlib.util
import json
import sys
from pathlib import Path
project = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv)>1 else Path('E:/Unity/NOI1018/ExportedProject/Assets')
spec=importlib.util.spec_from_file_location('kanims',project/'scripts/render-oni-kanims.py')
k=importlib.util.module_from_spec(spec);spec.loader.exec_module(k)
symbols,names=k.parse_build_with_names(source/'TextAsset/sea_fairy_plant_build.bytes',hide_locators=True)
banks=dict(k.parse_anim(source/'TextAsset/sea_fairy_plant_anim.bytes'))
atlas=source/'Texture2D/sea_fairy_plant_0.png'
manifest_path=project/'public/assets/buildings/manifest.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
out=project/'public/assets/buildings/sea-tree';out.mkdir(parents=True,exist_ok=True)
count=0
def bake(suffix,frame):
 global count
 key='sea_fairy_plant__'+suffix
 image,left,top,right,bottom=k.render(atlas,symbols,frame)
 k.save_png(image,out/(key+'.png'))
 manifest[key]=dict(path='/assets/buildings/sea-tree/'+key+'.png',widthCells=(right-left)/200,heightCells=(bottom-top)/200,anchorOffsetXCells=(left+right)/400,anchorOffsetYCells=(top+bottom)/400,source='sea_fairy_plant_kanim:'+suffix)
 count+=1
# Compose the meter through its locator affine transform, including its rotation.
def with_fruit(frame,fruit):
 target=next(e for e in frame if names.get(e[0])=='bulb_meter_target')
 a,b,c,d,x,y=target[6:12]
 result=[]
 for e in fruit:
  u,v,w,z,tx,ty=e[6:12]
  result.append(e[:6]+(a*u+c*v,b*u+d*v,a*w+c*z,b*w+d*z,a*tx+c*ty+x,b*tx+d*ty+y,e[12]))
 return result+[e for e in frame if names.get(e[0])!='bulb_meter_target']
for bank in ['idle_full','grow_pst','wilt1','wilt2','wilt3']:
 bake(bank,banks[bank][0])
for i,frame in enumerate(banks['grow']):bake('grow__'+str(i),frame)
fruit_banks=['bulb_meter_ready','bulb_meter_birth','bulb_meter_wilt1','bulb_meter_wilt2','bulb_meter_wilt3']
for prefix in ['branch_','end_branch_']:
 for i,frame in enumerate(banks[prefix+'grow']):bake(prefix+'grow__'+str(i),frame)
 for state in ['idle','wilted1','wilted2','wilted3']:
  bank=prefix+state;frame=banks[bank][0]
  bake(bank,frame)
  for i,fruit in enumerate(banks['bulb_meter_grow']):bake(bank+'__bulb_meter_grow__'+str(i),with_fruit(frame,fruit))
  for fruit_bank in fruit_banks:bake(bank+'__'+fruit_bank,with_fruit(frame,banks[fruit_bank][0]))
manifest_path.write_text(json.dumps(dict(sorted(manifest.items())),indent=2),encoding='utf-8')
print(f'Baked {count} SeaTree frames.')
