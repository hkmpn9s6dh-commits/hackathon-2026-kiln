"""Build the blind-ranking set: six images, same size, random letters.

Reads the five award-winner gallery images plus our feed card, normalises them to
480x320, shuffles the letters, and writes the answer key outside the judge's view.
"""

import json
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "_ref" / "ruler"
OUT = ROOT / "proof" / "rank"
W, H = 480, 320

SOURCES = [
    ("hexaword", REF / "hexaword.png", "Hexaword — Best Daily Game App, Fun & Games with Devvit Web"),
    ("cattack", REF / "cattack.png", "Cattack! — Best Use of Phaser ($5,000), Games with a Hook 2026"),
    ("tinten", REF / "tinten.png", "TinTen — Best Use of User Contributions, Games with a Hook 2026"),
    ("sketchy", REF / "sketchy-solutions.png", "Sketchy Solutions — Best App with a Hook, Games with a Hook 2026"),
    ("hearthvale", REF / "hearthvale.png", "Hearthvale — Honorable Mention, Games with a Hook 2026"),
    ("kiln", ROOT / "shots" / "01-card.png", "KILN — our entry (feed card)"),
]


def normalise(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGB")
    target = W / H
    ratio = img.width / img.height
    if ratio > target:
        # too wide: crop the sides
        new_w = int(img.height * target)
        left = (img.width - new_w) // 2
        img = img.crop((left, 0, left + new_w, img.height))
    elif ratio < target:
        # too tall: crop top and bottom, keep the top third (most cards put the
        # subject high)
        new_h = int(img.width / target)
        top = max(0, int((img.height - new_h) * 0.35))
        img = img.crop((0, top, img.width, top + new_h))
    return img.resize((W, H), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    images = [(slug, path, note) for slug, path, note in SOURCES]
    letters = list("ABCDEF")
    random.SystemRandom().shuffle(letters)

    key = {}
    for (slug, path, note), letter in zip(images, letters):
        img = normalise(path)
        img.save(OUT / f"{letter}.png")
        key[letter] = {"slug": slug, "note": note, "source": str(path.relative_to(ROOT))}

    (OUT / "key.json").write_text(
        json.dumps({"size": [W, H], "letters": key}, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({k: v["slug"] for k, v in key.items()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
