# dataviz-caveat-flashcards

A collection of flashcards about common data visualization caveats, by [Data to Viz](https://www.data-to-viz.com).
Each card shows a "not ideal" chart next to a better alternative, with a short explanation.

👉 You can browse all the cards at [dataviz-inspiration.com/caveats](https://www.dataviz-inspiration.com/caveats), for a much better browsing experience than this repo.

Every card comes in a horizontal (2560×1600) and a vertical (720×1440) version, as PNG in [`png/`](png) and as lossless WebP in [`webp/`](webp). Links below open the horizontal PNG. New cards can be generated with the script in [`tools/`](tools).

The text of every card (title, caption, what to look for, why it matters, how to fix it, when it's fine) lives in [`caveats.json`](caveats.json). This list and `caveats.md` are both generated from it by `node tools/docs.mjs`.

🤖 **For AI agents:** [`caveats.md`](caveats.md) describes every card in plain text, so an agent can work with the collection without looking at the images. Point your AI assistant or coding agent to it (or paste it in) and ask it to review a chart or a piece of plotting code against all the caveats: for each one it gets what to look for, why it matters, how to fix it and when it's fine.

<!-- cards:start -->
## Misleading charts
- Do not cut the y-axis · [link](png/03-do-not-cut-y-axis-horiz.png)
- Boxplots hide information · [link](png/05-boxplots-hide-info-horiz.png)
- Avoid counterintuitive visuals · [link](png/12-avoid-counterintuitive-horiz.png)
- Error bars on barplots · [link](png/14-error-bars-on-barplot-horiz.png)
- Dual y-axis · [link](png/15-dual-y-axis-horiz.png)
- Avoid 3D · [link](png/19-avoid-3d-horiz.png)
- Avoid cherry-picking data · [link](png/25-avoid-cherry-picking-horiz.png)
- Draw proportions accurately · [link](png/29-draw-proportions-accurately-horiz.png)
- Respect time intervals · [link](png/42-respect-time-intervals-horiz.png)
- Show the sample size · [link](png/43-show-the-sample-size-horiz.png)
- Beware of Simpson's paradox · [link](png/56-simpsons-paradox-horiz.png)

## Wrong chart type
- Avoid the moiré effect with lollipops · [link](png/08-avoid-moire-effect-horiz.png)
- What's wrong with pie charts? · [link](png/13-whats-wrong-with-pie-horiz.png)
- Radial bar charts distort perception · [link](png/16-radial-bar-chart-horiz.png)
- Maybe you don't need a map · [link](png/53-maybe-you-dont-need-a-map-horiz.png)
- Two groups? Try a dumbbell plot · [link](png/54-two-groups-try-a-dumbbell-horiz.png)
- Use circular barplots with care · [link](png/57-circular-barplot-distortion-horiz.png)

## Color
- Use color intentionally · [link](png/06-use-color-intentionally-horiz.png)
- Optimize background colors · [link](png/21-optimizing-background-colors-horiz.png)
- Color contrast · [link](png/22-color-contrast-horiz.png)
- Avoid pure, flashy colors · [link](png/23-avoid-pure-color-horiz.png)
- Use a sequential palette for numbers · [link](png/31-sequential-palette-for-numbers-horiz.png)
- Too many colors kill the story · [link](png/33-too-many-colors-horiz.png)
- Don't use a gradient for groups · [link](png/34-distinct-colors-for-groups-horiz.png)
- Avoid the rainbow palette · [link](png/44-avoid-the-rainbow-palette-horiz.png)
- Diverging data, diverging palette · [link](png/45-diverging-palette-horiz.png)
- Think of colorblind readers · [link](png/46-think-of-colorblind-readers-horiz.png)

## Design
- Align everything with something · [link](png/35-align-everything-horiz.png)
- Two fonts are enough · [link](png/37-two-fonts-max-horiz.png)
- Do you really need that box? · [link](png/38-remove-the-box-horiz.png)
- Font size matters · [link](png/39-font-size-matters-horiz.png)
- Group what belongs together · [link](png/40-group-what-belongs-together-horiz.png)
- Make the title say something · [link](png/49-make-the-title-say-something-horiz.png)
- Declutter: less is more · [link](png/61-declutter-less-is-more-horiz.png)

## Maps
- Don't move countries around · [link](png/26-dont-move-countries-horiz.png)
- Beware of the Mercator projection · [link](png/27-beware-mercator-horiz.png)
- Normalize your maps · [link](png/41-normalize-your-maps-horiz.png)
- Show missing data as missing · [link](png/51-show-missing-data-horiz.png)
- Don't let small regions disappear · [link](png/52-small-regions-disappear-horiz.png)

## Labels and legends
- Prefer horizontal labels · [link](png/02-prefer-horizontal-labels-horiz.png)
- Minimize the use of legends · [link](png/11-minimize-use-of-legends-horiz.png)
- Don't put labels on top of the data · [link](png/36-labels-off-the-data-horiz.png)
- Round your numbers · [link](png/50-round-your-numbers-horiz.png)
- Annotation is crucial · [link](png/55-annotate-your-chart-horiz.png)
- Don't label every tick · [link](png/60-dont-label-every-tick-horiz.png)

## Dashboards and data stories
- Keep colors consistent across charts · [link](png/10-keep-colors-consistent-horiz.png)
- Share the y-axis to compare charts · [link](png/32-share-the-y-axis-horiz.png)
- Use margins between charts · [link](png/58-use-margins-between-charts-horiz.png)
- Link charts that share an axis · [link](png/59-link-your-charts-horiz.png)

## Other
- Rank your barplot · [link](png/01-rank-your-barplot-horiz.png)
- Histograms: mind the bin size · [link](png/04-histogram-mind-the-bin-horiz.png)
- Size bubbles by area, not radius · [link](png/07-map-bubble-size-to-area-horiz.png)
- The spaghetti chart · [link](png/09-the-spaghetti-chart-horiz.png)
- Connect the dots · [link](png/17-connect-the-dots-horiz.png)
- Z-index matters · [link](png/18-z-index-matters-horiz.png)
- UpSet plots · [link](png/20-upset-plots-horiz.png)
- Stacked charts are hard to read · [link](png/24-stacked-charts-are-hard-horiz.png)
- Mind your scatter plot's shape · [link](png/28-scatter-plot-aspect-ratio-horiz.png)
- Make date axes easy to follow · [link](png/30-readable-date-axis-horiz.png)
- Reorder your heatmap · [link](png/47-reorder-your-heatmap-horiz.png)
- Beware of overplotting · [link](png/48-beware-of-overplotting-horiz.png)
<!-- cards:end -->
