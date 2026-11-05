#!/usr/bin/env python3
"""Normalize full-body player images to a shared canvas and visible height."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def normalize_image(
    source_path: Path,
    output_path: Path,
    canvas_width: int,
    canvas_height: int,
    character_height: int,
) -> None:
    image = Image.open(source_path).convert("RGBA")
    alpha_bbox = image.getchannel("A").getbbox()
    if alpha_bbox is None:
        raise ValueError("l'immagine non contiene pixel visibili")

    character = image.crop(alpha_bbox)
    scale = character_height / character.height
    resized_width = round(character.width * scale)
    character = character.resize(
        (resized_width, character_height), Image.Resampling.LANCZOS
    )

    if resized_width > canvas_width:
        raise ValueError(
            f"il personaggio normalizzato e' largo {resized_width}px, "
            f"oltre il canvas di {canvas_width}px"
        )

    normalized = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))
    position = (
        (canvas_width - resized_width) // 2,
        canvas_height - character_height,
    )
    normalized.alpha_composite(character, position)
    normalized.save(output_path, "PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Uniforma canvas, altezza e padding delle immagini *_full.png."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path(__file__).parent,
        help="cartella contenente le immagini originali",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="cartella di output; default: input-dir/normalized",
    )
    parser.add_argument("--canvas-width", type=int, default=704)
    parser.add_argument("--canvas-height", type=int, default=1024)
    parser.add_argument("--character-height", type=int, default=1024)
    args = parser.parse_args()

    output_dir = args.output_dir or args.input_dir / "normalized"
    output_dir.mkdir(parents=True, exist_ok=True)

    source_paths = sorted(args.input_dir.glob("*_full.png"))
    if not source_paths:
        raise SystemExit(f"nessuna immagine *_full.png trovata in {args.input_dir}")

    for source_path in source_paths:
        output_path = output_dir / source_path.name
        normalize_image(
            source_path,
            output_path,
            args.canvas_width,
            args.canvas_height,
            args.character_height,
        )
        print(f"{source_path.name} -> {output_path}")


if __name__ == "__main__":
    main()
