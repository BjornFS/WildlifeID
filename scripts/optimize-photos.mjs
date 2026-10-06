// Turns the original photos in photos/ into the web-sized copies the
// site actually serves, in public/images/ (same folder layout):
//
//   public/images/<path>.webp          quiz size, longest side 1600px
//   public/images/thumbs/<path>.webp   small tiles and chips, 360px
//
// The originals are often 5–10 MB camera files; these come out around
// 100–300 KB and 10–30 KB. Only new or changed photos are processed,
// so re-running after adding a photo is quick. Pass --force to redo
// everything (e.g. after changing the sizes below).
//
//   npm run photos

import { readdir, stat, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "photos";
const OUT = "public/images";
const SIZES = [
  { dir: "", px: 1600, quality: 78 },
  { dir: "thumbs", px: 360, quality: 72 },
];
const INPUT = /\.(jpe?g|png|webp|tiff?)$/i;
const force = process.argv.includes("--force");

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (INPUT.test(entry.name)) yield full;
  }
}

const mtime = (file) => stat(file).then((s) => s.mtimeMs, () => 0);
const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

let made = 0;
let skipped = 0;
let before = 0;
let after = 0;
const expected = new Set();

for await (const src of walk(SRC)) {
  const rel = path.relative(SRC, src).replace(INPUT, ".webp");
  const srcTime = await mtime(src);

  for (const { dir, px, quality } of SIZES) {
    const out = path.join(OUT, dir, rel);
    expected.add(out);
    if (!force && (await mtime(out)) >= srcTime) {
      skipped++;
      continue;
    }
    await mkdir(path.dirname(out), { recursive: true });
    // rotate() applies the camera's EXIF orientation before it's
    // stripped, so portrait shots don't come out sideways.
    const info = await sharp(src)
      .rotate()
      .resize(px, px, { fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toFile(out);
    if (!dir) {
      before += (await stat(src)).size;
      after += info.size;
      console.log(`${rel}  ${kb((await stat(src)).size)} -> ${kb(info.size)}`);
    }
    made++;
  }
}

// Drop web copies whose original has been deleted or renamed.
async function prune(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await prune(full);
    else if (entry.name.endsWith(".webp") && !expected.has(full)) {
      await unlink(full);
      console.log(`removed stale ${full}`);
    }
  }
}
await prune(OUT);

console.log(`\n${made} written, ${skipped} up to date.`);
if (before) console.log(`Quiz-size photos: ${kb(before)} -> ${kb(after)}`);
