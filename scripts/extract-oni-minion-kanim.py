"""Extract the exact source KAnim data needed to compose saved duplicants."""
from __future__ import annotations

import importlib.util
import json
import shutil
import sys
from pathlib import Path


PACKAGES = ("body_comp_default", "body_swap", "hair_swap", "hat_swap", "head_swap")


def load_kanim_parser(script_directory: Path):
    path = script_directory / "render-oni-kanims.py"
    spec = importlib.util.spec_from_file_location("oni_kanim_renderer", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def build_frame_record(frame):
    source, image, pivot_x, pivot_y, pivot_w, pivot_h, ux1, uy1, ux2, uy2 = frame
    return {
        "source": source,
        "image": image,
        "pivotX": pivot_x,
        "pivotY": pivot_y,
        "pivotWidth": pivot_w,
        "pivotHeight": pivot_h,
        "uv": [ux1, uy1, ux2, uy2],
    }


def frame_element_record(element):
    symbol, source_frame, alpha, red, green, blue, m00, m10, m01, m11, m02, m12, order = element
    return {
        "symbol": symbol,
        "sourceFrame": source_frame,
        "multAlpha": alpha * red,
        "colour": [red, green, blue],
        "matrix": [m00, m10, m01, m11, m02, m12],
        "order": order,
    }


def main():
    if len(sys.argv) not in (3, 4):
        raise SystemExit("Usage: extract-oni-minion-kanim.py <Texture2D directory> <output directory> [AssetRipper Assets directory]")
    source_root = Path(sys.argv[1])
    output_root = Path(sys.argv[2])
    exported_assets = Path(sys.argv[3]) if len(sys.argv) == 4 else None
    output_root.mkdir(parents=True, exist_ok=True)
    kanim = load_kanim_parser(Path(__file__).parent)

    banks = dict(kanim.parse_anim(source_root / "anim_idles_default_anim.txt"))
    idle_frames = banks.get("idle_default")
    if not idle_frames:
        raise RuntimeError("anim_idles_default has no idle_default bank")

    manifest = {
        "source": "anim_idles_default_kanim:idle_default:0",
        "cellUnits": kanim.CELL_UNITS,
        "frame": [frame_element_record(element) for element in idle_frames[0]],
        "packages": {},
    }
    for package in PACKAGES:
        atlas_source = source_root / f"{package}_0.png"
        build_source = source_root / f"{package}_build.txt"
        if not atlas_source.exists() or not build_source.exists():
            raise FileNotFoundError(f"Missing source KAnim package {package}")
        atlas_target = output_root / atlas_source.name
        shutil.copy2(atlas_source, atlas_target)
        symbols, symbol_names = kanim.parse_build_with_names(build_source)
        manifest["packages"][package] = {
            "atlas": f"/assets/kanim/minion/{atlas_target.name}",
            "symbols": {
                str(symbol_hash): [build_frame_record(frame) for frame in frames]
                for symbol_hash, frames in symbols.items()
            },
        }

    # WearableAccessorizer serializes only KAnim file names. At runtime Klei
    # loads each named build, then overrides every matching symbol at the
    # wearable's priority. Export every source build that intersects the
    # duplicant animation's symbol set, but keep it in one file per package so
    # the browser only downloads clothing referenced by the opened save.
    wearable_root = output_root / "wearables"
    wearable_root.mkdir(parents=True, exist_ok=True)
    for stale in wearable_root.iterdir():
        if stale.is_file():
            stale.unlink()
    target_symbols = {element[0] for element in idle_frames[0]}
    catalog = {"packages": {}}
    build_sources = {}
    for build_source in sorted(source_root.glob("*_build.txt")):
        build_sources[build_source.name[:-len("_build.txt")]] = (build_source, source_root)
    if exported_assets:
        text_assets = exported_assets / "TextAsset"
        texture_assets = exported_assets / "Texture2D"
        for build_source in sorted(text_assets.glob("*_build.bytes")):
            build_sources.setdefault(build_source.name[:-len("_build.bytes")], (build_source, texture_assets))
    for package, (build_source, atlas_root) in sorted(build_sources.items()):
        if package in PACKAGES:
            continue
        atlas_source = atlas_root / f"{package}_0.png"
        if not atlas_source.exists():
            continue
        symbols = kanim.parse_build(build_source)
        if not target_symbols.intersection(symbols):
            continue
        atlas_target = wearable_root / atlas_source.name
        metadata_target = wearable_root / f"{package}.json"
        shutil.copy2(atlas_source, atlas_target)
        metadata_target.write_text(json.dumps({
            "symbols": {
                str(symbol_hash): [build_frame_record(frame) for frame in frames]
                for symbol_hash, frames in symbols.items()
            },
            "symbolNames": {
                str(symbol_hash): symbol_names[symbol_hash]
                for symbol_hash in symbols
                if symbol_hash in symbol_names
            },
        }, separators=(",", ":")), encoding="utf8")
        catalog["packages"][f"{package}_kanim"] = {
            "atlas": f"/assets/kanim/minion/wearables/{atlas_target.name}",
            "metadata": f"/assets/kanim/minion/wearables/{metadata_target.name}",
        }
    (wearable_root / "catalog.json").write_text(
        json.dumps(catalog, separators=(",", ":")), encoding="utf8"
    )

    (output_root / "idle_default.json").write_text(
        json.dumps(manifest, separators=(",", ":")), encoding="utf8"
    )
    print(
        f"Extracted duplicant idle frame with {len(manifest['frame'])} elements "
        f"from {len(PACKAGES)} source build packages and "
        f"catalogued {len(catalog['packages'])} lazy wearable packages."
    )


if __name__ == "__main__":
    main()
