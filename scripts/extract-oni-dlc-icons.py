"""Extract the game's DlcManager mini-logo sprites from their native UI atlas."""
import re,sys
from pathlib import Path
from PIL import Image

root=Path(sys.argv[1])/'Assets'
target=Path(__file__).resolve().parents[1]/'public/assets/dlc'
target.mkdir(parents=True,exist_ok=True)
textures={}
for meta in (root/'Texture2D').glob('*.png.meta'):
 match=re.search(r'^guid: (\w+)',meta.read_text(encoding='utf-8-sig'),re.M)
 if match:textures[match[1]]=meta.with_suffix('')
for dlc in ['expansion1','dlc2','dlc3','dlc4','dlc5','cosmetic1']:
 sprite=(root/'Sprite'/(dlc+'_mini_logo.asset')).read_text(encoding='utf-8-sig')
 guid=re.search(r'    texture: \{[^}]*guid: (\w+)',sprite)[1]
 rect=re.search(r'    textureRect:\s*\n\s*serializedVersion: \d+\s*\n\s*x: ([\d.]+)\s*\n\s*y: ([\d.]+)\s*\n\s*width: ([\d.]+)\s*\n\s*height: ([\d.]+)',sprite)
 assert rect,dlc
 x,y,w,h=map(float,rect.groups())
 atlas=Image.open(textures[guid]).convert('RGBA')
 image=atlas.crop((round(x),round(atlas.height-y-h),round(x+w),round(atlas.height-y)))
 box=image.getchannel('A').getbbox()
 assert box,dlc
 image=image.crop(box)
 image.thumbnail((112,64),Image.Resampling.LANCZOS)
 image.save(target/(dlc+'.webp'),format='WEBP',lossless=True,method=6)
 print(dlc,image.size)
