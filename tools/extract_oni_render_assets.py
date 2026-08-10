"""Extract ONI's compiled OpenGL shaders and renderer settings.

Unity's exported ``*.shader`` files are fallback stubs.  The actual programs
are stored as LZ4-compressed subprograms in ``*_original.asset``.  This tool
keeps the browser renderer tied to those programs instead of hand-written
visual approximations.
"""

from __future__ import annotations

import argparse
import base64
import json
import re
from pathlib import Path

import lz4.block
from UnityPy.export.ShaderConverter import ShaderProgram
from UnityPy.streams import EndianBinaryReader


DEFAULT_ASSETS = Path(
    r"C:\Users\Administrator\Desktop\Project\NOIMods\ONI源码"
    r"\ONIUnity项目\ONI_U59_744825\ExportedProject\Assets"
)
DEFAULT_SHADER_NAMES = (
    "substance",
    "liquidsubstance",
    "liquid",
    "gastest",
    "kleitransparentbiome",
    "backwallarray",
    "lightbuffer",
    "lightbuffershadowed",
    "lightbuffercompositor",
    "fogofwarpostfx",
    "gridcompositor",
    "kbatched_anim",
    "kbatched_anim_human",
    "kbatched_anim_pst",
    "kbatched_anim_shine",
)
HEX_ARRAY_ITEM = re.compile(r"^  - ([0-9a-f]{8})$", re.MULTILINE)


def little_endian_hex(value: str) -> int:
    return int.from_bytes(bytes.fromhex(value), "little")


def yaml_hex_array(text: str, name: str, next_name: str) -> list[int]:
    match = re.search(
        rf"  {re.escape(name)}:\n(.*?)  {re.escape(next_name)}:", text, re.DOTALL
    )
    if not match:
        raise ValueError(f"Missing {name} in serialized Shader")
    return [little_endian_hex(item) for item in HEX_ARRAY_ITEM.findall(match.group(1))]


def unity_version(assets: Path) -> tuple[int, int, int, int]:
    version_file = assets.parent / "ProjectSettings" / "ProjectVersion.txt"
    text = version_file.read_text(encoding="utf-8")
    match = re.search(r"m_EditorVersion: (\d+)\.(\d+)\.(\d+)(?:f(\d+))?", text)
    if not match:
        raise ValueError(f"Cannot parse Unity version from {version_file}")
    return tuple(int(value or 0) for value in match.groups())  # type: ignore[return-value]


def extract_glcore_programs(shader_asset: Path, version: tuple[int, int, int, int]) -> dict:
    text = shader_asset.read_text(encoding="utf-8")
    blob_match = re.search(r"  compressedBlob: ([0-9a-f]+)", text)
    platform_match = re.search(r"  platforms: ([0-9a-f]+)", text)
    name_match = re.search(r"^  m_Name: (.+)$", text, re.MULTILINE)
    if not blob_match or not platform_match:
        raise ValueError(f"No compiled Shader blob in {shader_asset}")

    platforms_raw = bytes.fromhex(platform_match.group(1))
    platforms = [
        int.from_bytes(platforms_raw[index : index + 4], "little", signed=True)
        for index in range(0, len(platforms_raw), 4)
    ]
    offsets = yaml_hex_array(text, "offsets", "compressedLengths")
    compressed_lengths = yaml_hex_array(text, "compressedLengths", "decompressedLengths")
    decompressed_lengths = yaml_hex_array(text, "decompressedLengths", "compressedBlob")
    blob = bytes.fromhex(blob_match.group(1))

    programs: list[dict] = []
    for platform, offset, compressed_length, decompressed_length in zip(
        platforms, offsets, compressed_lengths, decompressed_lengths, strict=True
    ):
        if platform != 15:  # ShaderCompilerPlatform.kShaderCompPlatformOpenGLCore
            continue
        raw = lz4.block.decompress(
            blob[offset : offset + compressed_length],
            uncompressed_size=decompressed_length,
        )
        shader = ShaderProgram(EndianBinaryReader(raw, endian="<"), version)
        for index, subprogram in enumerate(shader.m_SubPrograms):
            program_code = bytes(subprogram.m_ProgramCode)
            try:
                source = program_code.decode("utf-8")
            except UnicodeDecodeError:
                source = None
            programs.append(
                {
                    "index": index,
                    "programType": subprogram.m_ProgramType.name,
                    "keywords": [keyword for keyword in subprogram.m_Keywords if keyword],
                    "source": source,
                    "programCodeBase64": base64.b64encode(program_code).decode("ascii"),
                }
            )
    if not programs:
        raise ValueError(f"No OpenGLCore program found in {shader_asset}")
    return {
        "name": name_match.group(1).strip() if name_match else shader_asset.stem,
        "sourceAsset": shader_asset.as_posix(),
        "programs": programs,
    }


def parse_scalar(text: str, key: str) -> float | int | None:
    match = re.search(rf"^  {re.escape(key)}: (-?\d+(?:\.\d+)?)$", text, re.MULTILINE)
    if not match:
        return None
    value = float(match.group(1))
    return int(value) if value.is_integer() else value


def parse_vector(text: str, key: str) -> dict[str, float] | None:
    match = re.search(rf"^  {re.escape(key)}: \{{([^}}]+)\}}$", text, re.MULTILINE)
    if not match:
        return None
    return {
        item.group(1): float(item.group(2))
        for item in re.finditer(r"([xyzwrgba]+): (-?\d+(?:\.\d+)?)", match.group(1))
    }


def guid_assets(assets: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for meta in assets.rglob("*.meta"):
        with meta.open("r", encoding="utf-8-sig", errors="ignore") as handle:
            header = handle.read(512)
        match = re.search(r"^guid: ([0-9a-f]{32})$", header, re.MULTILINE)
        if match:
            result[match.group(1)] = meta.with_suffix("").relative_to(assets).as_posix()
    return result


def extract_lighting_settings(assets: Path) -> dict:
    path = assets / "MonoBehaviour" / "LightingSettings.asset"
    text = path.read_text(encoding="utf-8")
    scalars = (
        "DigMapScale",
        "StateTransitionUVScale",
        "FallingSolidUVScale",
        "ShineZoomSpeed",
        "WaterTrimSize",
        "WaterAlphaTrimSize",
        "WaterAlphaThreshold",
        "WaterCubesAlphaThreshold",
        "WaterWaveAmplitude",
        "WaterWaveFrequency",
        "WaterWaveSpeed",
        "WaterDetailSpeed",
        "WaterDetailTiling",
        "WaterDetailTiling2",
        "WaterWaveAmplitude2",
        "WaterWaveFrequency2",
        "WaterWaveSpeed2",
        "WaterCubeMapScale",
        "WaterColorScale",
        "WaterDistortionScaleStart",
        "WaterDistortionScaleEnd",
        "WaterDepthColorOpacityStart",
        "WaterDepthColorOpacityEnd",
        "LiquidMin",
        "LiquidMax",
        "LiquidCutoff",
        "LiquidTransparency",
        "LiquidAmountOffset",
        "LiquidMaxMass",
        "BackgroundLayers",
        "BackgroundDarkening",
        "BackgroundClip",
        "BackgroundUVScale",
        "AnimIntensity",
        "GasMinOpacity",
        "GasMaxOpacity",
        "WorldZoneGasBlend",
        "WorldZoneLiquidBlend",
        "WorldZoneForegroundBlend",
        "WorldZoneSimpleAnimBlend",
        "WorldZoneAnimBlend",
    )
    vectors = (
        "DigMapColour",
        "StateTransitionColor",
        "StateTransitionUVOffsetRate",
        "FallingSolidColor",
        "FallingSolidUVOffsetRate",
        "ShineCenter",
        "ShineRange",
        "WaterTrimColor",
        "WaterDetailDirection",
        "GridColor",
    )
    guid_map = guid_assets(assets)
    textures = {
        name: {"guid": guid, "asset": guid_map.get(guid)}
        for name, guid in re.findall(
            r"^  ([A-Za-z0-9_]+): \{fileID: \d+, guid: ([0-9a-f]{32}), type: \d+\}$",
            text,
            re.MULTILINE,
        )
    }
    edge_match = re.search(
        r"^  substanceEdgeParameters:\n"
        r"    intensity: ([^\n]+)\n"
        r"    edgeIntensity: ([^\n]+)\n"
        r"    directSunlightScale: ([^\n]+)\n"
        r"    power: ([^\n]+)",
        text,
        re.MULTILINE,
    )
    return {
        "sourceAsset": path.as_posix(),
        "scalars": {key: parse_scalar(text, key) for key in scalars},
        "vectors": {key: parse_vector(text, key) for key in vectors},
        "substanceEdgeParameters": (
            {
                "intensity": float(edge_match.group(1)),
                "edgeIntensity": float(edge_match.group(2)),
                "directSunlightScale": float(edge_match.group(3)),
                "power": float(edge_match.group(4)),
            }
            if edge_match
            else None
        ),
        "textures": textures,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets", type=Path, default=DEFAULT_ASSETS)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).with_name("oni-render-assets.json"),
    )
    parser.add_argument("--shader", action="append", dest="shaders")
    args = parser.parse_args()
    assets: Path = args.assets.resolve()
    version = unity_version(assets)
    resources = assets / "Resources"
    shader_names = tuple(args.shaders or DEFAULT_SHADER_NAMES)
    shaders = {}
    for name in shader_names:
        path = resources / f"{name}_original.asset"
        if path.exists():
            shaders[name] = extract_glcore_programs(path, version)
    result = {
        "unityVersion": version,
        "assetsRoot": assets.as_posix(),
        "shaders": shaders,
        "lighting": extract_lighting_settings(assets),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Some Unity subprogram tables contain non-text keyword metadata represented
    # as surrogate code points by UnityPy. ASCII escaping preserves it losslessly.
    args.output.write_text(json.dumps(result, ensure_ascii=True, indent=2), encoding="utf-8")
    program_count = sum(len(shader["programs"]) for shader in shaders.values())
    print(f"Extracted {len(shaders)} shaders / {program_count} GLCore programs -> {args.output}")


if __name__ == "__main__":
    main()
