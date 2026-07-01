#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WIZARD_WEB_DIR="${ROOT_DIR}/wizard/web"
PUBLISH_DIR="${ROOT_DIR}/wizard"

if [[ ! -d "${WIZARD_WEB_DIR}/dist" ]]; then
  echo "Missing wizard build output. Run: (cd wizard/web && npm ci && npm run build)" >&2
  exit 1
fi

rm -rf "${PUBLISH_DIR}/assets"
mkdir -p "${PUBLISH_DIR}/assets"
cp "${WIZARD_WEB_DIR}/dist/index.html" "${PUBLISH_DIR}/index.html"
cp -R "${WIZARD_WEB_DIR}/dist/assets/." "${PUBLISH_DIR}/assets/"
if [[ -f "${WIZARD_WEB_DIR}/dist/sw.js" ]]; then
  cp "${WIZARD_WEB_DIR}/dist/sw.js" "${PUBLISH_DIR}/sw.js"
fi

echo "Published wizard static files to ${PUBLISH_DIR}"
