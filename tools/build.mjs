// Builds flashcards in the Data to Viz style, using existing cards as base templates.
// Usage: node build.mjs <slug>   -> writes .build/<slug>-horiz.html and .build/<slug>-vert.html
// Normally run through render.sh, which also screenshots them into png/ and webp/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoMercator, geoEqualEarth, geoPath, geoBounds, geoCentroid } from "d3-geo";
import { feature } from "topojson-client";

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(TOOLS, "..");
const OUT = path.join(TOOLS, ".build");
fs.mkdirSync(OUT, { recursive: true });
const world = JSON.parse(fs.readFileSync(path.join(TOOLS, "node_modules/world-atlas/countries-50m.json")));
const countries = feature(world, world.objects.countries).features;
const byName = (n) => countries.find((c) => c.properties.name === n);

const GRADIENT = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#84C3B5"/><stop offset="1" stop-color="#4C9A87"/></linearGradient>`;
const svg = (w, h, inner) =>
  `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="visible" xmlns="http://www.w3.org/2000/svg"><defs>${GRADIENT}</defs>${inner}</svg>`;
// Teal shape with the flat offset shadow used on the bars of the other cards.
const shaded = (d, off) => `<path d="${d}" fill="#DEDFDF" transform="translate(${off},${off})"/><path d="${d}" fill="url(#g)"/>`;

// ---------- geometry helpers ----------
const asMulti = (g) => (g.type === "Polygon" ? { type: "MultiPolygon", coordinates: [g.coordinates] } : g);
const mapCoords = (geom, fn) => ({
  ...geom,
  coordinates: geom.coordinates.map((poly) => poly.map((ring) => ring.map(([x, y]) => fn(x < 0 ? x + 360 : x, y)))),
});
const keepPolys = (f, test) => {
  const g = asMulti(f.geometry);
  return { type: "Feature", properties: f.properties, geometry: { ...g, coordinates: g.coordinates.filter((p) => test(geoBounds({ type: "Polygon", coordinates: p }))) } };
};

// ---------- card 26: don't move countries ----------
const aus = keepPolys(byName("Australia"), ([[x0, y0]]) => x0 > 110 && x0 < 155 && y0 > -45);
const nzRaw = keepPolys(byName("New Zealand"), ([[x0, y0], [x1]]) => x0 > 165 && x1 < 179 && y0 > -48);
const nz = { ...nzRaw, geometry: mapCoords(nzRaw.geometry, (x, y) => [x, y]) };
const nzMoved = { ...nz, geometry: mapCoords(nz.geometry, (x, y) => [x - 39, y - 6]) }; // tucked under the Bight

function oceania(w, h, moved) {
  const nzShape = moved ? nzMoved : nz;
  const path = geoPath(geoMercator().fitExtent([[0, 0], [w, h]], { type: "FeatureCollection", features: [aus, nzShape] }));
  return svg(w, h, shaded(path(aus), 4) + shaded(path(nzShape), 4));
}

// ---------- card 27: mercator ----------
const NOT_AFRICA = ["Yemen", "Saudi Arabia", "Oman", "Israel", "Jordan", "Syria", "Lebanon", "Iraq", "Cyprus", "Kuwait", "United Arab Emirates", "Qatar", "Bahrain", "Palestine", "Spain", "Portugal", "Italy", "Greece", "Malta", "Turkey", "Fr. S. Antarctic Lands"];
const AFRICA = new Set(countries.filter((c) => {
  const [x, y] = geoCentroid(c);
  return x > -20 && x < 52 && y > -36 && y < 38 && !NOT_AFRICA.includes(c.properties.name);
}).map((c) => c.properties.name));
const noAntarctica = countries.filter((c) => c.properties.name !== "Antarctica");

function worldMap(w, h, projection, labelSize) {
  const proj = projection.fitExtent([[0, 0], [w, h]], { type: "FeatureCollection", features: noAntarctica });
  const path = geoPath(proj);
  const grey = noAntarctica.filter((c) => c.properties.name !== "Greenland" && !AFRICA.has(c.properties.name)).map(path).join("");
  const africa = noAntarctica.filter((c) => AFRICA.has(c.properties.name)).map(path).join("");
  const greenland = path(byName("Greenland"));
  const label = (txt, [x, y], anchor, color) =>
    `<text x="${x}" y="${y}" fill="${color}" stroke="#fff" stroke-width="${labelSize / 4}" paint-order="stroke" stroke-linejoin="round" font-family="Roboto Slab" font-size="${labelSize}" text-anchor="${anchor}" dominant-baseline="middle">${txt}</text>`;
  // Africa is labelled inside the shape; Greenland is too small in Equal Earth, so it is labelled to its right.
  const [gx, gy] = proj([-18, 72]);
  return svg(w, h, `<path d="${grey}" fill="#E6E6E6"/>` + shaded(africa, 3) + shaded(greenland, 3) +
    label("Africa", proj([20, 6]), "middle", "#fff").replace(/stroke="#fff" stroke-width="[^"]*"/, "") + label("Greenland", [gx + labelSize * 0.3, gy], "start", "#333"));
}

// ---------- card 28: scatter plot aspect ratio ----------
// One fixed point cloud (seeded, so every render is identical), drawn at whatever size the panel asks for.
const rand = ((seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296))(28);
const normal = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
const CLOUD = Array.from({ length: 140 }, () => {
  const x = rand();
  return [x, Math.min(1, Math.max(0, 0.15 + 0.65 * x + normal() * 0.11))];
});

// Axes as on the "Color contrast" card: thin lines offset from the plot, with end caps.
function scatter(w, h, r, stroke) {
  const gap = stroke * 12, cap = stroke * 4;
  const axes = `<g stroke="#333" stroke-width="${stroke}" fill="none">
    <path d="M${-gap},0V${h}M${-gap - cap},0H${-gap + cap}M${-gap - cap},${h}H${-gap + cap}"/>
    <path d="M0,${h + gap}H${w}M0,${h + gap - cap}V${h + gap + cap}M${w},${h + gap - cap}V${h + gap + cap}"/></g>`;
  const dots = CLOUD.map(([x, y]) => `<circle cx="${(r + x * (w - 2 * r)).toFixed(1)}" cy="${(h - r - y * (h - 2 * r)).toFixed(1)}" r="${r}"/>`).join("");
  return svg(w, h, axes + `<g fill="url(#g)" stroke="#fff" stroke-width="${r / 4}">${dots}</g>`);
}

// ---------- card 29: proportions that match the numbers ----------
// Arc from 12 o'clock, clockwise, covering `frac` of the ring.
function arc(cx, cy, r, frac) {
  const a = 2 * Math.PI * Math.min(frac, 0.9999);
  const [x, y] = [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  return `M${cx},${cy - r}A${r},${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x.toFixed(2)},${y.toFixed(2)}`;
}
// `donuts`: [{ value, drawn, label }] - `drawn` is the share of the ring actually filled.
function donutRow(donuts, r, thick, gap, numSize) {
  const w = donuts.length * 2 * r + (donuts.length - 1) * gap + thick, h = 2 * r + thick;
  const g = donuts.map(({ value, drawn, label }, i) => {
    const cx = thick / 2 + r + i * (2 * r + gap), cy = h / 2;
    const ring = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E6E6E6" stroke-width="${thick}"/>`;
    const fill = (dx, color) => `<path d="${arc(cx + dx, cy + dx, r, drawn)}" fill="none" stroke="${color}" stroke-width="${thick}"/>`;
    const text = `<g font-family="Roboto Slab" text-anchor="middle" fill="#333">
      <text x="${cx}" y="${cy + numSize * 0.12}" font-size="${numSize}">${value}%</text>
      <text x="${cx}" y="${cy + numSize * 0.62}" font-size="${numSize * 0.42}" font-weight="300">${label}</text></g>`;
    return ring + fill(3, "#DEDFDF") + fill(0, "url(#gs)") + text;
  }).join("");
  // userSpaceOnUse so the gradient follows the arc's ring rather than its (odd-shaped) bounding box.
  const gs = `<linearGradient id="gs" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="${h}"><stop offset="0" stop-color="#84C3B5"/><stop offset="1" stop-color="#4C9A87"/></linearGradient>`;
  return svg(w, h, `<defs>${gs}</defs>` + g);
}
const PROPORTIONS = (drawnA, drawnB) => [
  { value: 86, drawn: drawnA, label: "Group A" },
  { value: 14, drawn: drawnB, label: "Group B" },
];

// ---------- card 30: readable date axis ----------
const DAY = 864e5, T0 = Date.UTC(2020, 1, 4), T1 = Date.UTC(2021, 11, 20);
// Smooth synthetic epidemic waves: [peak date, height, width in days].
const WAVES = [[Date.UTC(2020, 3, 10), 6, 25], [Date.UTC(2020, 10, 10), 22, 22], [Date.UTC(2021, 0, 8), 60, 18], [Date.UTC(2021, 6, 18), 46, 14], [Date.UTC(2021, 9, 20), 38, 40], [Date.UTC(2021, 11, 20), 85, 7]];
const SERIES = Array.from({ length: (T1 - T0) / DAY + 1 }, (_, i) => {
  const t = T0 + i * DAY;
  return [t, WAVES.reduce((s, [p, hgt, wd]) => s + hgt * Math.exp(-(((t - p) / DAY / wd) ** 2) / 2), 0)];
});
const SERIES_MAX = Math.max(...SERIES.map(([, v]) => v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// `ticks`: [{ t, label, sub, minor }] - sub is an optional second label row (the year).
function timeSeries(w, h, ticks, s) {
  const x = (t) => ((t - T0) / (T1 - T0)) * w, y = (v) => h - (v / SERIES_MAX) * h;
  const line = SERIES.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const gap = s * 14, cap = s * 4, base = h + gap;
  const axes = `<g stroke="#333" stroke-width="${s}" fill="none">
    <path d="M${-gap},0V${h}M${-gap - cap},0H${-gap}M${-gap - cap},${h}H${-gap}"/>
    <path d="M0,${base}H${w}"/>
    ${ticks.map((k) => `<path d="M${x(k.t).toFixed(1)},${base}v${k.minor ? cap * 1.2 : cap * 2.4}"/>`).join("")}</g>`;
  const fs = s * 10;
  const labels = ticks.filter((k) => k.label).map((k) =>
    `<text x="${x(k.t).toFixed(1)}" y="${base + cap * 2.4 + fs * 1.1}">${k.label}</text>` +
    (k.sub ? `<text x="${x(k.t).toFixed(1)}" y="${base + cap * 2.4 + fs * 2.3}" font-weight="300">${k.sub}</text>` : "")).join("");
  return svg(w, h + gap + cap * 2.4 + fs * 2.6,
    `<path d="${line}L${w},${h}L0,${h}Z" fill="#E9F4F1"/><path d="${line}" fill="none" stroke="#5BA593" stroke-width="${s * 1.6}" stroke-linejoin="round"/>` +
    axes + `<g font-family="Roboto Slab" font-size="${fs}" fill="#333" text-anchor="middle">${labels}</g>`);
}
// The original chart: evenly spaced but arbitrary dates, and no years.
const ODD_TICKS = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(T0 + (i * (T1 - T0)) / 5);
  return { t: d.getTime(), label: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` };
});
// Every month gets a minor tick; quarters are labelled, with the year under the first label of each year.
const CLEAN_TICKS = [];
for (let y = 2020; y <= 2021; y++) for (let m = 0; m < 12; m++) {
  const t = Date.UTC(y, m, 1);
  if (t < T0 || t > T1) continue;
  const labelled = m % 3 === 0;
  const firstOfYear = labelled && !CLEAN_TICKS.some((k) => k.label && new Date(k.t).getUTCFullYear() === y);
  CLEAN_TICKS.push(labelled ? { t, label: MONTHS[m], sub: firstOfYear ? String(y) : "" } : { t, minor: true });
}

// ---------- card 31: sequential palette for numeric values ----------
const rand31 = ((seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296))(31);
const africaFeatures = countries.filter((c) => AFRICA.has(c.properties.name));
// Made-up values with a smooth north-to-south trend plus noise, so the map has a real spatial pattern.
const AFRICA_VALUES = new Map(africaFeatures.map((c) => {
  const [, lat] = geoCentroid(c);
  return [c.properties.name, Math.min(99, Math.max(1, 50 - lat * 1.25 + (rand31() - 0.5) * 40))];
}));
const BINS = ["0–20", "20–40", "40–60", "60–80", "80–100"];
const CATEGORICAL = ["#6782C2", "#E8524F", "#9CC266", "#E0A82E", "#A4294F"]; // deliberately in no meaningful order
const SEQUENTIAL = ["#CFE7E0", "#A3D2C5", "#72B6A4", "#4C9A87", "#2F6E5F"];

function choropleth(w, h, palette, fs) {
  const path = geoPath(geoMercator().fitExtent([[0, 0], [w, h]], { type: "FeatureCollection", features: africaFeatures }));
  const shapes = africaFeatures.map((c) => `<path d="${path(c)}" fill="${palette[Math.min(4, Math.floor(AFRICA_VALUES.get(c.properties.name) / 20))]}"/>`).join("");
  // Legend in the empty Atlantic, bottom-left of the map.
  const sw = fs * 1.6, sh = fs * 1.1, lx = 0, ly = h - BINS.length * (sh + fs * 0.35);
  const legend = BINS.map((b, i) => {
    const y = ly + (BINS.length - 1 - i) * (sh + fs * 0.35); // highest class on top
    return `<rect x="${lx}" y="${y}" width="${sw}" height="${sh}" fill="${palette[i]}"/><text x="${lx + sw + fs * 0.5}" y="${y + sh / 2}" dominant-baseline="middle">${b}</text>`;
  }).join("");
  return svg(w, h, `<g stroke="#fff" stroke-width="${fs / 16}" stroke-linejoin="round">${shapes}</g><g font-family="Roboto Slab" font-size="${fs}" fill="#333">${legend}</g>`);
}

// ---------- card 32: shared y-axis across small multiples ----------
// Two series with a similar shape but very different magnitudes.
const SHAPE = Array.from({ length: 24 }, (_, i) => 0.2 + 0.8 * (i / 23) ** 1.4 + 0.07 * Math.sin(i * 1.3));
const PAIR = [
  { name: "Group A", values: SHAPE.map((v) => v * 55) },
  { name: "Group B", values: SHAPE.map((v, i) => v * 280 + 6 * Math.cos(i)) },
];
// Each mini chart: y-axis with 3 labelled ticks (0, half, max), line, group name above.
function miniChart(x0, w, h, values, yMax, name, s) {
  const fs = s * 10, x = (i) => x0 + (i / (values.length - 1)) * w, y = (v) => h - (v / yMax) * h;
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ticks = [0, yMax / 2, yMax].map((t) =>
    `<path d="M${x0 - s * 6},${y(t)}h${-s * 4}" stroke="#333" stroke-width="${s}"/><text x="${x0 - s * 13}" y="${y(t)}" text-anchor="end" dominant-baseline="middle">${t}</text>`).join("");
  return `<path d="M${x0 - s * 6},0V${h}" stroke="#333" stroke-width="${s}"/>${ticks}
    <path d="${line}" fill="none" stroke="#5BA593" stroke-width="${s * 1.6}" stroke-linejoin="round"/>
    <text x="${x0 + w / 2}" y="${-fs * 1.4}" text-anchor="middle" font-weight="400">${name}</text>`;
}
function smallMultiples(w, h, shared, s) {
  const fs = s * 10, axisRoom = fs * 3, gap = fs * 3, cw = (w - 2 * axisRoom - gap) / 2;
  const nice = (m) => (m > 100 ? 300 : 60); // rounded axis maxima for these two series
  const sharedMax = nice(Math.max(...PAIR.flatMap((p) => p.values)));
  const charts = PAIR.map((p, i) => miniChart(axisRoom + i * (cw + gap + axisRoom), cw, h, p.values,
    shared ? sharedMax : nice(Math.max(...p.values)), p.name, s)).join("");
  return svg(w, h + fs * 2.2, `<g transform="translate(0,${fs * 2.2})" font-family="Roboto Slab" font-size="${fs}" fill="#333">${charts}</g>`);
}

// ---------- card 33: too many colors ----------
const rand33 = ((seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296))(33);
const GROUPS12 = "ABCDEFGHIJKL".split("").map((name, gi) => {
  // Group K is the story: a cluster clearly apart from the others, top right.
  const [cx, cy] = name === "K" ? [0.82, 0.82] : [0.15 + rand33() * 0.55, 0.15 + rand33() * 0.5];
  const pts = Array.from({ length: 11 }, () => [cx + (rand33() - 0.5) * 0.22, cy + (rand33() - 0.5) * 0.22]);
  return { name, color: `hsl(${(gi * 360) / 12}, 55%, 55%)`, pts };
});
function manyGroups(w, h, highlight, s) {
  const fs = s * 10, r = s * 3, legendW = highlight ? 0 : fs * 7, pw = w - legendW;
  const x = (v) => r + v * (pw - 2 * r), y = (v) => h - r - v * (h - 2 * r);
  const gap = s * 12, cap = s * 4;
  const axes = `<g stroke="#333" stroke-width="${s}" fill="none">
    <path d="M${-gap},0V${h}M${-gap - cap},0H${-gap + cap}M${-gap - cap},${h}H${-gap + cap}"/>
    <path d="M0,${h + gap}H${pw}M0,${h + gap - cap}V${h + gap + cap}M${pw},${h + gap - cap}V${h + gap + cap}"/></g>`;
  // Highlighted group drawn last so it sits on top of the grey ones.
  const order = highlight ? [...GROUPS12.filter((g) => g.name !== "K"), GROUPS12.find((g) => g.name === "K")] : GROUPS12;
  const dots = order.map((g) => {
    const fill = !highlight ? g.color : g.name === "K" ? "url(#g)" : "#D9D9D9";
    return g.pts.map(([px, py]) => `<circle cx="${x(px).toFixed(1)}" cy="${y(py).toFixed(1)}" r="${r}" fill="${fill}"/>`).join("");
  }).join("");
  const legend = highlight
    ? `<text x="${x(0.82)}" y="${y(0.82) - fs * 2.6}" text-anchor="middle" font-weight="400">Group K</text>`
    : GROUPS12.map((g, i) => {
        const lx = pw + fs * 1.6 + (i % 2) * fs * 2.8, ly = fs * 0.6 + Math.floor(i / 2) * fs * 1.7;
        return `<circle cx="${lx}" cy="${ly}" r="${r}" fill="${g.color}"/><text x="${lx + fs * 0.8}" y="${ly}" dominant-baseline="middle">${g.name}</text>`;
      }).join("");
  return svg(w, h, axes + `<g stroke="#fff" stroke-width="${s * 0.6}">${dots}</g><g font-family="Roboto Slab" font-size="${fs}" fill="#333">${legend}</g>`);
}

// ---------- card 34: continuous scale for groups ----------
const rand34 = ((seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296))(34);
// Trends deliberately unrelated to group order, so the shade order doesn't happen to match the values.
const DRIFT5 = [0.1, -0.12, 0.16, -0.04, -0.16];
const LINES5 = [40, 55, 30, 48, 62].map((start, gi) => {
  let v = start;
  return Array.from({ length: 20 }, (_, i) => (i ? (v += (rand34() - 0.5 + DRIFT5[gi]) * 9) : v));
});
const CONTINUOUS5 = ["#B9DDD2", "#8CC6B6", "#5FA995", "#3F8A77", "#2A6457"];
const DISTINCT5 = ["#2A9D84", "#A4294F", "#E0A82E", "#6782C2", "#E8524F"]; // validated: CVD-safe, labelled
function groupLines(w, h, palette, s) {
  const fs = s * 10, legendH = fs * 2.4, ph = h - legendH;
  const all = LINES5.flat(), lo = Math.min(...all) - 4, hi = Math.max(...all) + 4;
  const x = (i) => (i / 19) * w, y = (v) => legendH + ph - ((v - lo) / (hi - lo)) * ph;
  const gap = s * 12, cap = s * 4;
  const axes = `<g stroke="#333" stroke-width="${s}" fill="none">
    <path d="M${-gap},${legendH}V${h}M${-gap - cap},${legendH}H${-gap + cap}M${-gap - cap},${h}H${-gap + cap}"/>
    <path d="M0,${h + gap}H${w}M0,${h + gap - cap}V${h + gap + cap}M${w},${h + gap - cap}V${h + gap + cap}"/></g>`;
  const lines = LINES5.map((vals, gi) => `<path d="${vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}" fill="none" stroke="${palette[gi]}" stroke-width="${s * 1.8}" stroke-linejoin="round"/>`).join("");
  const legend = LINES5.map((_, gi) => {
    const lx = gi * (w / 5);
    return `<path d="M${lx},${fs * 0.6}h${fs * 1.4}" stroke="${palette[gi]}" stroke-width="${s * 2.4}"/><text x="${lx + fs * 1.8}" y="${fs * 0.6}" dominant-baseline="middle">Group ${"ABCDE"[gi]}</text>`;
  }).join("");
  return svg(w, h, axes + lines + `<g font-family="Roboto Slab" font-size="${fs}" fill="#333">${legend}</g>`);
}

// ---------- card definitions ----------
const CARDS = {
  "26-dont-move-countries": {
    title: "DON’T MOVE COUNTRIES AROUND",
    titleBreak: "COUNTRIES ",
    caption: [
      "Moving a country to save space, or dropping it because it doesn’t fit, distorts geography",
      "and can offend its people. Keep every country where it belongs, even if it costs some room.",
    ],
    horiz: { mw: 760, mh: 560, top: 470, left: (w, h) => oceania(w, h, true), right: (w, h) => oceania(w, h, false) },
    vert: { mw: 440, mh: 330, top: 30, left: (w, h) => oceania(w, h, true), right: (w, h) => oceania(w, h, false) },
  },
  "27-beware-mercator": {
    title: "BEWARE OF THE MERCATOR PROJECTION",
    titleBreak: "THE ",
    caption: [
      "Mercator inflates areas far from the equator: Greenland looks as big as Africa,",
      "which is actually 14 times larger. To compare areas, use an equal-area projection like Equal Earth.",
    ],
    horiz: { mw: 900, mh: 600, valign: true, left: (w, h) => worldMap(w, h, geoMercator(), 26), right: (w, h) => worldMap(w, h, geoEqualEarth(), 26) },
    vert: { mw: 520, mh: 340, valign: true, left: (w, h) => worldMap(w, h, geoMercator(), 14), right: (w, h) => worldMap(w, h, geoEqualEarth(), 14) },
  },
  "28-scatter-plot-aspect-ratio": {
    title: "MIND YOUR SCATTER PLOT’S SHAPE",
    titleBreak: "SCATTER ",
    caption: [
      "Stretching a scatter plot changes how steep and how strong the relationship looks.",
      "Default to a square plot, and always use a 1:1 ratio when both axes share the same unit.",
    ],
    // Panels ignore mw/mh: each side has its own shape, centred in the panel.
    horiz: { valign: true, left: () => scatter(760, 330, 9, 2.5), right: () => scatter(480, 480, 9, 2.5) },
    vert: { valign: true, left: () => scatter(440, 190, 5, 1.4), right: () => scatter(290, 290, 5, 1.4) },
  },
  "29-draw-proportions-accurately": {
    title: "DRAW PROPORTIONS ACCURATELY",
    titleBreak: "PROPORTIONS ",
    caption: [
      "When shapes don’t match the numbers, readers trust the shapes and get the wrong picture.",
      "Always draw arcs, bars and areas from the data, never by eye.",
    ],
    horiz: { valign: true, left: () => donutRow(PROPORTIONS(0.65, 0.35), 150, 44, 90, 84), right: () => donutRow(PROPORTIONS(0.86, 0.14), 150, 44, 90, 84) },
    vert: { valign: true, left: () => donutRow(PROPORTIONS(0.65, 0.35), 95, 28, 60, 52), right: () => donutRow(PROPORTIONS(0.86, 0.14), 95, 28, 60, 52) },
  },
  "30-readable-date-axis": {
    title: "MAKE DATE AXES EASY TO FOLLOW",
    titleBreak: "AXES ",
    caption: [
      "Ticks on arbitrary dates, with no year, force readers to work out where they are in time.",
      "Place ticks at regular, meaningful intervals such as months or quarters, and show the year.",
    ],
    horiz: { valign: true, left: () => timeSeries(720, 330, ODD_TICKS, 2.4), right: () => timeSeries(720, 330, CLEAN_TICKS, 2.4) },
    vert: { valign: true, left: () => timeSeries(430, 190, ODD_TICKS, 1.35), right: () => timeSeries(430, 190, CLEAN_TICKS, 1.35) },
  },
  "31-sequential-palette-for-numbers": {
    title: "USE A SEQUENTIAL PALETTE FOR NUMBERS",
    titleBreak: "SEQUENTIAL ",
    caption: [
      "Categorical colors have no natural order: readers can’t tell which color means more without",
      "constantly checking the legend. For numeric values, use a sequential palette from light to dark.",
    ],
    horiz: { valign: true, left: () => choropleth(620, 640, CATEGORICAL, 22), right: () => choropleth(620, 640, SEQUENTIAL, 22) },
    vert: { valign: true, left: () => choropleth(330, 340, CATEGORICAL, 13), right: () => choropleth(330, 340, SEQUENTIAL, 13) },
  },
  "32-share-the-y-axis": {
    title: "SHARE THE Y AXIS TO COMPARE CHARTS",
    titleBreak: "AXIS ",
    caption: [
      "When charts sit side by side to compare the same measure, different y scales make them look alike.",
      "Use the same y axis on all of them so that heights can be compared directly.",
    ],
    horiz: { valign: true, left: () => smallMultiples(800, 300, false, 2.4), right: () => smallMultiples(800, 300, true, 2.4) },
    vert: { valign: true, left: () => smallMultiples(470, 190, false, 1.35), right: () => smallMultiples(470, 190, true, 1.35) },
  },
  "33-too-many-colors": {
    title: "TOO MANY COLORS KILL THE STORY",
    titleBreak: "COLORS ",
    caption: [
      "Beyond a handful of colors, readers can no longer match them to the legend.",
      "Find the story in your data, highlight only what matters, and leave the rest in grey.",
    ],
    horiz: { valign: true, left: () => manyGroups(720, 440, false, 2.4), right: () => manyGroups(560, 440, true, 2.4) },
    vert: { valign: true, left: () => manyGroups(430, 260, false, 1.35), right: () => manyGroups(330, 260, true, 1.35) },
  },
  "34-distinct-colors-for-groups": {
    title: "DON’T USE A GRADIENT FOR GROUPS",
    titleBreak: "GRADIENT ",
    caption: [
      "Shades of a single color are hard to tell apart and suggest an order between groups that doesn’t exist.",
      "For categories, use clearly distinct hues, and keep gradients for numeric values.",
    ],
    horiz: { valign: true, left: () => groupLines(720, 440, CONTINUOUS5, 2.4), right: () => groupLines(720, 440, DISTINCT5, 2.4) },
    vert: { valign: true, left: () => groupLines(440, 270, CONTINUOUS5, 1.35), right: () => groupLines(440, 270, DISTINCT5, 1.35) },
  },
};

// ---------- page layout ----------
const fonts = `<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400&family=Roboto+Slab:wght@300;400&display=block" rel="stylesheet">`;
const page = (w, h, base, body) => `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
body{background:url("${base}") no-repeat 0 0;position:relative}
.box{position:absolute}.bg{background:#F2F2F2}.white{background:#fff}
.title{font-family:Montserrat;color:#212121;font-weight:400}
.cap{font-family:'Roboto Slab';font-weight:300;color:#333;text-align:center}
.slot{display:flex;align-items:center;justify-content:center}
</style></head><body>${body}</body></html>`;

const slug = process.argv[2];
const card = CARDS[slug];
if (!card) throw new Error(`unknown card ${slug}; known: ${Object.keys(CARDS).join(", ")}`);

{ // horizontal 2560x1600: panels x 187-1186 / 1373-2372, y 400-1200, label at ~1100
  const { mw, mh, top, valign, left, right } = card.horiz;
  const panel = (x0, draw) => `<div class="box white" style="left:${x0}px;top:402px;width:995px;height:690px"></div>` +
    (valign
      ? `<div class="box slot" style="left:${x0}px;top:410px;width:999px;height:680px">${draw(mw, mh)}</div>`
      : `<div class="box" style="left:${x0 + (999 - mw) / 2}px;top:${top}px">${draw(mw, mh)}</div>`);
  const body = `
  <div class="box bg" style="left:170px;top:110px;width:1550px;height:120px"></div>
  <div class="box title" style="left:187px;top:139px;font-size:58px;letter-spacing:4.5px;line-height:1">${card.title}</div>
  ${panel(187, left)}${panel(1373, right)}
  <div class="box bg" style="left:60px;top:1280px;width:2440px;height:190px"></div>
  <div class="box cap" style="left:0;width:2560px;top:1313px;font-size:38.5px;letter-spacing:3.4px;line-height:60px">${card.caption.join("<br>")}</div>`;
  fs.writeFileSync(`${OUT}/${slug}-horiz.html`, page(2560, 1600, `${REPO}/png/22-color-contrast-horiz.png`, body));
}
{ // vertical 720x1440: panels x 75-646, y 206-661 / 834-1289, labels at ~626 / ~1253
  const { mw, mh, top, valign, left, right } = card.vert;
  const panel = (y0, draw) => `<div class="box white" style="left:77px;top:${y0}px;width:566px;height:395px"></div>` +
    (valign
      ? `<div class="box slot" style="left:75px;top:${y0 + 4}px;width:571px;height:387px">${draw(mw, mh)}</div>`
      : `<div class="box" style="left:${75 + (571 - mw) / 2}px;top:${y0 + top}px">${draw(mw, mh)}</div>`);
  const body = `
  <div class="box bg" style="left:60px;top:60px;width:620px;height:120px"></div>
  <div class="box title" style="left:75px;top:73px;font-size:36px;letter-spacing:3.1px;line-height:43px;width:600px">${card.title.replace(card.titleBreak, card.titleBreak.trim() + "<br>")}</div>
  ${panel(208, left)}${panel(836, right)}
  <div class="box bg" style="left:60px;top:690px;width:620px;height:125px"></div>
  <div class="box cap" style="left:75px;width:572px;top:703px;font-size:17.4px;letter-spacing:0.75px;line-height:30px;text-align:left">${card.caption.join(" ")}</div>`;
  fs.writeFileSync(`${OUT}/${slug}-vert.html`, page(720, 1440, `${REPO}/png/01-rank-your-barplot-vert.png`, body));
}
console.log("built", slug);
