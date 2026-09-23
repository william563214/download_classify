#!/usr/bin/env python3
"""Render extension and store icons from SVG via Playwright."""

from __future__ import annotations

import base64
from pathlib import Path

from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
svg_path = root / "public" / "icons" / "icon.svg"
out_dir = root / "public" / "icons"
store_icons = root / "store" / "icons"

sizes = {
    out_dir / "icon16.png": 16,
    out_dir / "icon32.png": 32,
    out_dir / "icon48.png": 48,
    out_dir / "icon128.png": 128,
    store_icons / "icon300.png": 300,
}


def main() -> None:
    svg = svg_path.read_text(encoding="utf-8")
    b64 = base64.b64encode(svg.encode()).decode()
    store_icons.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        for dest, size in sizes.items():
            page = browser.new_page(
                viewport={"width": size, "height": size},
                device_scale_factor=1,
            )
            page.set_content(
                f"""<!DOCTYPE html><html><head><style>
                html,body{{margin:0;padding:0;width:{size}px;height:{size}px;overflow:hidden;background:#0078d4}}
                img{{width:{size}px;height:{size}px;display:block}}
                </style></head><body>
                <img src="data:image/svg+xml;base64,{b64}" alt="">
                </body></html>"""
            )
            page.locator("img").screenshot(path=str(dest), type="png", omit_background=False)
            page.close()
            print(f"wrote {dest} ({size}x{size})")
        browser.close()


if __name__ == "__main__":
    main()
