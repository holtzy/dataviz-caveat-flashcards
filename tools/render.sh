#!/bin/bash
# Usage: tools/render.sh <slug>     e.g. tools/render.sh 27-beware-mercator
# Builds the card defined in build.mjs and writes png/<slug>-{horiz,vert}.png and webp/<slug>-{horiz,vert}.webp
set -e
TOOLS="$(cd "$(dirname "$0")" && pwd)"; REPO="$(dirname "$TOOLS")"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
node "$TOOLS/build.mjs" "$1"
for v in horiz:2560,1600 vert:720,1440; do
  name="$1-${v%%:*}"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --allow-file-access-from-files \
    --virtual-time-budget=8000 --window-size="${v#*:}" --screenshot="$REPO/png/$name.png" "file://$TOOLS/.build/$name.html" 2>/dev/null
  magick "$REPO/png/$name.png" -define webp:lossless=true -define webp:method=6 "$REPO/webp/$name.webp"
  echo "wrote png/$name.png and webp/$name.webp"
done
