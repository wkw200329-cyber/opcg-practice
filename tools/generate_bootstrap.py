"""Create the small card index needed before a game is started."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
source = root / "dist" / "data" / "cards.json"
target = root / "dist" / "data" / "bootstrap.json"
fields = ("id", "name", "nameEn", "type", "life", "colors", "set", "thumbnail")

cards = json.loads(source.read_text(encoding="utf-8"))
bootstrap = [{key: card.get(key) for key in fields} for card in cards]
target.write_text(json.dumps(bootstrap, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Wrote {target}: {len(bootstrap)} cards")
