"""Bake source KAnim building frames into the map renderer's PNG/manifest format."""
from __future__ import annotations

import json
import math
import os
import re
import struct
import sys
import time
from pathlib import Path

from PIL import Image

CELL_UNITS = 200.0
PADDING = 2
MAX_OUTPUT_DIMENSION = 4096
# Map previews must use the game's runtime composition, not menu/UI art.  A
# running loop's first frame is the closest stable representation; buildings
# that do not run fall back to their first visible gameplay state.
# Ordered gameplay states. ``place`` and ``ui`` deliberately do not appear
# here: they are often construction masks / catalogue art rather than the
# sprite that exists in the world.
PREFERRED_BANKS = (
    "working_loop", "working_pre", "on", "idle", "off", "closed", "open",
    "grounded", "slab", "default", "static",
)
NON_WORLD_BANKS = {"ui", "place", "place_guide", "under_construction"}
# Door.Controller changes the KAnim bank at runtime. Keep the static variants
# so the map renderer can select the same state from its saved Door component.
# Banks selected by serialized runtime state. KAnim itself is not serialized,
# but Operational/Door/Battery/etc. are, so retain the source frames needed to
# reconstruct the controller's stable state after loading the save.
RUNTIME_STATE_BANKS = (
    "working_loop", "on", "idle", "off", "closed", "open", "locked",
    "disabled", "empty", "full",
)
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


def parse_build_with_names(path: Path, hide_locators=False):
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
    names = {}
    # BILD v10+ appends the exact HashCache table used by
    # ApplySymbolOverridesByAffix: count followed by (hash, ASCII string).
    if cursor.offset + 4 <= len(cursor.data):
        name_count = cursor.read("i")
        if 0 <= name_count <= 100000:
            for _ in range(name_count):
                if cursor.offset + 8 > len(cursor.data):
                    break
                name_hash = cursor.read("i")
                names[name_hash] = cursor.string()
    # snapTo_* symbols are KAnim locator handles (mouth/hand/pivot attachment
    # points), not world geometry. Their atlas cells deliberately contain a
    # coloured editor axis so artists can position attachments; KAnim's
    # runtime visibility system suppresses them.
    if hide_locators:
        symbols = {
            symbol_hash: frames
            for symbol_hash, frames in symbols.items()
            if not names.get(symbol_hash, "").lower().startswith("snapto_")
        }
    return symbols, names


def parse_build(path: Path):
    return parse_build_with_names(path)[0]


def sdbm_lower(value: str):
    result = 0
    for char in value.lower():
        result = (ord(char) + (result << 6) + (result << 16) - result) & 0xFFFFFFFF
    return result - 0x100000000 if result & 0x80000000 else result


def symbols_with_affix_override(symbols, names, prefix):
    overridden = dict(symbols)
    replacements = 0
    for symbol_hash, symbol_name in names.items():
        if symbol_name.startswith(prefix) and len(symbol_name) > len(prefix):
            overridden[sdbm_lower(symbol_name[len(prefix):])] = symbols[symbol_hash]
            replacements += 1
    return overridden, replacements


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
    # KGlobalAnimParser.ParseAnimData stores multAlpha = firstColour *
    # redColour. The exporter writes B/G/R after the first value and asserts
    # that all three colour channels are identical.
    mult_alpha = alpha * red
    return mult_alpha, m00 * .5, m10 * .5, m01 * .5, m11 * .5, px * m00 + py * m01 + m02, px * m10 + py * m11 + m12, pw, ph


def bounds_for(transform):
    _, a, b, c, d, e, f, pw, ph = transform
    points = [(a * x + c * y + e, b * x + d * y + f) for x in (-pw, pw) for y in (-ph, ph)]
    return min(x for x, _ in points), min(y for _, y in points), max(x for x, _ in points), max(y for _, y in points)


def candidate_frames(banks):
    """Yield stable world-state frames in preference order.

    A surprising number of ONI prefabs put a blank material overlay in the
    ``place`` bank before their actual static bank (for example fossils and
    sculptures). The previous one-frame lookup chose that overlay, classified
    it as a white mask, then omitted the whole building from the manifest.
    """
    named = {name.lower(): (name, frames) for name, frames in banks if frames}
    emitted = set()
    for key in PREFERRED_BANKS:
        candidate = named.get(key)
        if candidate:
            emitted.add(key)
            yield candidate[0], candidate[1][0]
    for name, frames in banks:
        key = name.lower()
        if not frames or key in emitted or key in NON_WORLD_BANKS:
            continue
        emitted.add(key)
        yield name, frames[0]


def frame_for_bank(banks, wanted_name):
    wanted = wanted_name.lower()
    return next((frames[0] for name, frames in banks if name.lower() == wanted and frames), None)


def render(source_png: Path, symbols, frame):
    atlas = Image.open(source_png).convert("RGBA")
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
    # A few rocket and POI KAnims have very large offscreen bounds. Preserve
    # their world-space metrics in the manifest, but bake a capped raster so a
    # single package cannot allocate hundreds of megabytes and abort the whole
    # texture rebuild.
    scale = min(1.0, MAX_OUTPUT_DIMENSION / max(1.0, right - left), MAX_OUTPUT_DIMENSION / max(1.0, bottom - top))
    width = math.ceil((right - left) * scale) + PADDING * 2
    height = math.ceil((bottom - top) * scale) + PADDING * 2
    output = Image.new("RGBA", (max(1, width), max(1, height)))
    for element, build, transform in reversed(entries):
        _, _, px, py, pw, ph, ux1, uy1, ux2, uy2 = build
        x1, y1 = max(0, int(math.floor(ux1 * atlas.width))), max(0, int(math.floor(uy1 * atlas.height)))
        x2, y2 = min(atlas.width, max(x1 + 1, int(math.floor(ux2 * atlas.width)))), min(atlas.height, max(y1 + 1, int(math.floor(uy2 * atlas.height))))
        crop = atlas.crop((x1, y1, x2, y2))
        mult_alpha, a, b, c, d, e, f, _, _ = transform
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
        padding_in_world = PADDING / scale
        kx = ia * (left - padding_in_world - e) + ib * (top - padding_in_world - f) + pw
        ky = ic * (left - padding_in_world - e) + id_ * (top - padding_in_world - f) + ph
        layer = crop.transform(output.size, Image.Transform.AFFINE, (sx * ia / scale, sx * ib / scale, sx * kx, sy * ic / scale, sy * id_ / scale, sy * ky), Image.Resampling.BICUBIC)
        if mult_alpha < .999:
            channels = list(layer.split())
            # Hidden KAnim symbols use negative multipliers. The GPU render
            # target clamps them to zero; Pillow requires an explicit clamp
            # before encoding the 8-bit alpha channel.
            channels[3] = channels[3].point(lambda value: max(0, min(255, int(value * mult_alpha))))
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


def save_png(image: Image.Image, target: Path):
    """Atomically replace generated PNGs, retrying transient Windows locks."""
    temporary = target.with_name(f".{target.stem}.{os.getpid()}.tmp.png")
    try:
        image.save(temporary)
        for attempt in range(5):
            try:
                os.replace(temporary, target)
                return
            except OSError:
                if attempt == 4:
                    raise
                time.sleep(0.05 * (attempt + 1))
    finally:
        if temporary.exists():
            temporary.unlink()


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
    packaged = (
        package / f"{name}_kanim_0.png",
        package / f"{name}_kanim_build.bytes",
        package / f"{name}_kanim_anim.bytes",
    )
    if all(path.exists() for path in packaged):
        return packaged
    # AssetRipper exports the same binary TextAssets with a .txt extension in
    # the source tree. They still start with BILD/ANIM and are byte-for-byte
    # parseable; prefer them over any reconstructed metadata.
    build = bridge_root / f"{name}_build.txt"
    anim = bridge_root / f"{name}_anim.txt"
    if not build.exists():
        build = bridge_root / f"{name}_build.bytes"
    if not anim.exists():
        anim = bridge_root / f"{name}_anim.bytes"
    return bridge_root / f"{name}_0.png", build, anim


def render_source_variants(bridge_root: Path, name: str, primary_png: Path, primary_symbols, primary_names):
    """Return atlas/build pairs used by a KAnim animation package.

    Creatures commonly keep their ANIM records in ``hatch_kanim`` while the
    drawable symbols live in ``hatch_build_kanim``. Buildings usually keep
    both records in one package. Mirror KAnimFile's anim/build split by trying
    the primary build first and the explicit ``*_build`` package second.
    """
    variants = [(primary_png, primary_symbols, primary_names)]
    alternate_png, alternate_build, _ = source_files(bridge_root, f"{name}_build")
    if alternate_png.exists() and alternate_build.exists():
        try:
            alternate_symbols, alternate_names = parse_build_with_names(alternate_build, hide_locators=True)
            if alternate_symbols and alternate_symbols != primary_symbols:
                variants.append((alternate_png, alternate_symbols, alternate_names))
        except (OSError, ValueError, struct.error):
            pass
    return variants


def render_from_variants(variants, frame, preferred_index=0):
    order = [preferred_index, *(index for index in range(len(variants)) if index != preferred_index)]
    last_error = None
    for index in order:
        png, symbols, _ = variants[index]
        try:
            return (*render(png, symbols, frame), index)
        except ValueError as error:
            last_error = error
    raise last_error or ValueError("KAnim frame has no drawable symbols")


def render_affix_from_variants(variants, frame, prefix, preferred_index=0):
    order = [preferred_index, *(index for index in range(len(variants)) if index != preferred_index)]
    last_error = None
    for index in order:
        png, symbols, names = variants[index]
        overridden, replacements = symbols_with_affix_override(symbols, names, prefix)
        if not replacements:
            continue
        try:
            return (*render(png, overridden, frame), index, replacements)
        except ValueError as error:
            last_error = error
    raise last_error or ValueError(f"KAnim build has no symbols with prefix {prefix!r}")


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
        names.update(name.lower().split("__", 1)[0] for name in json.loads(legacy_manifest.read_text(encoding="utf8")).keys())
    names.update(EXTRA_RUNTIME_ASSETS)
    return sorted(name for name in names if not name.startswith("floor_") and name not in SPECIAL_ATLAS_KANIMS)


def main():
    if len(sys.argv) not in (5, 6):
        raise SystemExit("Usage: render-oni-kanims.py <building-defs.ts> <ONI_Bridge> <output-dir> <manifest> [legacy-manifest]")
    metadata, bridge_root, output_dir, manifest_path = map(Path, sys.argv[1:5])
    legacy_manifest = Path(sys.argv[5]) if len(sys.argv) == 6 else None
    output_dir.mkdir(parents=True, exist_ok=True)
    # The local source dump can omit DLC/offline packages that were previously
    # exported through ONI_Bridge. Keep those exact bridge renders and replace
    # only entries for packages that are available in the current source.
    manifest = json.loads(legacy_manifest.read_text(encoding="utf8")) if legacy_manifest and legacy_manifest.exists() else {}
    rendered = skipped = 0
    metadata_definitions = list(definitions(metadata))
    default_banks = {
        re.sub(r"_kanim$", "", definition["animation"], flags=re.I).lower(): definition.get("defaultAnim", "off")
        for definition in metadata_definitions
    }
    affix_definitions = {}
    for definition in metadata_definitions:
        prefix = definition.get("symbolOverridePrefix")
        if prefix:
            animation_name = re.sub(r"_kanim$", "", definition["animation"], flags=re.I).lower()
            affix_definitions.setdefault(animation_name, []).append(definition)
            legacy_key = definition["id"].lower()
            if legacy_key != animation_name:
                manifest.pop(legacy_key, None)
    for name in animation_names(metadata, legacy_manifest):
        png, build, anim = source_files(bridge_root, name)
        if not (png.exists() and build.exists() and anim.exists()):
            skipped += 1
            continue
        try:
            (symbols, symbol_names), banks = parse_build_with_names(build, hide_locators=True), parse_anim(anim)
            variants = render_source_variants(bridge_root, name, png, symbols, symbol_names)
            selected = None
            candidates = []
            default_bank = default_banks.get(name)
            default_frame = frame_for_bank(banks, default_bank) if default_bank else None
            if default_frame is not None:
                candidates.append((default_bank, default_frame))
            candidates.extend((bank_name, frame) for bank_name, frame in candidate_frames(banks) if bank_name.lower() != (default_bank or "").lower())
            for bank_name, frame in candidates:
                try:
                    image, left, top, right, bottom, variant_index = render_from_variants(variants, frame)
                except ValueError:
                    continue
                if not is_unfinished_material_mask(image):
                    selected = (bank_name, image, left, top, right, bottom, variant_index)
                    break
            if selected is None:
                skipped += 1
                print(f"Skip {name}: no non-mask gameplay KAnim frame.", file=sys.stderr)
                continue
            bank_name, image, left, top, right, bottom, variant_index = selected
            target = output_dir / f"{name}.png"
            save_png(image, target)
            # Canvas sprite origin is its centre; KAnim bounds are relative to
            # the game's placement origin. Preserve that relation in cells.
            asset_directory = output_dir.name
            manifest[name] = {"path": f"/assets/buildings/{asset_directory}/{target.name}", "widthCells": (right - left) / CELL_UNITS, "heightCells": (bottom - top) / CELL_UNITS, "pixelWidth": image.width, "pixelHeight": image.height, "anchorOffsetXCells": (left + right) / 2 / CELL_UNITS, "anchorOffsetYCells": (top + bottom) / 2 / CELL_UNITS, "source": f"{name}_kanim:{bank_name}"}
            selected_frame = next(frame for candidate_name, frame in candidates if candidate_name == bank_name)
            for definition in affix_definitions.get(name, []):
                prefix = definition["symbolOverridePrefix"]
                try:
                    variant_image, variant_left, variant_top, variant_right, variant_bottom, _, replacements = render_affix_from_variants(variants, selected_frame, prefix, variant_index)
                except ValueError:
                    print(f"Skip {definition['id']} affix {prefix}: no matching KAnim symbols.", file=sys.stderr)
                    continue
                # Keep prefab-specific symbol overrides separate from the
                # animation package key. Some IDs (notably Drecko) equal the
                # package name while another variant (DreckoPlastic) uses the
                # same unmodified build.
                variant_key = f"{definition['id'].lower()}__prefab"
                variant_target = output_dir / f"{variant_key}.png"
                save_png(variant_image, variant_target)
                manifest[variant_key] = {"path": f"/assets/buildings/{asset_directory}/{variant_target.name}", "widthCells": (variant_right - variant_left) / CELL_UNITS, "heightCells": (variant_bottom - variant_top) / CELL_UNITS, "pixelWidth": variant_image.width, "pixelHeight": variant_image.height, "anchorOffsetXCells": (variant_left + variant_right) / 2 / CELL_UNITS, "anchorOffsetYCells": (variant_top + variant_bottom) / 2 / CELL_UNITS, "source": f"{name}_kanim:{bank_name}+{prefix} ({replacements} overrides)"}
            for state_name in dict.fromkeys((*RUNTIME_STATE_BANKS, default_bank)):
                if not state_name:
                    continue
                state_frame = frame_for_bank(banks, state_name)
                if state_frame is None:
                    continue
                try:
                    state_image, state_left, state_top, state_right, state_bottom, _ = render_from_variants(variants, state_frame, variant_index)
                except ValueError:
                    continue
                if is_unfinished_material_mask(state_image):
                    continue
                state_key = f"{name}__{state_name}"
                state_target = output_dir / f"{state_key}.png"
                save_png(state_image, state_target)
                manifest[state_key] = {"path": f"/assets/buildings/{asset_directory}/{state_target.name}", "widthCells": (state_right - state_left) / CELL_UNITS, "heightCells": (state_bottom - state_top) / CELL_UNITS, "pixelWidth": state_image.width, "pixelHeight": state_image.height, "anchorOffsetXCells": (state_left + state_right) / 2 / CELL_UNITS, "anchorOffsetYCells": (state_top + state_bottom) / 2 / CELL_UNITS, "source": f"{name}_kanim:{state_name}"}
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
