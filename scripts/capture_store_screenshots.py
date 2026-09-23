#!/usr/bin/env python3
"""Capture store screenshot mocks via Playwright Chromium."""

from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
src_dir = root / "store" / "screenshot-mocks"
out_dir = root / "store" / "screenshots"

pages = [
    ("01-popup-site-classify.html", "01-popup-site-classify.png"),
    ("02-popup-recent-stats.html", "02-popup-recent-stats.png"),
    ("03-options-rules.html", "03-options-rules.png"),
    ("04-prompt-classify-attribution.html", "04-prompt-classify-attribution.png"),
    ("05-explorer-classified-mock.html", "05-explorer-classified-mock.png"),
]


def main() -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
        for html_name, png_name in pages:
            html_path = src_dir / html_name
            dest = out_dir / png_name
            page.goto(html_path.as_uri(), wait_until="networkidle")
            page.locator(".stage").screenshot(path=str(dest), type="png")
            print(f"wrote {dest}")
        browser.close()


if __name__ == "__main__":
    main()
