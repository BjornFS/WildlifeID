// Builds docs/banner.svg — the README header — from the same pixel
// landscape the site uses (see src/lib/natureScene.js), with the title on
// top. Re-run after changing the scene:
//
//   node scripts/make-banner.mjs

import { writeFile, mkdir } from "node:fs/promises";
import { natureSceneSvg } from "../src/lib/natureScene.js";

const W = 1280;
const H = 540;
// The landscape fills the lower part, leaving open sky for the title.
const SCENE_TOP = 150;
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// The site paints the sky as a CSS gradient behind the scene, so the
// banner needs its own copy of it.
const scene = natureSceneSvg().replace("<svg ", `<svg x="0" y="${SCENE_TOP}" width="${W}" height="${H - SCENE_TOP}" `);

const title = (dx, fill, opacity = 1) =>
  `<text x="${W / 2 + dx}" y="112" text-anchor="middle" font-family="${MONO}" font-size="72" font-weight="700" letter-spacing="20" fill="${fill}" fill-opacity="${opacity}">WILDLIFE·ID</text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#a9cfe0"/><stop offset="0.4" stop-color="#cfe3e2"/><stop offset="0.62" stop-color="#f1ead0"/>
</linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
${scene}
${title(-5, "#e66e5a", 0.45)}
${title(5, "#4696d2", 0.45)}
${title(0, "#1f3a2a")}
<text x="${W / 2}" y="160" text-anchor="middle" font-family="${MONO}" font-size="20" font-weight="700" letter-spacing="10" fill="#2f4a38">DET VILDE DANMARK</text>
</svg>
`;

await mkdir("docs", { recursive: true });
await writeFile("docs/banner.svg", svg);
console.log(`docs/banner.svg  ${Math.round(svg.length / 1024)} KB`);
