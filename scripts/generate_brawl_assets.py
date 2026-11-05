#!/usr/bin/env python3
"""Generate close-up, full-body and complete player assets from brawl images."""

from pathlib import Path

from PIL import Image
from rembg import remove


SOURCE_DIR = Path.home() / "Downloads" / "brawlers"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "assets" / "players"

PLAYERS = {
    "DarioPrina_brawl.png": ("mvvjcutrf2ic", (440, 40, 800, 400), None),
    "AlbiPiro_brawl.png": ("mvvjcutrvgsf", (345, 80, 705, 440), None),
    "Manu_brawl.png": ("mvwe1vvf4dvi", (345, 75, 705, 435), None),
    "RobyTorti_brawl.png": ("mvvl69yshvaz", (345, 75, 705, 435), None),
    "StefanoDelMonte_brawl.png": ("mvvl55fl2w0c", (355, 60, 715, 420), None),
    "FraProca_brawl.jpeg": ("mvvjcutrdbxy", (75, 55, 435, 415), (0, 0, 509, 1024)),
    "vando.png": ("mvzv329qdc6g", (172, 260, 532, 620), None),
    "felice.png": ("mvxkz03ccb68", (172, 260, 532, 620), None),
}

FULL_CANVAS_SIZE = (704, 1024)
FULL_CHARACTER_HEIGHT = 1024


def generate_assets(
    source_path: Path,
    player_id: str,
    face_box: tuple[int, int, int, int],
    complete_box: tuple[int, int, int, int] | None,
) -> None:
    source = Image.open(source_path)
    complete = source.crop(complete_box) if complete_box else source.copy()
    complete = complete.convert("RGBA")
    complete.save(OUTPUT_DIR / f"{player_id}_complete.png", "PNG", optimize=True)

    face = source.crop(face_box).convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
    face.save(OUTPUT_DIR / f"{player_id}_closeup.png", "PNG", optimize=True)

    isolated = remove(complete)
    alpha_bbox = isolated.getchannel("A").getbbox()
    if alpha_bbox is None:
        raise ValueError(f"{source_path.name}: no visible pixels after background removal")

    character = isolated.crop(alpha_bbox)
    scale = min(FULL_CHARACTER_HEIGHT / character.height, (FULL_CANVAS_SIZE[0] - 16) / character.width)
    character_height = round(character.height * scale)
    character = character.resize(
        (round(character.width * scale), character_height), Image.Resampling.LANCZOS
    )
    if character.width > FULL_CANVAS_SIZE[0]:
        raise ValueError(
            f"{source_path.name}: normalized character is too wide ({character.width}px)"
        )

    full = Image.new("RGBA", FULL_CANVAS_SIZE, (0, 0, 0, 0))
    full.alpha_composite(
        character,
        (
            (FULL_CANVAS_SIZE[0] - character.width) // 2,
            FULL_CANVAS_SIZE[1] - character.height,
        ),
    )
    full.save(OUTPUT_DIR / f"{player_id}_full.png", "PNG", optimize=True)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, (player_id, face_box, complete_box) in PLAYERS.items():
        generate_assets(SOURCE_DIR / filename, player_id, face_box, complete_box)
        print(
            f"{filename} -> {player_id}_closeup.png, "
            f"{player_id}_full.png, {player_id}_complete.png"
        )


if __name__ == "__main__":
    main()
