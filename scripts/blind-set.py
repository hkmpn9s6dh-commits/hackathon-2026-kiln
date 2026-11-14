"""Build the blind-ranking set: six images, same size, random letters.

Reads the five award-winner gallery images plus our feed card, normalises them to
480x320, shuffles the letters, and writes the answer key outside the judge's view.
"""

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

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
    ("kiln", ROOT / "submission" / "cover-1500x1000.png", "KILN — our entry (gallery cover, 1500x1000)"),
]


def normalise(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGB")
    target = W / H
    ratio = img.width / img.height
    # Fit, never crop: cropping a card cuts its own type, and that would make the
    # ranking measure our margin instead of our design.
    if ratio > target:
        new_w = int(img.height * target)
        canvas = Image.new("RGB", (new_w, img.height), (244, 237, 226))
        canvas.paste(img.resize((new_w, int(img.height * new_w / img.width)), Image.LANCZOS), (0, 0))
        img = canvas
    elif ratio < target:
        new_h = int(img.width / target)
        canvas = Image.new("RGB", (img.width, new_h), (244, 237, 226))
        canvas.paste(img, (0, max(0, (new_h - img.height) // 2)))
        img = canvas
    return img.resize((W, H), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    images = [(slug, path, note) for slug, path, note in SOURCES]
    letters = list("ABCDEF")
    random.SystemRandom().shuffle(letters)

    key = {}
    for (slug, path, note), letter in zip(images, letters):
        img = normalise(path).convert("RGB")
        # burn the letter into the image: judges reliably describe pictures but
        # do not reliably map "the third attachment" to the letter C.
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("arialbd.ttf", 30)
        except OSError:
            font = ImageFont.load_default()
        box = [8, 8, 44, 42]
        draw.rectangle(box, fill=(20, 14, 10))
        draw.text((16, 12), letter, fill=(250, 244, 234), font=font)
        img.save(OUT / f"{letter}.png")
        key[letter] = {"slug": slug, "note": note, "source": str(path.relative_to(ROOT))}

    (OUT / "key.json").write_text(
        json.dumps({"size": [W, H], "letters": key}, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({k: v["slug"] for k, v in key.items()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
