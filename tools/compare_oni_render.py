"""Compare a browser render with an Oxygen Not Included reference PNG.

The command deliberately fails while any pixel differs.  A relaxed threshold
can be supplied while individual render passes are being brought online, but
the final 1:1 gate is the default zero threshold.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("reference", type=Path)
    parser.add_argument("actual", type=Path)
    parser.add_argument("--diff", type=Path)
    parser.add_argument("--threshold", type=int, default=0)
    args = parser.parse_args()

    reference = Image.open(args.reference).convert("RGBA")
    actual = Image.open(args.actual).convert("RGBA")
    if reference.size != actual.size:
        raise SystemExit(
            f"size mismatch: reference={reference.size[0]}x{reference.size[1]} "
            f"actual={actual.size[0]}x{actual.size[1]}"
        )

    difference = ImageChops.difference(reference, actual)
    histogram = difference.histogram()
    pixels = reference.width * reference.height
    channel_samples = pixels * 4
    squared_error = sum((value % 256) ** 2 * count for value, count in enumerate(histogram))
    absolute_error = sum((value % 256) * count for value, count in enumerate(histogram))
    pixel_differences = difference.get_flattened_data()
    changed_pixels = sum(
        1 for rgba in pixel_differences if max(rgba) > args.threshold
    )
    maximum_error = max((max(rgba) for rgba in pixel_differences), default=0)
    report = {
        "width": reference.width,
        "height": reference.height,
        "changedPixels": changed_pixels,
        "changedPercent": changed_pixels / pixels * 100,
        "meanAbsoluteError": absolute_error / channel_samples,
        "rootMeanSquareError": math.sqrt(squared_error / channel_samples),
        "maximumChannelError": maximum_error,
        "threshold": args.threshold,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))

    if args.diff:
        args.diff.parent.mkdir(parents=True, exist_ok=True)
        ImageEnhance.Contrast(difference).enhance(4).save(args.diff)

    return 0 if changed_pixels == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
