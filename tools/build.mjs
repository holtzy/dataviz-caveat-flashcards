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

// ---------- cards 35-40: design ----------
// These charts are drawn in a small fixed coordinate system and scaled by `k` to fit each card format.
const scaled = (vw, vh, k, inner) =>
  `<svg width="${vw * k}" height="${vh * k}" viewBox="0 0 ${vw} ${vh}" overflow="visible" xmlns="http://www.w3.org/2000/svg"><defs>${GRADIENT}</defs>${inner}</svg>`;
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const dashed = (x, color) => `<path d="M${x},4V208" stroke="${color}" stroke-width="0.8" stroke-dasharray="3 2.5"/>`;

// A small titled bar chart, reused by the alignment, font and font size cards.
// `x`: left edge of each text block, `fonts`/`styles`: per block, `size`: text scale, `guides`: dashed alignment lines.
const DRINKS = [["Coffee", 92], ["Tea", 61], ["Juice", 38], ["Water", 27]];
function barStory(k, o = {}) {
  const f = { title: "Montserrat", sub: "Roboto Slab", label: "Roboto Slab", value: "Roboto Slab", note: "Roboto Slab", ...o.fonts };
  const st = { title: "", sub: 'font-weight="300"', label: "", value: 'font-weight="300"', note: 'font-weight="300"', ...o.styles };
  const x = { title: 20, sub: 20, label: 20, note: 20, ...o.x }, z = o.size ?? 1, bx = 78;
  const t = (key, tx, ty, size, txt, extra = "") =>
    `<text x="${tx}" y="${ty}" font-family="${f[key]}" font-size="${size * z}" ${st[key]} ${extra}>${txt}</text>`;
  const bars = DRINKS.map(([name, v], i) => {
    const y = 64 + i * 30, w = v * 1.75;
    return shaded(`M${bx},${y}h${w}v16h${-w}Z`, 1.5) +
      t("label", x.label, y + 8, 9.5, name, 'dominant-baseline="middle"') + t("value", bx + w + 5, y + 8, 8.5, v, 'dominant-baseline="middle"');
  }).join("");
  const guides = (o.guides ?? []).map((gx) => dashed(gx, o.guideColor)).join("");
  return scaled(300, 210, k, guides + `<g fill="#333">` +
    t("title", x.title, 24, 15, "Coffee wins the morning", 'fill="#212121"') +
    t("sub", x.sub, 42, 9, "Cups sold per day, by drink") + bars +
    t("note", x.note, 200, 7, "Source: made-up data", 'fill="#777"') + `</g>`);
}

const MISALIGNED = { x: { title: 44, sub: 12, label: 28, note: 60 }, guides: [12, 28, 44, 60], guideColor: "#F2B8B7" };
const ALIGNED = { guides: [20], guideColor: "#A3D2C5" };
const MANY_FONTS = {
  fonts: { title: "Lobster", sub: "Courier Prime", label: "Playfair Display", value: "Oswald", note: "Pacifico" },
  styles: { label: 'font-style="italic"', value: "" },
};

// Card 36: slope chart where a few highlighted lines get a label.
const rand36 = seeded(36);
const SLOPES = Array.from({ length: 30 }, () => {
  const a = 18 + rand36() * 40;
  return [a, Math.min(150, a * (1.5 + rand36() * 1.7))];
});
const SLOPE_HL = [["#1 Site A", 72, 190], ["#7 Site G", 34, 112], ["#30 Site P", 22, 62]];
function slopeChart(k, labelsOnTop) {
  const x0 = 30, x1 = 170, y = (v) => 190 - v * 0.85;
  const lines = SLOPES.map(([a, b]) => `<path d="M${x0},${y(a)}L${x1},${y(b)}" stroke="#BFE0D7" stroke-width="1"/>`).join("");
  const hl = SLOPE_HL.map(([name, a, b]) => {
    const label = labelsOnTop
      ? `<text x="${x0 + (x1 - x0) * 0.8}" y="${y(a + (b - a) * 0.8)}" text-anchor="middle" dominant-baseline="middle">${name}</text>`
      : `<text x="${x1 + 7}" y="${y(b)}" dominant-baseline="middle">${name}</text>`;
    return `<path d="M${x0},${y(a)}L${x1},${y(b)}" stroke="#2F6E5F" stroke-width="1.4"/>` +
      `<circle cx="${x0}" cy="${y(a)}" r="2.2" fill="#2F6E5F"/><circle cx="${x1}" cy="${y(b)}" r="2.2" fill="#2F6E5F"/>` + label;
  }).join("");
  const axes = `<path d="M${x0},20V190M${x1},20V190" stroke="#DDD" stroke-width="0.8"/>
    <g font-size="8" font-weight="300" text-anchor="middle"><text x="${x0}" y="203">Average</text><text x="${x1}" y="203">This year</text></g>`;
  return scaled(240, 205, k, `<g font-family="Roboto Slab" fill="#333" font-size="9">${axes}${lines}${hl}</g>`);
}

// Card 38: the same line chart with the default boxed frame, or decluttered.
const rand38 = seeded(38);
let level38 = 30;
const YEARLY = Array.from({ length: 30 }, () => (level38 = Math.max(10, Math.min(95, level38 + (rand38() - 0.35) * 9))));
function framedLine(k, boxed) {
  const L = 32, R = 290, T = 10, B = 170, x = (i) => L + (i / 29) * (R - L), y = (v) => B - (v / 100) * (B - T);
  const line = `<path d="${YEARLY.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}" fill="none" stroke="#5BA593" stroke-width="2" stroke-linejoin="round"/>`;
  const yTicks = [0, 25, 50, 75, 100], xTicks = [0, 5, 10, 15, 20, 25];
  const yLabels = yTicks.map((v) => `<text x="${L - 7}" y="${y(v)}" text-anchor="end" dominant-baseline="middle">${v}</text>`).join("");
  const xLabels = xTicks.map((i) => `<text x="${x(i)}" y="${B + 15}" text-anchor="middle">${1995 + i}</text>`).join("");
  let frame;
  if (boxed) {
    const grid = [...Array.from({ length: 9 }, (_, i) => `M${L},${T + (i * (B - T)) / 8}H${R}`), ...Array.from({ length: 13 }, (_, i) => `M${L + (i * (R - L)) / 12},${T}V${B}`)].join("");
    const ticks = [...yTicks.map((v) => `M${L},${y(v)}h4M${R},${y(v)}h-4`), ...xTicks.map((i) => `M${x(i)},${B}v-4M${x(i)},${T}v4`)].join("");
    frame = `<path d="${grid}" stroke="#C8C8C8" stroke-width="0.6"/><rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="none" stroke="#222" stroke-width="1.2"/><path d="${ticks}" stroke="#222" stroke-width="1"/>`;
  } else {
    frame = `<path d="${yTicks.map((v) => `M${L},${y(v)}H${R}`).join("")}" stroke="#ECECEC" stroke-width="0.8"/>`;
  }
  return scaled(300, 190, k, frame + line + `<g font-family="Roboto Slab" font-size="8" font-weight="300" fill="#333">${yLabels}${xLabels}</g>`);
}

// Card 40: title block and labelled dots, with loose or tight grouping.
const rand40 = seeded(40);
const CITY_DOTS = Array.from({ length: 26 }, () => [30 + rand40() * 115, 130 + rand40() * 68]);
const CITY_HL = [["City A", 236, 96], ["City B", 196, 122], ["City C", 156, 146]]; // each has a grey neighbour 24 below
function grouping(k, tight) {
  const [ty, s1, s2] = tight ? [22, 39, 50] : [16, 42, 66];
  const grey = [...CITY_DOTS, ...CITY_HL.map(([, x, y]) => [x + 3, y + 24])];
  const dots = grey.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="#D3D3D3"/>`).join("") +
    CITY_HL.map(([, x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="#4C9A87"/>`).join("");
  const labels = CITY_HL.map(([name, x, y]) => tight
    ? `<text x="${x + 7}" y="${y}" dominant-baseline="middle">${name}</text>`
    : `<text x="${x + 9}" y="${y + 12}" dominant-baseline="middle">${name}</text>`).join("");
  const axes = `<path d="M14,86V205M10,86H18M10,205H18M24,213H290M24,209V217M290,209V217" stroke="#333" stroke-width="0.8" fill="none"/>`;
  return scaled(300, 215, k, axes + dots + `<g font-family="Roboto Slab" fill="#333">
    <text x="14" y="${ty}" font-family="Montserrat" font-size="14" fill="#212121">Three cities stand out</text>
    <g font-size="8.5" font-weight="300"><text x="14" y="${s1}">Population and average rent in 30 cities.</text><text x="14" y="${s2}">The three largest also have the highest rents.</text></g>
    <g font-size="9" fill="#2F6E5F">${labels}</g></g>`);
}

// ---------- cards 41-50 ----------
const normalOf = (rnd) => () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
const toHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const ramp = (stops) => (t) => {
  const p = Math.min(1, Math.max(0, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(p)), f = p - i;
  const a = toHex(stops[i]), b = toHex(stops[i + 1]);
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(",")})`;
};
const TEAL_RAMP = ramp(["#F2F9F7", "#A3D2C5", "#4C9A87", "#1F4F44"]);
const JET = (t) => `rgb(${[3, 2, 1].map((o) => Math.round(255 * Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - o))))).join(",")})`;
const thinAxes = (L, T, R, B, s = 0.8, gap = 8, cap = 3) => `<g stroke="#333" stroke-width="${s}" fill="none">
  <path d="M${L - gap},${T}V${B}M${L - gap - cap},${T}H${L - gap + cap}M${L - gap - cap},${B}H${L - gap + cap}"/>
  <path d="M${L},${B + gap}H${R}M${L},${B + gap - cap}V${B + gap + cap}M${R},${B + gap - cap}V${B + gap + cap}"/></g>`;

// Cards 41 & 45: Europe choropleths. Populations in millions (approximate); everything else is made up.
const EUROPE_POP = { Germany: 84, France: 68, "United Kingdom": 67, Italy: 59, Spain: 48, Poland: 37, Ukraine: 37, Romania: 19, Netherlands: 18,
  Belgium: 11.7, Czechia: 10.8, Sweden: 10.5, Greece: 10.4, Portugal: 10.3, Hungary: 9.6, Belarus: 9.2, Austria: 9.1, Switzerland: 8.8,
  Serbia: 6.6, Bulgaria: 6.4, Denmark: 5.9, Finland: 5.6, Norway: 5.5, Slovakia: 5.4, Ireland: 5.2, Croatia: 3.9, "Bosnia and Herz.": 3.2,
  Albania: 2.8, Lithuania: 2.8, Moldova: 2.5, Slovenia: 2.1, Latvia: 1.8, Macedonia: 1.8, Kosovo: 1.8, Estonia: 1.3, Luxembourg: 0.66,
  Montenegro: 0.62, Iceland: 0.38 };
const EUROPE = countries.filter((c) => EUROPE_POP[c.properties.name])
  .map((c) => keepPolys(c, ([[x0, y0], [x1, y1]]) => x0 > -26 && x1 < 45 && y0 > 34 && y1 < 72));
const rand41 = seeded(41);
const EU = new Map(EUROPE.map((c) => {
  const name = c.properties.name, [lon, lat] = geoCentroid(c), rate = 20 + 2.2 * (lat - 35) + (rand41() - 0.5) * 30;
  return [name, { rate, count: EUROPE_POP[name] * rate * 10, anomaly: -1.6 + ((lon + 10) / 50) * 4.2 + (rand41() - 0.5) * 1.2 }];
}));
const roundNice = (v) => { const p = 10 ** (Math.floor(Math.log10(v)) - 1); return Math.round(v / p) * p; };
// Five quantile classes, with the legend labels that go with them.
function quintiles(key) {
  const vals = [...EU.values()].map((d) => d[key]).sort((a, b) => a - b);
  const th = [1, 2, 3, 4].map((i) => roundNice(vals[Math.floor((i * vals.length) / 5)])), f = (v) => v.toLocaleString("en-US");
  return { classOf: (v) => th.filter((t) => v >= t).length, labels: [`< ${f(th[0])}`, ...[0, 1, 2].map((i) => `${f(th[i])}–${f(th[i + 1])}`), `> ${f(th[3])}`] };
}
const ANOMALY_BINS = ["−2 to −1", "−1 to 0", "0 to 1", "1 to 2", "2 to 3"];
const DIVERGING5 = ["#3B6FB6", "#A9C4E6", "#F4C3B1", "#E27F64", "#B83A2E"];
const anomalyClass = (v) => Math.min(4, Math.max(0, Math.floor(v) + 2));

function europeMap(w, h, colorOf, legend, heading, fs) {
  const legendW = fs * 8;
  const path = geoPath(geoMercator().fitExtent([[legendW, 0], [w, h]], { type: "FeatureCollection", features: EUROPE }));
  const shapes = EUROPE.map((c) => `<path d="${path(c)}" fill="${colorOf(EU.get(c.properties.name))}"/>`).join("");
  const sw = fs * 1.6, sh = fs * 1.1, step = sh + fs * 0.35, ly = h - legend.length * step;
  const items = legend.map(([color, label], i) => {
    const y = ly + (legend.length - 1 - i) * step;
    return `<rect x="0" y="${y}" width="${sw}" height="${sh}" fill="${color}"/><text x="${sw + fs * 0.5}" y="${y + sh / 2}" dominant-baseline="middle">${label}</text>`;
  }).join("");
  const head = heading.map((line, i) => `<text x="0" y="${ly - fs * (0.9 + 1.25 * (heading.length - 1 - i))}" font-weight="400">${line}</text>`).join("");
  return svg(w, h, `<g stroke="#fff" stroke-width="${fs / 16}" stroke-linejoin="round">${shapes}</g><g font-family="Roboto Slab" font-size="${fs}" font-weight="300" fill="#333">${head}${items}</g>`);
}
const COUNT_Q = quintiles("count"), RATE_Q = quintiles("rate");
const rawMap = (w, h, fs) => europeMap(w, h, (d) => SEQUENTIAL[COUNT_Q.classOf(d.count)], SEQUENTIAL.map((c, i) => [c, COUNT_Q.labels[i]]), ["Cases"], fs);
const rateMap = (w, h, fs) => europeMap(w, h, (d) => SEQUENTIAL[RATE_Q.classOf(d.rate)], SEQUENTIAL.map((c, i) => [c, RATE_Q.labels[i]]), ["Cases per", "100,000 people"], fs);
const anomalyMap = (w, h, palette, fs) => europeMap(w, h, (d) => palette[anomalyClass(d.anomaly)], palette.map((c, i) => [c, ANOMALY_BINS[i]]), ["Temperature", "anomaly (°C)"], fs);

// Card 42: steady growth, sampled at uneven dates.
const UNEVEN_YEARS = [1990, 2000, 2010, 2015, 2017, 2019, 2020, 2021];
function timeBars(k, trueScale) {
  const L = 20, R = 285, B = 175, v = (yr) => 20 + 2.5 * (yr - 1990), y = (val) => B - val * 1.6;
  const n = UNEVEN_YEARS.length, slot = (R - L) / n;
  const xOf = (yr, i) => (trueScale ? L + 6 + ((yr - 1990) / 31) * (R - L - 12) : L + slot * (i + 0.5));
  const bw = trueScale ? 7 : slot * 0.62;
  const bars = UNEVEN_YEARS.map((yr, i) => shaded(`M${xOf(yr, i) - bw / 2},${y(v(yr))}V${B}h${bw}V${y(v(yr))}Z`, 1.2)).join("");
  const ticks = trueScale ? [1990, 2000, 2010, 2020].map((yr) => [xOf(yr), yr]) : UNEVEN_YEARS.map((yr, i) => [xOf(yr, i), yr]);
  const axis = `<path d="M${L},${B}H${R}${ticks.map(([x]) => `M${x},${B}v4`).join("")}" stroke="#333" stroke-width="0.8"/>` +
    ticks.map(([x, yr]) => `<text x="${x}" y="${B + 15}" text-anchor="middle">${yr}</text>`).join("");
  return scaled(300, 195, k, bars + `<g font-family="Roboto Slab" font-size="8.5" font-weight="300" fill="#333">${axis}</g>`);
}

// Card 43: two groups with similar means but very different sample sizes.
const rand43 = seeded(43), norm43 = normalOf(rand43);
const SAMPLE_A = Array.from({ length: 8 }, () => Math.min(115, Math.max(5, 62 + norm43() * 24)));
const SAMPLE_B = Array.from({ length: 1000 }, () => Math.min(115, Math.max(5, 55 + norm43() * 15)));
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
function sampleSize(k, showPoints) {
  const B = 180, y = (v) => B - v * 1.4, groups = [["Group A", SAMPLE_A, 95, "n = 8"], ["Group B", SAMPLE_B, 215, "n = 1,000"]];
  const body = groups.map(([name, pts, cx, n]) => {
    const m = mean(pts);
    const marks = showPoints
      ? pts.map(() => 0).map((_, i) => `<circle cx="${(cx + (rand43() - 0.5) * 56).toFixed(1)}" cy="${y(pts[i]).toFixed(1)}" r="${pts.length > 100 ? 1.6 : 3.4}" fill="#4C9A87" fill-opacity="${pts.length > 100 ? 0.3 : 0.9}"/>`).join("") +
        `<path d="M${cx - 36},${y(m)}h72" stroke="#1F4F44" stroke-width="2"/><text x="${cx + 40}" y="${y(m)}" dominant-baseline="middle" font-size="8">mean</text>`
      : shaded(`M${cx - 30},${y(m)}V${B}h60V${y(m)}Z`, 1.5) + `<text x="${cx}" y="${y(m) - 6}" text-anchor="middle" font-size="9">${Math.round(m)}</text>`;
    return marks + `<text x="${cx}" y="${B + 14}" text-anchor="middle" font-size="9">${name}</text>` +
      (showPoints ? `<text x="${cx}" y="${B + 25}" text-anchor="middle" font-size="8" font-weight="300">${n}</text>` : "");
  }).join("");
  return scaled(300, 210, k, `<path d="M30,${B}H280" stroke="#333" stroke-width="0.8"/><g font-family="Roboto Slab" fill="#333">${body}</g>`);
}

// Card 44: a smooth field drawn with a rainbow or a perceptually uniform ramp.
const BUMPS = [[0.3, 0.42, 0.2, 1], [0.72, 0.62, 0.13, 0.75], [0.62, 0.22, 0.1, -0.35]];
const FIELD = (() => {
  const nx = 48, ny = 30, raw = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = (i + 0.5) / nx, y = (j + 0.5) / ny;
    raw.push([i, j, 0.35 * x + BUMPS.reduce((s, [bx, by, r, a]) => s + a * Math.exp(-((x - bx) ** 2 + (y - by) ** 2) / (2 * r * r)), 0)]);
  }
  const lo = Math.min(...raw.map((d) => d[2])), hi = Math.max(...raw.map((d) => d[2]));
  return { nx, ny, cells: raw.map(([i, j, v]) => [i, j, (v - lo) / (hi - lo)]) };
})();
function heatField(k, scale) {
  const W = 240, H = 180, cw = W / FIELD.nx, ch = H / FIELD.ny;
  const cells = FIELD.cells.map(([i, j, v]) => `<rect x="${(i * cw).toFixed(2)}" y="${(j * ch).toFixed(2)}" width="${(cw + 0.3).toFixed(2)}" height="${(ch + 0.3).toFixed(2)}" fill="${scale(v)}"/>`).join("");
  const bar = Array.from({ length: 60 }, (_, i) => `<rect x="${W + 12}" y="${(H - ((i + 1) * H) / 60).toFixed(2)}" width="8" height="${(H / 60 + 0.3).toFixed(2)}" fill="${scale(i / 59)}"/>`).join("");
  const labels = `<g font-family="Roboto Slab" font-size="8" font-weight="300" fill="#333"><text x="${W + 24}" y="4" dominant-baseline="middle">High</text><text x="${W + 24}" y="${H - 2}" dominant-baseline="middle">Low</text></g>`;
  return scaled(285, 180, k, cells + bar + labels);
}

// Card 46: a red/green pair vs a colorblind-safe pair, with a deuteranopia simulation (Machado et al. 2009, severity 1).
const DEUTAN = [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]];
const deutan = (h) => {
  const lin = toHex(h).map((c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const out = DEUTAN.map((row) => Math.min(1, Math.max(0, row.reduce((s, m, j) => s + m * lin[j], 0))));
  return `rgb(${out.map((c) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))).join(",")})`;
};
const CVD_SERIES = [[30, 34, 38, 37, 45, 48, 52, 55, 60, 63, 68, 72], [50, 47, 52, 49, 51, 54, 50, 55, 52, 57, 54, 58]];
function cvdPair(k, colors, direct) {
  const rows = [["As designed", (c) => c], ["As seen with deuteranopia", deutan]];
  const body = rows.map(([title, sim], r) => {
    const y0 = r * 105, top = y0 + 18, bot = y0 + 92, R = direct ? 230 : 270;
    const x = (i) => 10 + (i / 11) * (R - 10), y = (v) => bot - ((v - 25) / 52) * (bot - top);
    const lines = CVD_SERIES.map((vals, gi) => `<path d="${vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}" fill="none" stroke="${sim(colors[gi])}" stroke-width="2.2" stroke-linejoin="round"/>`).join("");
    const names = CVD_SERIES.map((vals, gi) => direct
      ? `<text x="${R + 6}" y="${y(vals[11])}" dominant-baseline="middle" fill="${sim(colors[gi])}" font-weight="400">Group ${"AB"[gi]}</text>`
      : `<path d="M${170 + gi * 55},${y0 + 5}h12" stroke="${sim(colors[gi])}" stroke-width="3"/><text x="${186 + gi * 55}" y="${y0 + 5}" dominant-baseline="middle">Group ${"AB"[gi]}</text>`).join("");
    return `<text x="10" y="${y0 + 5}" dominant-baseline="middle" font-weight="400" fill="#212121">${title}</text>` +
      `<path d="M10,${bot + 4}H${R}" stroke="#333" stroke-width="0.8"/>` + lines + names;
  }).join("");
  return scaled(290, 200, k, `<g font-family="Roboto Slab" font-size="8.5" font-weight="300" fill="#333">${body}</g>`);
}

// Card 47: a clustered matrix, shown in alphabetical order or reordered by cluster.
const rand47 = seeded(47);
const ROW_CLUSTER = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2], COL_CLUSTER = [0, 0, 0, 1, 1, 1, 2, 2, 2, 2];
const BLOCKS = [[0.92, 0.18, 0.5], [0.12, 0.82, 0.3], [0.45, 0.35, 0.95]];
const MATRIX = ROW_CLUSTER.map((rc) => COL_CLUSTER.map((cc) => Math.min(1, Math.max(0, BLOCKS[rc][cc] + (rand47() - 0.5) * 0.25))));
const shuffle = (a, rnd) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const ROW_NAMES = shuffle("ABCDEFGHIJKL".split(""), rand47), COL_NAMES = shuffle(Array.from({ length: 10 }, (_, i) => String(i + 1)), rand47);
function clusterHeatmap(k, clustered) {
  const rows = ROW_CLUSTER.map((_, i) => i), cols = COL_CLUSTER.map((_, i) => i);
  if (!clustered) { rows.sort((a, b) => ROW_NAMES[a].localeCompare(ROW_NAMES[b])); cols.sort((a, b) => COL_NAMES[a] - COL_NAMES[b]); }
  const c = 15, L = 16, T = 14;
  const cells = rows.map((r, ri) => cols.map((col, ci) => `<rect x="${L + ci * c}" y="${T + ri * c}" width="${c - 1.2}" height="${c - 1.2}" fill="${TEAL_RAMP(MATRIX[r][col])}"/>`).join("")).join("");
  const labels = rows.map((r, ri) => `<text x="${L - 5}" y="${T + ri * c + c / 2 - 0.6}" text-anchor="end" dominant-baseline="middle">${ROW_NAMES[r]}</text>`).join("") +
    cols.map((col, ci) => `<text x="${L + ci * c + c / 2 - 0.6}" y="${T - 5}" text-anchor="middle">${COL_NAMES[col]}</text>`).join("");
  return scaled(L + 10 * c, T + 12 * c, k, cells + `<g font-family="Roboto Slab" font-size="7" font-weight="300" fill="#333">${labels}</g>`);
}

// Card 48: 5,000 points hiding a dense secondary cluster.
const rand48 = seeded(48), norm48 = normalOf(rand48);
const CROWD = Array.from({ length: 5000 }, (_, i) => i % 10 < 7
  ? [0.42 + norm48() * 0.16, 0.42 + norm48() * 0.15]
  : [0.63 + norm48() * 0.045, 0.6 + norm48() * 0.045]).filter(([x, y]) => x > 0.02 && x < 0.98 && y > 0.02 && y < 0.98);
function crowd(k, transparent) {
  const W = 240, H = 180;
  const dots = CROWD.map(([x, y]) => `<circle cx="${(x * W).toFixed(1)}" cy="${(H - y * H).toFixed(1)}" r="${transparent ? 1 : 2.6}"/>`).join("");
  return scaled(W, H, k, thinAxes(0, 0, W, H) + `<g fill="#4C9A87" ${transparent ? 'fill-opacity="0.13"' : ""}>${dots}</g>`);
}

// Card 49: the same line chart with a generic or a takeaway title.
const SALES = [[2015, 40], [2016, 43], [2017, 44], [2018, 47], [2019, 48], [2020, 50], [2021, 61], [2022, 73], [2023, 86], [2024, 100]];
function takeawayChart(k, takeaway) {
  const L = 30, R = 268, T = 70, B = 185, x = (yr) => L + ((yr - 2015) / 9) * (R - L), y = (v) => B - (v / 110) * (B - T);
  const d = (pts) => pts.map(([yr, v], i) => `${i ? "L" : "M"}${x(yr).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const grid = [0, 50, 100].map((v) => `<path d="M${L},${y(v)}H${R}" stroke="#ECECEC" stroke-width="0.8"/><text x="${L - 6}" y="${y(v)}" text-anchor="end" dominant-baseline="middle">${v}</text>`).join("");
  const xl = [2015, 2020, 2024].map((yr) => `<text x="${x(yr)}" y="${B + 13}" text-anchor="middle">${yr}</text>`).join("");
  const lines = takeaway
    ? `<path d="${d(SALES.slice(0, 6))}" fill="none" stroke="#BDBDBD" stroke-width="2"/><path d="${d(SALES.slice(5))}" fill="none" stroke="#2F6E5F" stroke-width="2.6"/>` +
      [[2020, 50, "50k"], [2024, 100, "100k"]].map(([yr, v, t]) => `<circle cx="${x(yr)}" cy="${y(v)}" r="3" fill="#2F6E5F"/><text x="${x(yr) + (yr === 2024 ? 0 : -4)}" y="${y(v) - 8}" text-anchor="${yr === 2024 ? "middle" : "end"}" font-family="Roboto Slab" font-size="9" font-weight="400" fill="#2F6E5F">${t}</text>`).join("")
    : `<path d="${d(SALES)}" fill="none" stroke="#5BA593" stroke-width="2"/>`;
  return scaled(285, 200, k, `<g font-family="Roboto Slab" font-size="8" font-weight="300" fill="#333">${grid}${xl}</g>${lines}
    <text x="0" y="18" font-family="Montserrat" font-size="14" fill="#212121">${takeaway ? "Sales doubled since 2020" : "Sales by year"}</text>
    <text x="0" y="35" font-family="Roboto Slab" font-size="8.5" font-weight="300" fill="#333">Units sold per year, in thousands</text>`);
}

// Card 50: the same bar chart with raw or rounded numbers.
const SHARES = [["North", 0.234567], ["South", 0.187342], ["East", 0.151209], ["West", 0.098731]];
function roundedBars(k, rounded) {
  const L = 48, B = 160, w = (v) => v * 720;
  const bars = SHARES.map(([name, v], i) => {
    const y = 10 + i * 34;
    return shaded(`M${L},${y}h${w(v)}v18h${-w(v)}Z`, 1.5) +
      `<text x="${L - 7}" y="${y + 9}" text-anchor="end" dominant-baseline="middle" font-weight="400">${name}</text>` +
      `<text x="${L + w(v) + 5}" y="${y + 9}" dominant-baseline="middle">${rounded ? `${Math.round(v * 100)}%` : `${(v * 100).toFixed(4)}%`}</text>`;
  }).join("");
  const axis = rounded ? "" : `<path d="M${L},${B}H${L + w(0.3)}${[0, 0.1, 0.2, 0.3].map((t) => `M${L + w(t)},${B}v4`).join("")}" stroke="#333" stroke-width="0.8"/>` +
    [0, 0.1, 0.2, 0.3].map((t) => `<text x="${L + w(t)}" y="${B + 14}" text-anchor="middle">${t.toFixed(5)}</text>`).join("") +
    `<text x="${L + w(0.15)}" y="${B + 28}" text-anchor="middle">Share (proportion, 0–1)</text>`;
  return scaled(300, 195, k, `<g font-family="Roboto Slab" font-size="9" font-weight="300" fill="#333">${bars}${axis}</g>`);
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
  "35-align-everything": {
    title: "ALIGN EVERYTHING WITH SOMETHING",
    titleBreak: "EVERYTHING ",
    caption: [
      "When the title, labels and notes each start somewhere different, the chart looks messy and is harder to scan.",
      "Snap every element to a shared edge: the fewer alignment lines, the calmer the figure.",
    ],
    horiz: { valign: true, left: () => barStory(2.4, MISALIGNED), right: () => barStory(2.4, ALIGNED) },
    vert: { valign: true, left: () => barStory(1.3, MISALIGNED), right: () => barStory(1.3, ALIGNED) },
  },
  "36-labels-off-the-data": {
    title: "DON’T PUT LABELS ON TOP OF THE DATA",
    titleBreak: "LABELS ",
    caption: [
      "Labels and annotations drawn over lines or shapes hide the data and are hard to read.",
      "Place them in empty space, right next to what they describe, such as at the end of a line.",
    ],
    horiz: { valign: true, left: () => slopeChart(2.6, true), right: () => slopeChart(2.6, false) },
    vert: { valign: true, left: () => slopeChart(1.5, true), right: () => slopeChart(1.5, false) },
  },
  "37-two-fonts-max": {
    title: "TWO FONTS ARE ENOUGH",
    titleBreak: "FONTS ",
    caption: [
      "Every extra typeface adds visual noise and makes a chart look improvised.",
      "Stick to two fonts at most, and use size and weight to build the hierarchy.",
    ],
    horiz: { valign: true, left: () => barStory(2.4, MANY_FONTS), right: () => barStory(2.4) },
    vert: { valign: true, left: () => barStory(1.3, MANY_FONTS), right: () => barStory(1.3) },
  },
  "38-remove-the-box": {
    title: "DO YOU REALLY NEED THAT BOX?",
    titleBreak: "REALLY ",
    caption: [
      "Many R and Python defaults wrap every chart in a box, with ticks on all sides and a dense grid.",
      "It is pure clutter: drop the frame, keep a few light gridlines, and let the data stand out.",
    ],
    horiz: { valign: true, left: () => framedLine(2.4, true), right: () => framedLine(2.4, false) },
    vert: { valign: true, left: () => framedLine(1.4, true), right: () => framedLine(1.4, false) },
  },
  "39-font-size-matters": {
    title: "FONT SIZE MATTERS",
    titleBreak: "SIZE ",
    caption: [
      "Tiny text forces readers to squint, and becomes unreadable on slides and phones.",
      "Never go below 14px for anything meant to be read, and make the title bigger still.",
    ],
    horiz: { valign: true, left: () => barStory(2.4, { size: 0.45 }), right: () => barStory(2.4) },
    vert: { valign: true, left: () => barStory(1.3, { size: 0.45 }), right: () => barStory(1.3) },
  },
  "40-group-what-belongs-together": {
    title: "GROUP WHAT BELONGS TOGETHER",
    titleBreak: "WHAT ",
    caption: [
      "Spacing tells readers what goes together. Loose line height and floating labels blur the structure.",
      "Keep related items tight, put labels right next to their data, and leave more room between groups.",
    ],
    horiz: { valign: true, left: () => grouping(2.4, false), right: () => grouping(2.4, true) },
    vert: { valign: true, left: () => grouping(1.3, false), right: () => grouping(1.3, true) },
  },
  "41-normalize-your-maps": {
    title: "NORMALIZE YOUR MAPS",
    titleBreak: "YOUR ",
    caption: [
      "A map of raw counts is mostly a map of where people live: the biggest countries always look the worst.",
      "Divide by population, or by area, so that colors show a rate rather than a size.",
    ],
    horiz: { valign: true, left: () => rawMap(820, 600, 22), right: () => rateMap(820, 600, 22) },
    vert: { valign: true, left: () => rawMap(460, 340, 12.5), right: () => rateMap(460, 340, 12.5) },
  },
  "42-respect-time-intervals": {
    title: "RESPECT TIME INTERVALS",
    titleBreak: "TIME ",
    caption: [
      "Evenly spaced bars for unevenly spaced dates distort the trend: here, steady growth looks like a slowdown.",
      "Put time on a true scale, so that gaps between dates show as gaps on the chart.",
    ],
    horiz: { valign: true, left: () => timeBars(2.4, false), right: () => timeBars(2.4, true) },
    vert: { valign: true, left: () => timeBars(1.35, false), right: () => timeBars(1.35, true) },
  },
  "43-show-the-sample-size": {
    title: "SHOW THE SAMPLE SIZE",
    titleBreak: "THE ",
    caption: [
      "A mean alone hides how much data stands behind it: 8 values or 1,000 look exactly the same.",
      "Show the individual points, or at least the sample size, so readers can judge how solid it is.",
    ],
    horiz: { valign: true, left: () => sampleSize(2.4, false), right: () => sampleSize(2.4, true) },
    vert: { valign: true, left: () => sampleSize(1.3, false), right: () => sampleSize(1.3, true) },
  },
  "44-avoid-the-rainbow-palette": {
    title: "AVOID THE RAINBOW PALETTE",
    titleBreak: "THE ",
    caption: [
      "Rainbow palettes draw sharp bands that aren’t in the data, and their bright yellow grabs attention for no reason.",
      "Use a perceptually uniform palette that goes smoothly from light to dark.",
    ],
    horiz: { valign: true, left: () => heatField(2.5, JET), right: () => heatField(2.5, TEAL_RAMP) },
    vert: { valign: true, left: () => heatField(1.4, JET), right: () => heatField(1.4, TEAL_RAMP) },
  },
  "45-diverging-palette": {
    title: "DIVERGING DATA, DIVERGING PALETTE",
    titleBreak: "DATA, ",
    caption: [
      "When values fall on both sides of a meaningful midpoint, like zero, a sequential palette hides which side they are on.",
      "Use a diverging palette: one hue for each direction, meeting at a light neutral color at the midpoint.",
    ],
    horiz: { valign: true, left: () => anomalyMap(820, 600, SEQUENTIAL, 22), right: () => anomalyMap(820, 600, DIVERGING5, 22) },
    vert: { valign: true, left: () => anomalyMap(460, 340, SEQUENTIAL, 12.5), right: () => anomalyMap(460, 340, DIVERGING5, 12.5) },
  },
  "46-think-of-colorblind-readers": {
    title: "THINK OF COLORBLIND READERS",
    titleBreak: "OF ",
    caption: [
      "About 1 man in 12 has a color vision deficiency, and red versus green is the classic trap.",
      "Pick colorblind-safe pairs such as blue and orange, and label lines directly whenever you can.",
    ],
    horiz: { valign: true, left: () => cvdPair(2.6, ["#D9534F", "#5CB85C"], false), right: () => cvdPair(2.6, ["#3B6FB6", "#E69F00"], true) },
    vert: { valign: true, left: () => cvdPair(1.45, ["#D9534F", "#5CB85C"], false), right: () => cvdPair(1.45, ["#3B6FB6", "#E69F00"], true) },
  },
  "47-reorder-your-heatmap": {
    title: "REORDER YOUR HEATMAP",
    titleBreak: "YOUR ",
    caption: [
      "In alphabetical or random order, the rows and columns of a heatmap look like noise.",
      "Reorder them, for instance with hierarchical clustering, so that groups and patterns appear.",
    ],
    horiz: { valign: true, left: () => clusterHeatmap(3, false), right: () => clusterHeatmap(3, true) },
    vert: { valign: true, left: () => clusterHeatmap(1.7, false), right: () => clusterHeatmap(1.7, true) },
  },
  "48-beware-of-overplotting": {
    title: "BEWARE OF OVERPLOTTING",
    titleBreak: "OF ",
    caption: [
      "With thousands of points, dots pile up into a solid blob that hides the shape of the data.",
      "Use smaller, transparent dots, or switch to a 2D density or hexbin chart.",
    ],
    horiz: { valign: true, left: () => crowd(2.4, false), right: () => crowd(2.4, true) },
    vert: { valign: true, left: () => crowd(1.4, false), right: () => crowd(1.4, true) },
  },
  "49-make-the-title-say-something": {
    title: "MAKE THE TITLE SAY SOMETHING",
    titleBreak: "TITLE ",
    caption: [
      "A generic title like “Sales by year” leaves readers to find the message on their own.",
      "Write the takeaway in the title, and highlight it on the chart.",
    ],
    horiz: { valign: true, left: () => takeawayChart(2.4, false), right: () => takeawayChart(2.4, true) },
    vert: { valign: true, left: () => takeawayChart(1.35, false), right: () => takeawayChart(1.35, true) },
  },
  "50-round-your-numbers": {
    title: "ROUND YOUR NUMBERS",
    titleBreak: "YOUR ",
    caption: [
      "Too many decimals add noise, and suggest a precision the data doesn’t have.",
      "Round to what matters, and drop axes that only repeat the labels.",
    ],
    horiz: { valign: true, left: () => roundedBars(2.4, false), right: () => roundedBars(2.4, true) },
    vert: { valign: true, left: () => roundedBars(1.35, false), right: () => roundedBars(1.35, true) },
  },
};

// ---------- page layout ----------
const fonts = `<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400&family=Roboto+Slab:wght@300;400&family=Lobster&family=Courier+Prime&family=Playfair+Display:ital@1&family=Oswald&family=Pacifico&display=block" rel="stylesheet">`;
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
