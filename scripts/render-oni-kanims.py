"""Bake source KAnim building frames into the map renderer's PNG/manifest format."""
from __future__ import annotations

import json
import math
import re
import struct
import sys
from pathlib import Path

from PIL import Image

CELL_UNITS = 200.0
PADDING = 2
# Map previews must use the game's runtime composition, not menu/UI art.  A
# running loop's first frame is the closest stable representation; buildings
# that do not run fall back to their first visible gameplay state.
PREFERRED_BANKS = ("working_loop", "working_pre", "on", "idle", "off", "closed", "open", "place")
EXTRA_RUNTIME_ASSETS = {
    "conveyer_dropper", "underwater_vent", "underwater_vent_drill", "ventgas", "ventgas_powered", "ventliquid",
    "conveyorin", "conveyorout", "warp_conduit_receiver", "warp_conduit_sender",
    "conduit_port_gas_loader", "conduit_port_gas_unloader", "conduit_port_liquid_loader",
    "conduit_port_liquid_unloader", "conduit_port_solid_loader", "conduit_port_solid_unloader",
    "logic_bridge", "utilities_conveyorbridge", "utilityelectricbridge", "utilityelectricbridgeconductive",
    "utilityelectricbridgerubber", "utilitygasbridge", "utilityliquidbridge",
}
SPECIAL_ATLAS_KANIMS = {
    # These are rendered by BlockTileRenderer / UtilityNetworkManager rather
    # than as individual placed-building sprites.
    "corner_tile", "crown_moulding",
}


class Cursor:
    def __init__(self, data: bytes): self.data, self.offset = data, 0
    def read(self, format: str):
        size = struct.calcsize(format)
        value = struct.unpack_from("<" + format, self.data, self.offset)
        self.offset += size
        return value[0] if len(value) == 1 else value
    def string(self):
        length = self.read("i")
        value = self.data[self.offset:self.offset + max(0, length)].decode("ascii")
        self.offset += max(0, length)
        return value


def parse_build(path: Path):
    cursor = Cursor(path.read_bytes())
    if cursor.data[:4] != b"BILD": raise ValueError(f"Invalid build: {path}")
    cursor.offset = 4
    version, count, _ = cursor.read("i"), cursor.read("i"), cursor.read("i")
    cursor.string()
    symbols = {}
    for _ in range(count):
        symbol_hash = cursor.read("i")
        if version > 9: cursor.read("i")
        cursor.read("i"); cursor.read("i")
        frames = []
        for _ in range(cursor.read("i")):
            source, duration, image = cursor.read("i"), cursor.read("i"), cursor.read("i")
            pivot_x, pivot_y, pivot_w, pivot_h, ux1, uy1, ux2, uy2 = cursor.read("8f")
            frames.append((source, image, pivot_x, pivot_y, pivot_w, pivot_h, ux1, uy1, ux2, uy2))
        symbols[symbol_hash] = frames
    return symbols


def parse_anim(path: Path):
    cursor = Cursor(path.read_bytes())
    if cursor.data[:4] != b"ANIM": raise ValueError(f"Invalid anim: {path}")
    cursor.offset = 4
    cursor.read("i"); cursor.read("i"); cursor.read("i")
    banks = []
    for _ in range(cursor.read("i")):
        name, _, _ = cursor.string(), cursor.read("i"), cursor.read("f")
        frames = []
        for _ in range(cursor.read("i")):
            cursor.read("4f")
            elements = []
            for _ in range(cursor.read("i")):
                symbol, frame, folder, flags = cursor.read("4i")
                alpha, blue, green, red, m00, m10, m01, m11, m02, m12, order = cursor.read("11f")
                elements.append((symbol, frame, alpha, red, green, blue, m00, m10, m01, m11, m02, m12, order))
            frames.append(elements)
        banks.append((name, frames))
    return banks


def transform_for(element, frame):
    _, _, alpha, red, green, blue, m00, m10, m01, m11, m02, m12, _ = element
    _, _, px, py, pw, ph, *_ = frame
    # Same affine transform used by src/lib/kanim.ts.
    return alpha, red, green, blue, m00 * .5, m10 * .5, m01 * .5, m11 * .5, px * m00 + py * m01 + m02, px * m10 + py * m11 + m12, pw, ph


def bounds_for(transform):
    _, _, _, _, a, b, c, d, e, f, pw, ph = transform
    points = [(a * x + c * y + e, b * x + d * y + f) for x in (-pw, pw) for y in (-ph, ph)]
    return min(x for x, _ in points), min(y for _, y in points), max(x for x, _ in points), max(y for _, y in points)


def choose_frame(banks):
    names = {name.lower(): frames for name, frames in banks if frames}
    for name in PREFERRED_BANKS:
        if name in names: return names[name][0]
    return next((frames[0] for _, frames in banks if frames), None)


def render(source_png: Path, symbols, banks):
    atlas = Image.open(source_png).convert("RGBA")
    frame = choose_frame(banks)
    if not frame: raise ValueError("KAnim has no animation frame")
    entries = []
    for element in frame:
        symbol, source_frame = element[0], element[1]
        candidates = symbols.get(symbol, [])
        build = next((item for item in candidates if item[0] == source_frame), candidates[source_frame] if source_frame < len(candidates) else None)
        if build is None or element[2] <= 0: continue
        transform = transform_for(element, build)
        entries.append((element, build, transform))
    if not entries: raise ValueError("KAnim frame has no drawable symbols")
    bounds = [bounds_for(item[2]) for item in entries]
    left, top = min(item[0] for item in bounds), min(item[1] for item in bounds)
    right, bottom = max(item[2] for item in bounds), max(item[3] for item in bounds)
    width, height = math.ceil(right - left) + PADDING * 2, math.ceil(bottom - top) + PADDING * 2
    output = Image.new("RGBA", (max(1, width), max(1, height)))
    for element, build, transform in reversed(entries):
        _, _, px, py, pw, ph, ux1, uy1, ux2, uy2 = build
        x1, y1 = max(0, int(math.floor(ux1 * atlas.width))), max(0, int(math.floor(uy1 * atlas.height)))
        x2, y2 = min(atlas.width, max(x1 + 1, int(math.floor(ux2 * atlas.width)))), min(atlas.height, max(y1 + 1, int(math.floor(uy2 * atlas.height))))
        crop = atlas.crop((x1, y1, x2, y2))
        alpha, red, green, blue, a, b, c, d, e, f, _, _ = transform
        determinant = a * d - b * c
        if abs(determinant) < 1e-7: continue
        ia, ib, ic, id_ = d / determinant, -c / determinant, -b / determinant, a / determinant
        # Pillow requests dest->source. Convert destination pixel coordinates
        # through the inverse KAnim matrix and then into the atlas crop.
        sx, sy = crop.width / (pw * 2), crop.height / (ph * 2)
        # The destination canvas is positioned at (left - padding, top -
        # padding) in KAnim space.  Map that point through the inverse affine
        # transform to reach the source crop.  (The previous signs here made
        # every transformed layer land outside the output canvas.)
        kx = ia * (left - PADDING - e) + ib * (top - PADDING - f) + pw
        ky = ic * (left - PADDING - e) + id_ * (top - PADDING - f) + ph
        layer = crop.transform(output.size, Image.Transform.AFFINE, (sx * ia, sx * ib, sx * kx, sy * ic, sy * id_, sy * ky), Image.Resampling.BICUBIC)
        if alpha < .999 or min(red, green, blue) < .999:
            channels = list(layer.split())
            channels[3] = channels[3].point(lambda value: int(value * alpha))
            layer = Image.merge("RGBA", (channels[0], channels[1], channels[2], channels[3]))
        output.alpha_composite(layer)
    return output, left, top, right, bottom


def texture_metrics(image: Image.Image):
    pixels = [pixel for pixel in image.convert("RGBA").getdata() if pixel[3] > 32]
    count = max(1, len(pixels))
    white = sum(red > 220 and green > 220 and blue > 220 for red, green, blue, _ in pixels) / count
    chromatic = sum(max(red, green, blue) - min(red, green, blue) > 24 for red, green, blue, _ in pixels) / count
    return white, chromatic


def is_unfinished_material_mask(image: Image.Image):
    white, chromatic = texture_metrics(image)
    return white >= 0.70 and chromatic <= 0.07


def definitions(path: Path):
    source = path.read_text(encoding="utf8")
    match = re.search(r"ONI_BUILDING_DEFINITIONS:.*?= (\{.*?\})\n\nconst ONI_BUILDINGS", source, re.S)
    if not match: raise ValueError("Unable to read generated building definitions")
    return json.loads(match.group(1)).values()


def source_files(bridge_root: Path, name: str):
    """Return the exact KAnim trio exported by ONI_Bridge for one animation.

    ONI_Bridge already writes the atlas and the original binary build/animation
    records together.  Do not reconstruct them from the game's raw Texture2D
    dump: that loses the package boundary and is the reason a number of
    building sprites were previously absent.
    """
    package = bridge_root / f"{name}_kanim"
    return (
        package / f"{name}_kanim_0.png",
        package / f"{name}_kanim_build.bytes",
        package / f"{name}_kanim_anim.bytes",
    )


def animation_names(metadata: Path, legacy_manifest: Path | None):
    names = {
        re.sub(r"_kanim$", "", definition["animation"], flags=re.I).lower()
        for definition in definitions(metadata)
    }
    # Some older building records are not covered by the static config parser
    # (notably DLC and POI prefabs), but their KAnim package name is already a
    # stable key in the previous manifest.  Carry those exact package names
    # over from ONI_Bridge instead of retaining the legacy image files.
    if legacy_manifest and legacy_manifest.exists():
        names.update(name.lower() for name in json.loads(legacy_manifest.read_text(encoding="utf8")).keys())
    names.update(EXTRA_RUNTIME_ASSETS)
    return sorted(name for name in names if not name.startswith("floor_") and name not in SPECIAL_ATLAS_KANIMS)


def main():
    if len(sys.argv) not in (5, 6):
        raise SystemExit("Usage: render-oni-kanims.py <building-defs.ts> <ONI_Bridge> <output-dir> <manifest> [legacy-manifest]")
    metadata, bridge_root, output_dir, manifest_path = map(Path, sys.argv[1:5])
    legacy_manifest = Path(sys.argv[5]) if len(sys.argv) == 6 else None
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = {}
    rendered = skipped = 0
    for name in animation_names(metadata, legacy_manifest):
        if name in manifest: continue
        png, build, anim = source_files(bridge_root, name)
        if not (png.exists() and build.exists() and anim.exists()):
            skipped += 1
            continue
        try:
            image, left, top, right, bottom = render(png, parse_build(build), parse_anim(anim))
            if is_unfinished_material_mask(image):
                skipped += 1
                print(f"Skip {name}: runtime KAnim result is an unfinished material mask.", file=sys.stderr)
                continue
            target = output_dir / f"{name}.png"
            image.save(target)
            # Canvas sprite origin is its centre; KAnim bounds are relative to
            # the game's placement origin. Preserve that relation in cells.
            asset_directory = output_dir.name
            manifest[name] = {"path": f"/assets/buildings/{asset_directory}/{target.name}", "widthCells": (right - left) / CELL_UNITS, "heightCells": (bottom - top) / CELL_UNITS, "pixelWidth": image.width, "pixelHeight": image.height, "anchorOffsetXCells": (left + right) / 2 / CELL_UNITS, "anchorOffsetYCells": (top + bottom) / 2 / CELL_UNITS, "source": f"{name}_kanim"}
            rendered += 1
        except Exception as error:
            skipped += 1
            print(f"Skip {name}: {error}", file=sys.stderr)
    manifest_path.write_text(json.dumps(dict(sorted(manifest.items())), indent=2), encoding="utf8")
    referenced = {Path(definition["path"]).name for definition in manifest.values()}
    for stale_png in output_dir.glob("*.png"):
        if stale_png.name not in referenced:
            stale_png.unlink()
    print(f"Rendered {rendered} buildings; skipped {skipped} missing or invalid source packages.")


if __name__ == "__main__": main()
