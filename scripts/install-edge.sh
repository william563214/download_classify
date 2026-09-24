#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
dist_dir="$root_dir/dist"

if [[ ! -f "$dist_dir/manifest.json" ]]; then
  echo "dist/manifest.json 不存在，請先執行 npm run build" >&2
  exit 1
fi

echo "建置完成：$dist_dir"
echo
echo "請在 Microsoft Edge 手動載入未封裝擴充功能："
echo "  1. 開啟 edge://extensions"
echo "  2. 啟用「開發人員模式」"
echo "  3. 「載入解壓縮」並選擇："
echo "     $dist_dir"
echo
echo "自動化 e2e 以 Chromium + Playwright 為主（npm run test:e2e）。"
echo "Edge 專用瀏覽器自動化需本機已安裝 Edge，且目前未納入 CI。"
