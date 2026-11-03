// Builds the HTML pages behind the lead magnet: a PDF of all cards, a collage, an email banner.
// Usage: node lead-magnet.mjs   -> writes .build/lead-magnet/*.html
// Normally run through lead-magnet.sh, which also prints the PDF and takes the screenshots into lead-magnet/.
// Card order, titles and categories all come from the main README.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(TOOLS, "..");
const OUT = path.join(TOOLS, ".build/lead-magnet");
const JPG = path.join(OUT, "jpg"); // compressed copies of the cards, made by lead-magnet.sh
fs.mkdirSync(OUT, { recursive: true });

// ---------- cards, in README order ----------
const sections = [];
for (const line of fs.readFileSync(path.join(REPO, "README.md"), "utf8").split("\n")) {
  const head = line.match(/^## (.+)/);
  if (head) sections.push({ name: head[1], cards: [] });
  const item = line.match(/^- (.+?) · \[link\]\(png\/(.+?)-horiz\.png\)/);
  if (item) sections.at(-1).cards.push({ title: item[1], slug: item[2], section: sections.at(-1).name });
}
const cards = sections.flatMap((s) => s.cards);
cards.forEach((c, i) => (c.n = i + 1));
const N = cards.length;
const img = (c, v) => `file://${JPG}/${c.slug}-${v}.jpg`;

const NAVY = "#1F1D4D", TEAL = "#4C9A87", MINT = "#84C3B5";
const fonts = `<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&family=Roboto+Slab:wght@300;400&display=block" rel="stylesheet">`;
const navyBg = `background:radial-gradient(ellipse at 50% 45%,#2E2B6B 0%,${NAVY} 60%,#16143A 100%)`;
const page = (css, body) => `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>
*{box-sizing:border-box}body{margin:0;font-family:'Roboto Slab';font-weight:300;color:#333}
.mont{font-family:Montserrat}
${css}</style></head><body>${body}</body></html>`;
// A few horizontal cards fanned out, used on the cover, the banner and the last page.
const FAN = ["54-two-groups-try-a-dumbbell", "27-beware-mercator", "44-avoid-the-rainbow-palette", "03-do-not-cut-y-axis"];
const fan = (w, positions) => positions.map(([x, y, rot], i) =>
  `<img src="${img(cards.find((c) => c.slug === FAN[i]), "horiz")}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;transform:rotate(${rot}deg);border-radius:${w / 60}px;box-shadow:0 ${w / 40}px ${w / 16}px rgba(0,0,0,.45)">`).join("");

// ---------- PDF: A4 landscape, cover + checklist + 3 cards per page + closing page ----------
{
  const PAGES = Math.ceil(N / 3), firstCardPage = 3;
  const pageOf = (c) => firstCardPage + Math.floor((c.n - 1) / 3);
  const footer = (p) => `<div class="foot mont"><span>${N} DATAVIZ CAVEATS</span><span>www.data-to-viz.com · ${p}</span></div>`;

  const cover = `<section class="navy">
    <div class="cover-text">
      <div class="kicker mont">A COLLECTION OF FLASHCARDS BY DATA TO VIZ</div>
      <h1 class="mont">${N} DATAVIZ<br>CAVEATS</h1>
      <p>The most common charting mistakes, each one next to a better alternative and a short explanation.</p>
      <div class="author mont">YAN HOLTZ · WWW.DATA-TO-VIZ.COM</div>
    </div>
    <div class="cover-fan">${fan(470, [[60, 40, -6], [250, 190, 4], [40, 360, 3], [230, 520, -4]])}</div>
  </section>`;

  const checklist = `<section class="paper">
    <h2 class="mont">THE CHECKLIST</h2>
    <p class="lead">Run through it before you publish a chart. Page numbers point to the card.</p>
    <div class="cols">${sections.filter((s) => s.cards.length).map((s) => `<div class="group">
      <h3 class="mont">${s.name.toUpperCase()}</h3>
      ${s.cards.map((c) => `<div class="item"><span class="box"></span><span class="t">${c.title}</span><span class="pg">${pageOf(c)}</span></div>`).join("")}
    </div>`).join("")}</div>
    ${footer(2)}
  </section>`;

  const cardPages = Array.from({ length: PAGES }, (_, p) => `<section class="paper">
    <div class="row">${cards.slice(p * 3, p * 3 + 3).map((c) => `<figure>
      <figcaption class="mont"><b>${String(c.n).padStart(2, "0")}</b>${c.section.toUpperCase()}</figcaption>
      <img src="${img(c, "vert")}">
    </figure>`).join("")}</div>
    ${footer(firstCardPage + p)}
  </section>`).join("");

  const closing = `<section class="navy">
    <div class="cover-text">
      <div class="kicker mont">WANT MORE?</div>
      <h1 class="mont small">KEEP THESE<br>CLOSE BY</h1>
      <p>Pin them next to your screen, share them with your team, and find hundreds of chart examples with their code at <b>www.data-to-viz.com</b>.</p>
      <div class="author mont">FEEL FREE TO SHARE THIS PDF</div>
    </div>
    <div class="cover-fan">${fan(470, [[60, 40, 5], [250, 190, -3], [40, 360, -4], [230, 520, 3]])}</div>
  </section>`;

  const css = `@page{size:297mm 210mm;margin:0}
  section{width:297mm;height:210mm;position:relative;overflow:hidden;page-break-after:always}
  .navy{${navyBg};color:#fff;display:flex;align-items:center}
  .cover-text{width:52%;padding-left:22mm}
  .kicker{font-size:10.5pt;letter-spacing:2.5px;color:${MINT}}
  h1{font-weight:500;font-size:54pt;letter-spacing:5px;line-height:1.08;margin:7mm 0}
  h1.small{font-size:44pt}
  .cover-text p{font-size:14pt;line-height:1.6;color:#D9D8EC;max-width:125mm}
  .author{margin-top:14mm;font-size:9.5pt;letter-spacing:2px;color:#A9A7CF}
  .cover-fan{position:relative;width:48%;height:100%}
  .paper{background:#fff;padding:13mm 15mm 0}
  h2{font-weight:500;font-size:20pt;letter-spacing:3px;margin:0;color:#212121}
  .lead{margin:2mm 0 6mm;font-size:10.5pt;color:#666}
  .cols{column-count:3;column-gap:10mm}
  .group{break-inside:avoid;margin-bottom:4.8mm}
  h3{font-weight:600;font-size:8.6pt;letter-spacing:1.6px;color:${TEAL};margin:0 0 2mm}
  .item{display:flex;align-items:center;font-size:9.4pt;line-height:1;padding:1.2mm 0;border-bottom:0.2mm solid #EEE}
  .box{width:3.3mm;height:3.3mm;border:0.3mm solid #999;border-radius:0.5mm;margin-right:2.2mm;flex:none}
  .t{flex:1}.pg{color:#999;font-size:8.6pt}
  .row{display:flex;justify-content:space-between;align-items:flex-start;padding:0 5mm}
  figure{margin:0;width:83mm}
  figcaption{font-size:7.4pt;letter-spacing:1.5px;color:${TEAL};margin-bottom:2.2mm;font-weight:600}
  figcaption b{color:#BBB;margin-right:2.5mm;font-weight:500}
  figure img{width:83mm;height:166mm;display:block;box-shadow:0 0.6mm 2.5mm rgba(0,0,0,.18)}
  .foot{position:absolute;left:15mm;right:15mm;bottom:7mm;display:flex;justify-content:space-between;font-size:7pt;letter-spacing:1.5px;color:#AAA}`;
  fs.writeFileSync(`${OUT}/pdf.html`, page(css, cover + checklist + cardPages + closing));
}

// ---------- collages: white, portrait, all cards, in three layouts ----------
// Every layout returns tiles as [card, orientation, x, y, width, height] inside a CW-wide content area.
const CW = 3824, GAP = 28, PAD = 90, TOP = 330;
const RATIO = { horiz: 1600 / 2560, vert: 2 };
// Cards plus navy "data-to-viz.com" tiles filling the slots a layout has left over.
const withBrand = (slots, layout) => {
  if (N > slots) throw new Error(`${layout} layout has ${slots} slots for ${N} cards: give it more`);
  return [...cards, ...Array.from({ length: slots - N }, () => ({ brand: true }))];
};
function collage(name, tiles) {
  const W = CW + 2 * PAD, H = Math.ceil(TOP + PAD + Math.max(...tiles.map((t) => t[3] + t[5])));
  const box = (x, y, w, h) => `position:absolute;left:${PAD + x}px;top:${TOP + y}px;width:${w}px;height:${h}px;border-radius:8px;box-shadow:0 4px 18px rgba(0,0,0,.13)`;
  const imgs = tiles.map(([c, v, x, y, w, h]) => c.brand
    ? `<div class="mont" style="${box(x, y, w, h)};${navyBg};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:${w / 21}px;letter-spacing:${w / 300}px;line-height:1.7;white-space:nowrap"><span style="color:${MINT}">MORE AT</span>WWW.DATA-TO-VIZ.COM</div>`
    : `<img src="${img(c, v)}" style="${box(x, y, w, h)}">`).join("");
  const css = `html,body{width:${W}px;height:${H}px;overflow:hidden}body{background:#fff;position:relative}
  .head{position:absolute;left:${PAD}px;right:${PAD}px;top:100px;display:flex;justify-content:space-between;align-items:flex-end;color:${NAVY}}
  .head h1{margin:0;font-weight:500;font-size:116px;letter-spacing:12px;line-height:1}
  .head div{font-size:34px;letter-spacing:5px;color:${TEAL};text-align:right;line-height:1.6}`;
  fs.writeFileSync(`${OUT}/${name}.html`, page(css, `<div class="head mont"><h1>${N} DATAVIZ CAVEATS</h1><div>FLASHCARDS BY DATA TO VIZ<br>WWW.DATA-TO-VIZ.COM</div></div>${imgs}`));
  fs.writeFileSync(`${OUT}/${name}.size`, `${W},${H}`);
}

// Regular grid of the vertical cards.
{
  const cols = 8, rows = Math.ceil(N / cols), w = (CW - (cols - 1) * GAP) / cols, h = w * RATIO.vert;
  collage("collage", withBrand(cols * rows, "grid").map((c, i) => [c, "vert", (i % cols) * (w + GAP), Math.floor(i / cols) * (h + GAP), w, h]));
}

// "Lego" grid: rows of blocks, each row scaled to fill the full width exactly.
// B = one big horizontal card, V = one vertical card, HH = two horizontal cards stacked.
{
  const ROWS = ["B HH HH HH V HH", "HH V B V HH HH", "V HH HH V HH V HH", "HH B V B HH V", "V HH V HH B HH", "HH V HH B HH V"];
  const slots = ROWS.join(" ").split(" ").reduce((n, m) => n + (m === "HH" ? 2 : 1), 0);
  const tiles = [], queue = withBrand(slots, "lego");
  let y = 0;
  for (const row of ROWS.map((r) => r.split(" "))) {
    const count = (k) => row.filter((m) => m === k).length;
    // Block widths for a row of height h: B = 1.6h, V = h/2, HH = 1.6(h - GAP)/2. Solve for the h that fills CW.
    const h = (CW - (row.length - 1) * GAP + 0.8 * GAP * count("HH")) / (1.6 * count("B") + 0.5 * count("V") + 0.8 * count("HH"));
    let x = 0;
    for (const m of row) {
      if (m === "B") { tiles.push([queue.shift(), "horiz", x, y, 1.6 * h, h]); x += 1.6 * h; }
      if (m === "V") { tiles.push([queue.shift(), "vert", x, y, h / 2, h]); x += h / 2; }
      if (m === "HH") {
        const hh = (h - GAP) / 2;
        tiles.push([queue.shift(), "horiz", x, y, 1.6 * hh, hh], [queue.shift(), "horiz", x, y + hh + GAP, 1.6 * hh, hh]);
        x += 1.6 * hh;
      }
      x += GAP;
    }
    y += h + GAP;
  }
  collage("collage-lego", tiles);
}

// Masonry: equal-width columns mixing both orientations. A vertical card is about as tall as three
// horizontal ones, so columns with 0 V + 12 H, 1 V + 9 H or 2 V + 6 H end up nearly level; gaps absorb the rest.
{
  const PLAN = [[1, 9], [2, 6], [0, 12], [2, 6], [1, 9], [2, 6]]; // [vertical, horizontal] cards per column
  const cols = PLAN.length, w = (CW - (cols - 1) * GAP) / cols, queue = withBrand(PLAN.flat().reduce((a, b) => a + b), "masonry");
  const columns = PLAN.map(([nv, nh], ci) => {
    // Spread the vertical cards along the column, shifted from one column to the next.
    const n = nv + nh, slots = Array.from({ length: nv }, (_, k) => Math.floor(((k + 0.5) * n) / nv + (ci % 3) - 1));
    return Array.from({ length: n }, (_, i) => (slots.includes(i) ? "vert" : "horiz"));
  });
  const heightOf = (col) => col.reduce((sum, v) => sum + w * RATIO[v], 0);
  const tallest = Math.max(...columns.map((col) => heightOf(col) + (col.length - 1) * GAP));
  const tiles = [];
  columns.forEach((col, ci) => {
    const gap = (tallest - heightOf(col)) / (col.length - 1);
    let y = 0;
    for (const v of col) { tiles.push([queue.shift(), v, ci * (w + GAP), y, w, w * RATIO[v]]); y += w * RATIO[v] + gap; }
  });
  collage("collage-masonry", tiles);
}

// ---------- email banner: 1200x630, also fine as a social preview image ----------
{
  const css = `html,body{width:1200px;height:630px;overflow:hidden}body{${navyBg};position:relative;color:#fff}
  .txt{position:absolute;left:70px;top:0;bottom:0;width:520px;display:flex;flex-direction:column;justify-content:center}
  .kicker{font-size:15px;letter-spacing:3px;color:${MINT}}
  h1{font-weight:500;font-size:68px;letter-spacing:6px;line-height:1.08;margin:22px 0}
  p{font-size:21px;line-height:1.55;color:#D9D8EC;margin:0}
  .free{margin-top:30px;align-self:flex-start;background:${TEAL};font-size:15px;letter-spacing:2.5px;padding:12px 22px;border-radius:6px}`;
  const body = `<div class="txt"><div class="kicker mont">FLASHCARDS BY DATA TO VIZ</div>
    <h1 class="mont">${N} DATAVIZ<br>CAVEATS</h1>
    <p>Common charting mistakes, each next to a better alternative.</p>
    <div class="free mont">FREE PDF</div></div>
    ${fan(440, [[650, 40, -6], [760, 175, 4], [640, 320, 3], [740, 420, -4]])}`;
  fs.writeFileSync(`${OUT}/banner.html`, page(css, body));
}
console.log(`built lead magnet pages for ${N} cards`);
