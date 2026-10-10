// The full-bleed pixel landscape behind the desktop layout — layered
// hills, forest, a lake with reeds and a meadow, with animal
// silhouettes tucked in at the sides (the middle is always covered by
// the quiz). A plain SVG string built from our own constants; built
// once on first use and cached, since it's a couple of thousand rects
// and never changes.

// Small deterministic PRNG (mulberry32) so the trees and reeds land in
// the same spots on every load instead of jumping around.
function seededRandom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 1440;
const H = 900;

// Each sprite is a tiny bitmap: "X" = one filled pixel.
const DEER = [
  ".X.X..............",
  ".X.X..............",
  "..XX..............",
  ".XXXX.............",
  "XXXXX.............",
  "..XXX.............",
  "...XXX............",
  "...XXXXXXXXXXXXX..",
  "...XXXXXXXXXXXXXX.",
  "....XXXXXXXXXXXXX.",
  "....XXXXXXXXXXXX..",
  "....XX.......XX...",
  "....X.X.....X.X...",
  "....X.X.....X.X...",
  "....X.X.....X..X..",
];
const HARE = [
  ".......X.X..",
  ".......X.X..",
  ".......X.X..",
  ".......XXX..",
  "......XXXXX.",
  ".....XXXXXXX",
  "..XXXXXXXXX.",
  ".XXXXXXXXX..",
  "XXXXXXXXXX..",
  "XXXXXXXXXX..",
  ".XXXXXXXXXX.",
  "..XX...XXXX.",
];
const FOX = [
  "...................X.X.",
  "...................XXX.",
  "..................XXXX.",
  "XX...XXXXXXXXXXXXXXXXXX",
  "XXX.XXXXXXXXXXXXXXXXX..",
  ".XXXXXXXXXXXXXXXXXX....",
  "..XXXXXXXXXXXXXXXX.....",
  "...XX.X.........X.X....",
  "....X.X.........X.X....",
  "....X.X.........X.X....",
];
const HERON = [
  "...XX.....",
  "..XXXX....",
  "XXXX.X....",
  ".....XX...",
  "......X...",
  ".....XX...",
  ".....XXX..",
  "....XXXXX.",
  "....XXXXXX",
  ".....XXXXX",
  "......XXX.",
  ".......X..",
  ".......X..",
  ".......X..",
  ".......X..",
  "......XX..",
];
const DUCK = ["..XX.......", ".XXXX......", "XXXX.......", "..XX.......", "..XXXXXXXX.", ".XXXXXXXXXX", "..XXXXXXXX."];
const BIRD = ["X.....X", ".X...X.", "..XXX.."];
const BOAR = [
  ".....XXXXXXXXX.....",
  "...XXXXXXXXXXXXX...",
  ".XXXXXXXXXXXXXXXXX.",
  "XXXXXXXXXXXXXXXXXXX",
  "X.XXXXXXXXXXXXXXXXX",
  "..XXXXXXXXXXXXXXXX.",
  "...XX.XX....XX.XX..",
  "...XX.XX....XX.XX..",
];

// A ridge is a stepped (pixelated) sine wave; `ridgeY` gives its height
// at any x, so trees and animals can stand exactly on top of it.
const ridgeY = (r, x, step = 12) => {
  const xs = Math.floor(x / step) * step;
  const y = r.base + r.amp * Math.sin(xs * r.freq + r.phase) + r.amp * 0.4 * Math.sin(xs * r.freq * 2.7 + r.phase * 1.3);
  return Math.round(y / step) * step;
};

const FAR = { base: 470, amp: 26, freq: 0.004, phase: 1.0 };
const FAR_FOREST = { base: 500, amp: 22, freq: 0.005, phase: 2.2 };
const MID = { base: 560, amp: 20, freq: 0.006, phase: 4.0 };
const MID_EDGE = { base: 600, amp: 16, freq: 0.007, phase: 0.6 };
const MEADOW = { base: 728, amp: 10, freq: 0.008, phase: 2.0 };
const FRONT = { base: 790, amp: 12, freq: 0.006, phase: 5.0 };

function build() {
  const rand = seededRandom(11);
  const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const out = [];

  const rect = (x, y, w, h, fill, opacity) =>
    out.push(
      `<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" fill="${fill}"${opacity ? ` opacity="${opacity}"` : ""}/>`
    );

  const ridge = (r, fill, step = 12) => {
    let d = `M0 ${H} `;
    let prev = null;
    for (let x = 0; x <= W + step; x += step) {
      const y = ridgeY(r, x, step);
      d += prev === null ? `L0 ${y} ` : `L${x} ${prev} L${x} ${y} `;
      prev = y;
    }
    out.push(`<path d="${d}L${W} ${H} Z" fill="${fill}"/>`);
  };

  const pine = (x, y, s, fill) => {
    for (let k = 0; k < 4; k++) {
      const w = s * (0.25 + 0.2 * k);
      rect(x - w / 2, y - s + k * s * 0.28, w, s * 0.28, fill);
    }
    rect(x - s * 0.06, y - s + 4 * s * 0.28, s * 0.12, s * 0.2, fill);
  };

  const oak = (x, y, r, fill, trunk, px = 6) => {
    rect(x - px / 2, y - r * 1.1, px, r * 1.1, trunk);
    const cy = y - r * 1.6;
    for (let gx = -r; gx <= r; gx += px) {
      for (let gy = -r; gy <= r; gy += px) {
        if (gx * gx + gy * gy * 1.3 < r * r * (0.75 + 0.25 * rand())) rect(x + gx, cy + gy, px, px, fill);
      }
    }
  };

  const sprite = (rows, x, y, px, fill, flip = false) =>
    rows.forEach((row, j) =>
      [...(flip ? [...row].reverse().join("") : row)].forEach((ch, i) => {
        if (ch === "X") rect(x + i * px, y + j * px, px, px, fill);
      })
    );

  // Sun and clouds
  out.push(
    `<defs><radialGradient id="nature-sun"><stop offset="0" stop-color="#fff6d8" stop-opacity=".9"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient></defs>`,
    `<circle cx="1200" cy="170" r="190" fill="url(#nature-sun)"/><circle cx="1200" cy="170" r="54" fill="#fff3c9"/>`
  );
  for (const [cx, cy, w] of [
    [140, 120, 220],
    [520, 70, 160],
    [960, 250, 190],
  ]) {
    rect(cx, cy, w, 12, "#ffffff", ".75");
    rect(cx + 24, cy - 12, w - 60, 12, "#ffffff", ".75");
    rect(cx + 48, cy - 24, w - 120, 12, "#ffffff", ".75");
  }
  for (const [bx, by] of [
    [300, 190],
    [330, 205],
    [360, 220],
    [270, 205],
    [240, 220],
    [390, 235],
  ])
    sprite(BIRD, bx, by, 3, "#4d5e62");
  sprite(BIRD, 1010, 330, 4, "#55666a");

  // Far hills and forest
  ridge(FAR, "#b9ccc2");
  for (let i = 0; i < 40; i++) {
    const x = int(0, W);
    pine(x, ridgeY(FAR_FOREST, x) + 10, int(30, 46), "#a3bcae");
  }
  ridge(FAR_FOREST, "#a3bcae");

  // Mid forest, with a deer at each edge
  ridge(MID, "#7fa184");
  for (let i = 0; i < 60; i++) {
    const x = int(0, W);
    oak(x, ridgeY(MID, x) + 6, int(22, 34), "#6e9473", "#5d7e60");
  }
  for (let i = 0; i < 34; i++) {
    const x = int(0, W);
    pine(x, ridgeY(MID, x) + 6, int(60, 84), "#5f8566");
  }
  sprite(DEER, 160, ridgeY(MID_EDGE, 160) - 15 * 5, 5, "#3f5c45");
  sprite(DEER, 1180, ridgeY(MID_EDGE, 1180) - 15 * 4 + 2, 4, "#46664c", true);
  ridge(MID_EDGE, "#5c8560");

  // Lake with ducks, reeds and a heron
  rect(0, 648, W, 84, "#a8cbc9");
  for (let i = 0; i < 40; i++) rect(int(0, W), Math.floor(int(656, 724) / 6) * 6, int(18, 60), 3, "#d3e7e2");
  sprite(DUCK, 300, 662, 5, "#2f4a3e");
  sprite(DUCK, 370, 676, 4, "#2f4a3e", true);
  sprite(DUCK, 1210, 670, 5, "#2f4a3e", true);
  for (let i = 0; i < 46; i++) {
    const x = int(0, 180);
    const h = int(30, 70);
    rect(x, 732 - h, 4, h, "#5e7d45");
    if (rand() < 0.4) rect(x - 1, 732 - h - 10, 6, 12, "#7a5a3a");
  }
  sprite(HERON, 96, 732 - 16 * 6, 6, "#30483b");
  for (let i = 0; i < 30; i++) {
    const h = int(26, 60);
    rect(int(1290, W), 732 - h, 4, h, "#5e7d45");
  }

  // Meadow and foreground, with a fox, a boar and a hare
  ridge(MEADOW, "#5f8a4c");
  for (let i = 0; i < 70; i++) {
    const x = int(0, W);
    rect(x, ridgeY(MEADOW, x) - 6, 4, 8, "#79a35c");
  }
  ridge(FRONT, "#3f6838");
  for (let i = 0; i < 90; i++) {
    const x = int(0, W);
    rect(x, ridgeY(FRONT, x) - 8, 4, 10, "#55823f");
  }
  sprite(FOX, 30, ridgeY(FRONT, 60) - 10 * 6 + 6, 6, "#22381f");
  sprite(BOAR, 1150, ridgeY(FRONT, 1160) - 8 * 6 + 6, 6, "#22381f");
  sprite(HARE, 1330, ridgeY(FRONT, 1320) - 12 * 6 + 6, 6, "#22381f", true);

  // xMidYMax slice: always fills the screen, anchored to the ground, so
  // other aspect ratios only crop sky or the far edges.
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges">${out.join("")}</svg>`;
}

let cached = null;
export function natureSceneSvg() {
  if (!cached) cached = build();
  return cached;
}
