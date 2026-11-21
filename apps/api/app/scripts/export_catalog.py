"""Write the plan catalog snapshot the web reads at build time.

python -m app.scripts.export_catalog <path>  (make catalog:gen; also run by make api:gen).
Annual prices are included; whether pages show them is `show_annual_prices` (off by default).
"""

from __future__ import annotations

import sys
from pathlib import Path

from app.core.catalog import catalog_out
from app.core.settings import get_settings


def main() -> None:
    target = Path(sys.argv[1] if len(sys.argv) > 1 else "catalog.json")
    out = catalog_out(show_annual_prices=get_settings().show_annual_prices)
    target.write_text(out.model_dump_json(indent=2) + "\n", "utf-8")
    print(f"Catalog written to {target}")


if __name__ == "__main__":
    main()
