from pathlib import Path
import json
import shutil


SOURCE = Path(r"C:\Users\Administrator\Desktop\Project\NOIMods\ONI源码\ONIUnity项目\ONI_U59_744825\ExportedProject\Assets\Texture2D")
TARGET = Path(__file__).resolve().parents[1] / "public" / "assets" / "particles"

ASSETS = {
    "fallingWater": {"file": "water_drip.png", "frames": 4, "rows": 1},
    "bubbles": {"file": "bubbleObject.png", "frames": 30, "rows": 3},
}


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    for definition in ASSETS.values():
        source = SOURCE / definition["file"]
        if not source.is_file():
            raise FileNotFoundError(source)
        shutil.copy2(source, TARGET / definition["file"])
    (TARGET / "manifest.json").write_text(
        json.dumps(ASSETS, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Extracted {len(ASSETS)} ONI particle textures to {TARGET}")


if __name__ == "__main__":
    main()
