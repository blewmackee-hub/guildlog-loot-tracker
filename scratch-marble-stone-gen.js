// Procedurally generates a seamlessly-tiling texture of polished marble
// "rock" tiles: a jittered-grid Voronoi tiling (toroidal, so it tiles
// with no seams), where each cell gets a glossy brass/brown gradient
// fill, a soft specular highlight, and sparse purple/green marble
// veining confined to that cell - like slabs cut from one quarry.
const fs = require('fs');

const W = 640, H = 480;

// seeded PRNG (mulberry32) for reproducible output
let seed = 20260915;
function rand() {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// --- 1. seed points: jittered grid, tiled 3x3 (for toroidal neighbors) ---
const COLS = 11, ROWS = 8;
const cellW = W / COLS, cellH = H / ROWS;
const basePoints = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const jx = (rand() - 0.5) * cellW * 0.75;
    const jy = (rand() - 0.5) * cellH * 0.75;
    basePoints.push({ x: c * cellW + cellW / 2 + jx, y: r * cellH + cellH / 2 + jy });
  }
}

const OFFSETS = [];
for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) OFFSETS.push([dx, dy]);

// all points incl. ghosts, tagged with their base index
const allPoints = [];
basePoints.forEach((p, i) => {
  OFFSETS.forEach(([dx, dy]) => allPoints.push({ x: p.x + dx, y: p.y + dy, base: i }));
});

// --- 2. Sutherland-Hodgman clip of `poly` by half-plane containing `keep`,
//        bounded by the perpendicular bisector of (keep, other) ---
function clipByBisector(poly, keep, other) {
  const mx = (keep.x + other.x) / 2, my = (keep.y + other.y) / 2;
  const nx = other.x - keep.x, ny = other.y - keep.y; // normal pointing away from keep
  function side(p) { return (p.x - mx) * nx + (p.y - my) * ny; } // <0 means keep-side
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i], prev = poly[(i - 1 + poly.length) % poly.length];
    const curSide = side(cur), prevSide = side(prev);
    if (curSide < 0) {
      if (prevSide >= 0) {
        const t = prevSide / (prevSide - curSide);
        out.push({ x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) });
      }
      out.push(cur);
    } else if (prevSide < 0) {
      const t = prevSide / (prevSide - curSide);
      out.push({ x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) });
    }
  }
  return out;
}

function voronoiCell(site, candidates) {
  let poly = [
    { x: site.x - 400, y: site.y - 400 }, { x: site.x + 400, y: site.y - 400 },
    { x: site.x + 400, y: site.y + 400 }, { x: site.x - 400, y: site.y + 400 },
  ];
  // only clip against reasonably close candidates for speed + correctness
  const near = candidates
    .map((p) => ({ p, d2: (p.x - site.x) ** 2 + (p.y - site.y) ** 2 }))
    .filter((o) => o.d2 > 0.001 && o.d2 < 260 * 260)
    .sort((a, b) => a.d2 - b.d2)
    .slice(0, 24)
    .map((o) => o.p);
  for (const other of near) {
    poly = clipByBisector(poly, site, other);
    if (poly.length === 0) break;
  }
  return poly;
}

// --- 3. build each base cell's canonical polygon, then figure out which
//        of the 9 torus translations are needed to cover the viewBox ---
const BROWNS = ["#453b30", "#3f362b", "#4a3f33", "#423931", "#3c332a"];
const PURPLE = "#cdbdea", GREEN = "#a9d1b5";

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function polyBounds(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  return { minX, minY, maxX, maxY };
}
// Real cleaved/cut rock edges are never dead-straight. Bow each edge
// by a small, DETERMINISTIC amount derived from the edge's own
// (order-independent) endpoints, so the two neighboring cells that
// share an edge - each traversing it in opposite directions - still
// compute the identical curve and keep tiling with no gaps/overlaps.
const MAX_BOW = 3.6;
function edgeBow(p1, p2) {
  let a = p1, b = p2;
  if (a.x > b.x || (a.x === b.x && a.y > b.y)) { a = p2; b = p1; }
  const key = `${a.x.toFixed(1)},${a.y.toFixed(1)}|${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  const r1 = (h % 9973) / 9973;
  h = Math.imul(h ^ (h >>> 15), 0x2545f491) >>> 0;
  const r2 = (h % 9973) / 9973;

  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const bow = (r1 - 0.5) * 2 * MAX_BOW;
  const along = 0.35 + r2 * 0.3;
  return { x: a.x + dx * along + nx * bow, y: a.y + dy * along + ny * bow };
}
function pathFromPoly(poly, dx, dy) {
  let d = "";
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = edgeBow(a, b);
    if (i === 0) d += `M${(a.x + dx).toFixed(1)} ${(a.y + dy).toFixed(1)}`;
    d += `Q${(c.x + dx).toFixed(1)} ${(c.y + dy).toFixed(1)} ${(b.x + dx).toFixed(1)} ${(b.y + dy).toFixed(1)}`;
  }
  return d + "Z";
}

// Real grout/crevice lines aren't one uniform stroke - some stretches
// run deep and dark, others shallow and barely-there; width wanders
// too. Draw each edge of the cell as its own segment with its own
// randomized width + darkness instead of one constant stroke around
// the whole polygon.
function crackEdges(poly) {
  let out = "";
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = edgeBow(a, b);
    const darkW = (0.8 + rand() * 1.7).toFixed(2);
    const darkOp = (0.22 + rand() * 0.4).toFixed(2);
    const liteW = (0.5 + rand() * 0.9).toFixed(2);
    const liteOp = (0.03 + rand() * 0.09).toFixed(2);
    const d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)}Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    const dLite = `M${(a.x + 0.8).toFixed(1)} ${(a.y + 1).toFixed(1)}Q${(c.x + 0.8).toFixed(1)} ${(c.y + 1).toFixed(1)} ${(b.x + 0.8).toFixed(1)} ${(b.y + 1).toFixed(1)}`;
    out += `<path d="${d}" fill="none" stroke="rgba(0,0,0,${darkOp})" stroke-width="${darkW}" stroke-linecap="round"/>`;
    out += `<path d="${dLite}" fill="none" stroke="rgba(255,250,240,${liteOp})" stroke-width="${liteW}" stroke-linecap="round"/>`;
  }
  return out;
}

// --- each stone gets its OWN self-contained marbling, like a slice of
//     banded mineral rather than a vein that runs through a plain
//     rock. Built as a small library of "stone fill" patterns - each
//     its own tiny turbulence-warped band cluster over its own base
//     tone - so neighboring stones can look genuinely different (a
//     near-black slab next to a pale lavender one), the way cut
//     flagstone from one quarry still varies piece to piece. ---
function buildStonePattern(id, baseColor, bandColors, seedVal) {
  const tile = 150;
  let lines = "";
  const clusterCount = 3 + Math.floor(rand() * 2);
  for (let ci = 0; ci < clusterCount; ci++) {
    const baseY = rand() * tile;
    const strandCount = 3 + Math.floor(rand() * 3);
    for (let s = 0; s < strandCount; s++) {
      const yy = baseY + s * (2 + rand() * 2.4) - tile * 0.5;
      const color = bandColors[Math.floor(rand() * bandColors.length)];
      const width = (1.3 + rand() * 2.3).toFixed(2);
      const op = (0.4 + rand() * 0.42).toFixed(2);
      lines += `<line x1="${-tile}" y1="${yy.toFixed(1)}" x2="${tile * 2}" y2="${yy.toFixed(1)}" stroke="${color}" stroke-width="${width}" opacity="${op}"/>`;
    }
  }
  const filterId = `pf${id}`;
  const filter = `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${(0.011 + rand() * 0.009).toFixed(4)}" numOctaves="3" seed="${seedVal}" result="t"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="t" scale="${(26 + rand() * 20).toFixed(0)}" xChannelSelector="R" yChannelSelector="G"/>` +
    `</filter>`;
  const angle = Math.floor(rand() * 180);
  const pattern = `<pattern id="sp${id}" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">` +
    `<rect width="${tile}" height="${tile}" fill="${baseColor}"/>` +
    `<g filter="url(#${filterId})">${lines}</g>` +
    `</pattern>`;
  return filter + pattern;
}

const STONE_FAMILIES = [
  { base: ["#241a29", "#2e2032", "#34243a"], bands: ["#cdbdea", "#e8dced", "#8f78b8"] },
  { base: ["#463f52", "#524a60", "#3c3548"], bands: ["#cdbdea", "#a9d1b5"] },
  { base: ["#453b30", "#3f362b", "#423931"], bands: ["#f2d296", "#cdbdea"] },
  { base: ["#33402f", "#2c3a2a", "#3a4838"], bands: ["#a9d1b5", "#cfe6d4"] },
  { base: ["#5a4a30", "#4f4128", "#544326"], bands: ["#f2d296", "#a9d1b5"] },
];
// Brass/brown should stay the dominant quarry tone - purple/green/gray
// stones are accents scattered through it, not an even split.
const FAMILY_WEIGHTS = [1, 0.8, 5, 1.6, 3.6]; // purple, gray-lavender, brass, green, gold-brass
function pickFamily() {
  const total = FAMILY_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < STONE_FAMILIES.length; i++) {
    r -= FAMILY_WEIGHTS[i];
    if (r <= 0) return STONE_FAMILIES[i];
  }
  return STONE_FAMILIES[STONE_FAMILIES.length - 1];
}

const PATTERN_COUNT = 18;
let defs = `<filter id="aoBlur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter>` +
  `<filter id="grainF" x="0" y="0" width="100%" height="100%">` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="6" result="n"/>` +
  `<feColorMatrix in="n" type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1"/>` +
  `</filter>`;
const stonePatternIds = [];
for (let i = 0; i < PATTERN_COUNT; i++) {
  const fam = pickFamily();
  const base = fam.base[Math.floor(rand() * fam.base.length)];
  defs += buildStonePattern(i, base, fam.bands, 101 + i * 7);
  stonePatternIds.push(`sp${i}`);
}

let body = "";
let cellId = 0;

basePoints.forEach((site, i) => {
  const cell = voronoiCell(site, allPoints);
  if (cell.length < 3) return;
  const b = polyBounds(cell);
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const w = Math.max(8, b.maxX - b.minX), h = Math.max(8, b.maxY - b.minY);

  // Tight, low-contrast directional light on top of the stone's own
  // pattern - a subtle edge-catch, not a per-rock "spotlight" hotspot.
  const angle = (112 + (rand() - 0.5) * 30).toFixed(0);
  const gid = `g${cellId}`;
  defs += `<linearGradient id="${gid}" gradientTransform="rotate(${angle})">` +
    `<stop offset="0%" stop-color="#fff6df" stop-opacity=".2"/>` +
    `<stop offset="16%" stop-color="#fff6df" stop-opacity="0"/>` +
    `<stop offset="100%" stop-color="#000000" stop-opacity=".32"/>` +
    `</linearGradient>`;

  const clipId = `c${cellId}`;
  defs += `<clipPath id="${clipId}"><path d="${pathFromPoly(cell, 0, 0)}"/></clipPath>`;

  const patId = stonePatternIds[Math.floor(rand() * stonePatternIds.length)];
  const bounds = { minX: b.minX, minY: b.minY, w, h };
  const rectAttrs = `x="${(bounds.minX - 6).toFixed(1)}" y="${(bounds.minY - 6).toFixed(1)}" width="${(bounds.w + 12).toFixed(1)}" height="${(bounds.h + 12).toFixed(1)}"`;
  const fillRect = `<rect ${rectAttrs} fill="url(#${patId})"/>`;
  const lightRect = `<rect ${rectAttrs} fill="url(#${gid})"/>`;
  // Ambient occlusion: real gaps cast a soft shadow into the stone
  // beside them, not just a hairline at the seam. A wide blurred
  // stroke along the edge, clipped to the cell so only its inward
  // half survives, reads as that shadow gathering in the crevice.
  // Randomized per cell (rather than one flat value everywhere) so
  // some crevices read as noticeably deeper than others - real
  // flagstone doesn't sit perfectly flush all the way around every
  // piece.
  const aoWidth = (5.5 + rand() * 6.5).toFixed(1);
  const aoOpacity = (0.32 + rand() * 0.34).toFixed(2);
  const aoStroke = `<path d="${pathFromPoly(cell, 0, 0)}" fill="none" stroke="#000" stroke-width="${aoWidth}" opacity="${aoOpacity}" filter="url(#aoBlur)"/>`;

  // Shadow pools where several crevices meet a corner - deeper than
  // the even edge AO, and only at SOME of a cell's corners so the
  // effect reads as pooled shadow rather than a uniform dark outline.
  let cornerShadow = "";
  for (const p of cell) {
    if (rand() < 0.45) continue;
    const r = (7 + rand() * 7).toFixed(1);
    const op = (0.22 + rand() * 0.28).toFixed(2);
    cornerShadow += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="#000" opacity="${op}" filter="url(#aoBlur)"/>`;
  }

  const cellGroup = `<g clip-path="url(#${clipId})">${fillRect}${lightRect}${aoStroke}${cornerShadow}</g>` +
    crackEdges(cell);

  // figure out which torus translations of this cell are visible in [0,W]x[0,H]
  for (const [dx, dy] of OFFSETS) {
    const tb = { minX: b.minX + dx, maxX: b.maxX + dx, minY: b.minY + dy, maxY: b.maxY + dy };
    if (tb.maxX < -1 || tb.minX > W + 1 || tb.maxY < -1 || tb.minY > H + 1) continue;
    body += `<g transform="translate(${dx},${dy})">${cellGroup}</g>`;
  }
  cellId++;
});

const grainOverlay = `<rect width='${W}' height='${H}' filter="url(#grainF)" opacity=".07" style="mix-blend-mode:overlay"/>`;

const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>` +
  `<defs>${defs}</defs>` +
  `<rect width='${W}' height='${H}' fill='#1c1712'/>` +
  body +
  grainOverlay +
  `</svg>`;

fs.writeFileSync("public/marble-stone.svg", svg);
console.log("cells:", cellId, "bytes:", svg.length);
