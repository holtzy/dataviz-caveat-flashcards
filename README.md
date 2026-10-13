# dataviz-caveat-flashcards

A collection of flashcards about common data visualization caveats, by [Data to Viz](https://www.data-to-viz.com).
Each card shows a "not ideal" chart next to a better alternative, with a short explanation.

Every card comes in two formats:

- **horizontal** (2560×1600), for slides and desktop
- **vertical** (720×1440), for phones and social media

Images are available as PNG in [`png/`](png) and as lossless WebP (about 3× smaller) in [`webp/`](webp).

## Choose the right chart

- **Boxplots hide information**: a boxplot hides sample size and distribution shape. Show individual points, or use a violin or raincloud plot. [horizontal](png/05-boxplots-hide-info-horiz.png) · [vertical](png/05-boxplots-hide-info-vert.png)
- **Avoid the moiré effect with lollipops**: many long bars create an optical illusion. A lollipop chart is cleaner. [horizontal](png/08-avoid-moire-effect-horiz.png) · [vertical](png/08-avoid-moire-effect-vert.png)
- **The spaghetti chart**: too many overlapping lines are unreadable. Use small multiples or highlight the key lines. [horizontal](png/09-the-spaghetti-chart-horiz.png) · [vertical](png/09-the-spaghetti-chart-vert.png)
- **What's wrong with pie charts?**: angles are hard to compare. Prefer a chart that compares lengths. [horizontal](png/13-whats-wrong-with-pie-horiz.png) · [vertical](png/13-whats-wrong-with-pie-vert.png)
- **Error bars on barplots**: error bars hide the distribution. Show the data points, and say what the bars represent. [horizontal](png/14-error-bars-on-barplot-horiz.png) · [vertical](png/14-error-bars-on-barplot-vert.png)
- **Radial bar charts distort perception**: outer bars look bigger because of the layout, not the data. Use a regular bar chart. [horizontal](png/16-radial-bar-chart-horiz.png) · [vertical](png/16-radial-bar-chart-vert.png)
- **Connect the dots**: when the x-axis has a natural order like time, lines make the trend easier to see. [horizontal](png/17-connect-the-dots-horiz.png) · [vertical](png/17-connect-the-dots-vert.png)
- **Avoid 3D**: 3D distorts perception without adding anything. Stick to 2D. [horizontal](png/19-avoid-3d-horiz.png) · [vertical](png/19-avoid-3d-vert.png)
- **UpSet plots**: Venn diagrams get cluttered beyond 3 groups. An UpSet plot shows intersections more clearly. [horizontal](png/20-upset-plots-horiz.png) · [vertical](png/20-upset-plots-vert.png)
- **Stacked charts are hard to read**: the shifting baseline makes each group hard to follow. Use line charts or small multiples. [horizontal](png/24-stacked-charts-are-hard-horiz.png) · [vertical](png/24-stacked-charts-are-hard-vert.png)

## Don't mislead

- **Do not cut the y-axis**: a truncated axis exaggerates differences between groups. [horizontal](png/03-do-not-cut-y-axis-horiz.png) · [vertical](png/03-do-not-cut-y-axis-vert.png)
- **Histograms: mind the bin size**: different bin sizes can reveal, or hide, patterns in the data. [horizontal](png/04-histogram-mind-the-bin-horiz.png) · [vertical](png/04-histogram-mind-the-bin-vert.png)
- **Size bubbles by area, not radius**: mapping values to the radius makes big values look far bigger than they are. [horizontal](png/07-map-bubble-size-to-area-horiz.png) · [vertical](png/07-map-bubble-size-to-area-vert.png)
- **Avoid counterintuitive visuals**: reversed timelines, inverted axes or odd colors break conventions and confuse readers. [horizontal](png/12-avoid-counterintuitive-horiz.png) · [vertical](png/12-avoid-counterintuitive-vert.png)
- **Dual y-axis**: two scales can be tuned to fake a correlation. Use two charts or normalize the data. [horizontal](png/15-dual-y-axis-horiz.png) · [vertical](png/15-dual-y-axis-vert.png)
- **Avoid cherry-picking data**: zooming in on a convenient period can hide the real trend. Show the full context. [horizontal](png/25-avoid-cherry-picking-horiz.png) · [vertical](png/25-avoid-cherry-picking-vert.png)
- **Don't move countries around**: moving or dropping a country to save space distorts geography. Keep every country where it belongs. [horizontal](png/26-dont-move-countries-horiz.png) · [vertical](png/26-dont-move-countries-vert.png)

## Use color well

- **Use color intentionally**: only add colors when they carry meaning, such as distinct categories. [horizontal](png/06-use-color-intentionally-horiz.png) · [vertical](png/06-use-color-intentionally-vert.png)
- **Keep colors consistent across charts**: the same group should keep the same color everywhere. [horizontal](png/10-keep-colors-consistent-horiz.png) · [vertical](png/10-keep-colors-consistent-vert.png)
- **Optimize background colors**: use light, low-saturation backgrounds, and soft dark tones rather than pure black in dark mode. [horizontal](png/21-optimizing-background-colors-horiz.png) · [vertical](png/21-optimizing-background-colors-vert.png)
- **Color contrast**: low contrast makes elements hard to tell apart. [horizontal](png/22-color-contrast-horiz.png) · [vertical](png/22-color-contrast-vert.png)
- **Avoid pure, flashy colors**: pure red, green and blue are harsh and problematic for colorblind readers. Use softer tones. [horizontal](png/23-avoid-pure-color-horiz.png) · [vertical](png/23-avoid-pure-color-vert.png)

## Make it easy to read

- **Rank your barplot**: ordering the bars makes the ranking instantly readable. [horizontal](png/01-rank-your-barplot-horiz.png) · [vertical](png/01-rank-your-barplot-vert.png)
- **Prefer horizontal labels**: pick a layout that keeps labels readable, often a horizontal barplot. [horizontal](png/02-prefer-horizontal-labels-horiz.png) · [vertical](png/02-prefer-horizontal-labels-vert.png)
- **Minimize the use of legends**: legends force the eye back and forth. Label elements directly instead. [horizontal](png/11-minimize-use-of-legends-horiz.png) · [vertical](png/11-minimize-use-of-legends-vert.png)
- **Z-index matters**: in a bubble chart, draw large bubbles beneath small ones, not on top. [horizontal](png/18-z-index-matters-horiz.png) · [vertical](png/18-z-index-matters-vert.png)
