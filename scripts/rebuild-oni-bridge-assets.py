"""Rebuild every map-renderer building asset from one ONI_Bridge export.

The renderer deliberately keeps source families separate:
  sprites/   composed building illustrations and their manifest
  utilities/ raw network atlases
Block-tile atlases are intentionally not reconstructed here: ONI_Bridge's
current export does not include the game's ``tiles_*`` TextureAtlas files.
They must remain a separate BlockTileRenderer asset import, just as raw
network atlases are handled separately from building sprites.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


UTILITY_KANIMS = (
    "logic_wires",
    "utilities_conveyor",
    "utilities_electric",
    "utilities_electric_conduct",
    "utilities_electric_conduct_hiwatt",
    "utilities_electric_insulated",
    "utilities_electric_rubber",
    "utilities_gas",
    "utilities_gas_insulated",
    "utilities_gas_radiant",
    "utilities_liquid",
    "utilities_liquid_insulated",
    "utilities_liquid_radiant",
)


def copy_required(source: Path, target: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(f"Missing ONI_Bridge asset: {source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("Usage: rebuild-oni-bridge-assets.py <building-defs.ts> <ONI_Bridge> <output-dir>")
    definitions, bridge, output = map(Path, sys.argv[1:])
    renderer = Path(__file__).with_name("render-oni-kanims.py")
    sprites = output / "sprites"
    utilities = output / "utilities"
    for directory in (sprites, utilities):
        directory.mkdir(parents=True, exist_ok=True)

    subprocess.run(
        # Feed the current manifest back as the legacy key list. It retains
        # bridge packages that are map-visible but not discoverable through a
        # simple CreateBuildingDef source scan (POIs and older DLC prefabs).
        [sys.executable, str(renderer), str(definitions), str(bridge), str(sprites), str(output / "manifest.json"), str(output / "manifest.json")],
        check=True,
    )

    for name in UTILITY_KANIMS:
        copy_required(
            bridge / f"{name}_kanim" / f"{name}_kanim_0.png",
            utilities / f"{name}_kanim_0.png",
        )
    print(f"Rebuilt Bridge assets in {output}")


if __name__ == "__main__":
    main()
