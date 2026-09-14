"""Create compact card previews while keeping original art for the detail view."""
from pathlib import Path
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
cards_dir = root / "dist" / "cards"
thumbs_dir = root / "dist" / "thumbs"
thumbs_dir.mkdir(exist_ok=True)

for source in cards_dir.glob("*.webp"):
    target = thumbs_dir / source.name
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        continue
    with Image.open(source) as image:
        width = 150
        height = round(image.height * width / image.width)
        image.resize((width, height), Image.Resampling.LANCZOS).save(
            target, "WEBP", quality=58, method=6
        )

for filename in ("cards.json", "base.json"):
    path = root / "dist" / "data" / filename
    cards = json.loads(path.read_text(encoding="utf-8"))
    for card in cards:
        card["thumbnail"] = f"thumbs/{card['id']}.webp"
    path.write_text(json.dumps(cards, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
