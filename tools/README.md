# Card generator

Builds new flashcards in the same style as the hand-made ones. It reuses existing cards as base templates
(`png/22-color-contrast-horiz.png` and `png/01-rank-your-barplot-vert.png`) so the background, panels, ✗/✓ labels,
logo and footer are pixel-identical, and only draws the title, the two charts and the caption on top.

Requirements: Node, Google Chrome, ImageMagick (`magick`), and an internet connection (fonts come from Google Fonts).

```sh
cd tools && npm install        # once
./render.sh 27-beware-mercator # writes png/ and webp/, horizontal + vertical
```

To add a card:

1. Add it to [`caveats.json`](../caveats.json): `id` (the slug), `section`, `title`, `caption` (two lines separated by `\n` for the
   horizontal version, joined into a paragraph for the vertical one), `look_for`, `why`, `fix`, `ok_when` and `article`.
   The printed title is `title` in capitals.
2. Add its charts to `CARDS` in `build.mjs`:
   - `titleBreak`: the word after which the vertical version wraps to a second line
   - `horiz` / `vert`: chart size (`mw`, `mh`), and `left` / `right` functions returning the "not ideal" and "better" SVGs
3. Run `./render.sh <slug>`, then `node docs.mjs` to update `caveats.md`.
