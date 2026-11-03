#!/bin/bash
# Usage: tools/overview.sh
# Builds everything in overview/ from the cards listed in caveats.json:
# the PDF (3 cards per page), the collages of all cards, the email banner and the fanned deck.
set -e
TOOLS="$(cd "$(dirname "$0")" && pwd)"; REPO="$(dirname "$TOOLS")"; BUILD="$TOOLS/.build/overview"; OUT="$REPO/overview"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
mkdir -p "$BUILD/jpg" "$OUT"
# JPG copies keep the PDF small enough to send by email.
for f in "$REPO"/png/*.png; do
  magick "$f" -quality 86 "$BUILD/jpg/$(basename "${f%.png}").jpg"
done
node "$TOOLS/overview.mjs"
shot() { "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --allow-file-access-from-files \
  --virtual-time-budget=10000 --window-size="$2" --screenshot="$3" "file://$BUILD/$1.html" 2>/dev/null; }
"$CHROME" --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=15000 --no-pdf-header-footer \
  --print-to-pdf="$OUT/dataviz-caveats.pdf" "file://$BUILD/pdf.html" 2>/dev/null
for c in collage collage-lego collage-masonry; do shot $c "$(cat "$BUILD/$c.size")" "$BUILD/$c.png"; done
magick "$BUILD/collage.png" -quality 88 "$OUT/collage-full.jpg"
magick "$BUILD/collage.png" -resize 1200x -quality 85 "$OUT/collage-email.jpg"
magick "$BUILD/collage-lego.png" -quality 88 "$OUT/collage-lego.jpg"
magick "$BUILD/collage-masonry.png" -quality 88 "$OUT/collage-masonry.jpg"
shot banner 1200,630 "$OUT/banner.png"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --allow-file-access-from-files --default-background-color=00000000 \
  --virtual-time-budget=10000 --window-size="$(cat "$BUILD/deck.size")" --screenshot="$OUT/deck.png" "file://$BUILD/deck.html" 2>/dev/null
ls -lh "$OUT"
