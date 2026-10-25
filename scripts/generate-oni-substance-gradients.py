"""Export native Substance gradient keys as packed by Sim.Element(Color32)."""
from pathlib import Path
import json
import os
import re
import sys

project = Path(__file__).resolve().parents[1]
assets = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get('ONI_EXPORTED_ASSETS', 'E:/Unity/NOI1018/ExportedProject/Assets'))
blocks = re.split(r'^  - name: ', (assets / 'Resources/SubstanceHookup.asset').read_text('utf-8-sig'), flags=re.M)[1:]
records = []
for block in blocks:
    section = re.search(r'    gradient:\n(.*?)(?=^    \w|\Z)', block, re.M | re.S)
    if not section:
        continue
    text = section.group(1)
    count = re.search(r'm_NumColorKeys: (\d+)', text)
    if not count:
        continue
    keys = []
    for index in range(int(count.group(1))):
        colour = re.search(rf'key{index}: \{{r: ([^,]+), g: ([^,]+), b: ([^,]+), a: ([^}}]+)\}}', text)
        time = re.search(rf'ctime{index}: (\d+)', text)
        if colour and time:
            keys.append({'time': round(int(time.group(1)) / 65535 * 255) / 255,
                         'rgb': [max(0, min(255, round(float(value) * 255))) for value in colour.groups()[:3]]})
    if keys:
        records.append([int(re.search(r'elementID: (-?\d+)', block).group(1)) & 65535, keys])
if not records:
    raise SystemExit('No native gradients found; existing generated data was retained.')
output = '// Generated from SubstanceHookup gradients; Sim.Element packs key RGB and time into Color32.\n'
output += 'export const ONI_SUBSTANCE_GRADIENTS = new Map<number, readonly {time: number; rgb: readonly number[]}[]>('
output += json.dumps(records, indent=2) + ')\n'
(project / 'src/lib/oniSubstanceGradients.generated.ts').write_text(output, 'utf-8')
print(f'Exported {len(records)} native Substance gradients.')
