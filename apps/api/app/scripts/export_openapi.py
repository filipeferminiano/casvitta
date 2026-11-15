"""Write the OpenAPI schema to a file: python -m app.scripts.export_openapi <path>."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from app.main import create_app


def main() -> None:
    target = Path(sys.argv[1] if len(sys.argv) > 1 else "openapi.json")
    schema = create_app().openapi()
    target.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n", "utf-8")
    print(f"OpenAPI schema written to {target}")


if __name__ == "__main__":
    main()
