"""Bake SpaceTree's state-specific trunk and directional branches (native anchors)."""
import importlib.util
import json
import sys
from pathlib import Path

project = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('E:/Unity/NOI1018/ExportedProject/Assets')
spec = importlib.util.spec_from_file_location('kanims', project / 'scripts/render-oni-kanims.py')
k = importlib.util.module_from_spec(spec)
spec.loader.exec_module(k)
symbols, names = k.parse_build_with_names(source / 'TextAsset/syrup_tree_build.bytes', hide_locators=True)
banks = dict(k.parse_anim(source / 'TextAsset/syrup_tree_anim.bytes'))
atlas = source / 'Texture2D/syrup_tree_0.png'
manifest_path = project / 'public/assets/buildings/manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
out = project / 'public/assets/buildings/space-tree'
out.mkdir(parents=True, exist_ok=True)
paused = {'grow', 'grow_fill'}
static = {'grown', 'idle_empty', 'grow_pst', 'harvest_ready', 'wilt1', 'wilt2', 'wilt3'}
for letter in 'bcdef':
    paused.update({f'grow_fill_branch_{letter}', f'grow_{letter}_healthy_short', f'grow_{letter}_wilt_short'})
    static.update({f'branch_{letter}_{state}' for state in ['idle', 'grow', 'grow_pst', 'wilt', 'wilt_short', 'harvest']})
    static.add(f'harvest_ready_branch_{letter}')
    static.update(f'syrup_harvest_branch_{letter}_{phase}' for phase in ['pre', 'loop', 'pst'])
count = 0
for bank in sorted(paused | static):
    frames = banks[bank]
    for index in range(len(frames)) if bank in paused else [0]:
        key = f'syrup_tree__{bank}' + (f'__{index}' if bank in paused else '')
        image, left, top, right, bottom = k.render(atlas, symbols, frames[index])
        k.save_png(image, out / f'{key}.png')
        manifest[key] = dict(path=f'/assets/buildings/space-tree/{key}.png', widthCells=(right-left)/200, heightCells=(bottom-top)/200,
            anchorOffsetXCells=(left+right)/400, anchorOffsetYCells=(top+bottom)/400, source=f'syrup_tree_kanim:{bank}:{index}')
        count += 1
manifest_path.write_text(json.dumps(dict(sorted(manifest.items())), indent=2), encoding='utf-8')
print(f'Baked {count} SpaceTree frames.')
