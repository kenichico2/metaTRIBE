#!/usr/bin/env bash
set -euo pipefail

cd /opt/auto-excitement

# Build the Yeo atlas projection on first boot if not already shipped in the
# image. Some upstream layouts embed it; if build_atlas.py is absent or fails
# we continue — the server may still serve metadata-only requests.
if [ -f build_atlas.py ] && [ ! -f atlas/yeo7_fsaverage5.npy ] \
   && [ ! -f atlas/Yeo7_fsaverage5.npy ]; then
  echo "[entrypoint] building Yeo atlas projection..."
  python build_atlas.py || echo "[entrypoint][warn] build_atlas.py failed; continuing"
fi

echo "[entrypoint] starting CORS-enabled FastAPI on port ${PORT:-8080}"
exec python cors_wrapper.py
