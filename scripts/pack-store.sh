#!/usr/bin/env bash
# Pack dist/ into the Edge Add-ons zip at store/download-classify.zip
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root_dir"

npm run build

out_zip="$root_dir/store/download-classify.zip"
rm -f "$out_zip"
(
  cd "$root_dir/dist"
  zip -qr "$out_zip" .
)

echo "packed $out_zip"
