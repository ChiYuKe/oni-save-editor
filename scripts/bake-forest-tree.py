"""Bake ForestTree's state-specific trunk and seven directional branches (native anchors)."""
import importlib.util
import json
import sys
from pathlib import Path

project = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('E:/Unity/NOI1018/ExportedProject/Assets')
spec = importlib.util.spec_from_file_location('kanims', project / 'scripts/render-oni-kanims.py')
k = importlib.util.module_from_spec(spec)
spec.loader.exec_module(k)
symbols, names = k.parse_build_with_names(source / 'TextAsset/tree_build.bytes', hide_locators=True)
banks = dict(k.parse_anim(source / 'TextAsset/tree_anim.bytes'))
atlas = source / 'Texture2D/tree_0.png'
manifest_path = project / 'public/assets/buildings/manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
out = project / 'public/assets/buildings/forest-tree'
out.mkdir(parents=True, exist_ok=True)
paused = {'grow'}
static = {'idle_full', 'grow_pst', 'harvest', 'wilt1', 'wilt2', 'wilt3'}
for letter in 'abcdefg':
    paused.add(f'branch_{letter}_grow')
    static.update(f'branch_{letter}_{state}' for state in ['idle_full', 'grow_pst', 'harvest', 'wilt1', 'wilt2', 'wilt3'])
count = 0
for bank in sorted(paused | static):
    frames = banks[bank]
    for index in range(len(frames)) if bank in paused else [0]:
        key = f'tree__{bank}' + (f'__{index}' if bank in paused else '')
        image, left, top, right, bottom = k.render(atlas, symbols, frames[index])
        k.save_png(image, out / f'{key}.png')
        manifest[key] = dict(path=f'/assets/buildings/forest-tree/{key}.png', widthCells=(right-left)/200, heightCells=(bottom-top)/200,
            anchorOffsetXCells=(left+right)/400, anchorOffsetYCells=(top+bottom)/400, source=f'tree_kanim:{bank}:{index}')
        count += 1
manifest_path.write_text(json.dumps(dict(sorted(manifest.items())), indent=2), encoding='utf-8')
print(f'Baked {count} ForestTree frames.')
