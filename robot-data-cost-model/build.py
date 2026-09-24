"""Build two self-contained HTML files using only the Python standard library."""
from pathlib import Path
import argparse
import re

ROOT = Path(__file__).resolve().parent

def bundle(name: str) -> str:
    html = (ROOT / name).read_text(encoding="utf-8")
    css = (ROOT / "report.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="report.css">', f"<style>{css}</style>")
    def script(match: re.Match) -> str:
        path = (ROOT / match.group(1)).resolve()
        if path.parent != ROOT or path.suffix != ".js":
            raise ValueError("Only local report scripts can be bundled")
        source = path.read_text(encoding="utf-8").replace("</script", "<\\/script")
        return f"<script>{source}</script>"
    return re.sub(r'<script src="([^"]+)"></script>', script, html)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    for filename in ("index.html", "v2.html"):
        (args.out / filename).write_text(bundle(filename), encoding="utf-8")
        print(args.out / filename)
