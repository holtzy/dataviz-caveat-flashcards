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
