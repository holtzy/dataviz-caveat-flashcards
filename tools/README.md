# Card generator

Builds new flashcards in the same style as the hand-made ones. It reuses existing cards as base templates
(`png/22-color-contrast-horiz.png` and `png/01-rank-your-barplot-vert.png`) so the background, panels, ✗/✓ labels,
logo and footer are pixel-identical, and only draws the title, the two charts and the caption on top.

Requirements: Node, Google Chrome, ImageMagick (`magick`), and an internet connection (fonts come from Google Fonts).

```sh
cd tools && npm install        # once
./render.sh 27-beware-mercator # writes png/ and webp/, horizontal + vertical
```

To add a card, add an entry to `CARDS` in `build.mjs`:

- `title`, and `titleBreak`: the word after which the vertical version wraps to a second line
- `caption`: two lines for the horizontal version (joined into a paragraph for the vertical one)
- `horiz` / `vert`: chart size (`mw`, `mh`), and `left` / `right` functions returning the "not ideal" and "better" SVGs

Then run `./render.sh <slug>` and add the card to the main README.
