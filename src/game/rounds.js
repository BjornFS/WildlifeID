// Building quiz rounds: which animal and photo comes next, and
// preloading the next photo so it appears instantly.
import { buildOptionsFor, pickRandom } from "./options.js";

// Picks one item at random, weighted by `weightFn`. Every item passed
// in must have weight > 0 — the caller is responsible for filtering
// out zero-weight items first (there's no "skip and retry" here).
function pickWeighted(items, weightFn) {
  const weights = items.map(weightFn);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1]; // float rounding safety net
}

// A species with no photos yet still needs a "slot" so it can't be
// asked twice with the same placeholder — it's identified by its id
// instead of an image path.
function slotKey(species, image) {
  return image ?? `species:${species.id}`;
}

// Marks a species as asked at all this run, whichever photo was shown
// — what `uniqueSpecies` checks in buildRound.
function seenKey(species) {
  return `seen:${species.id}`;
}

// How many photos of this species haven't been shown yet this run (a
// photo-less species just has one placeholder "slot" instead). This
// doubles as the species' selection weight — see buildRound.
function unusedImageCount(species, usedImages) {
  if (species.images.length === 0) {
    return usedImages.has(slotKey(species)) ? 0 : 1;
  }
  return species.images.filter((img) => !usedImages.has(img)).length;
}

// Picks the next question. `usedImages` is a Set of image paths (and
// no-photo species ids) already shown this run.
//
// Both the category and the species within it are picked weighted by
// remaining unused-image count, not uniformly. A category's weight is
// just the sum of its candidates' weights, so this collapses to "a
// species' chance is its own share of the whole remaining photo pool"
// — a species with 3 unused photos is 3x as likely as one with 1,
// regardless of how many other species share its category. Two nice
// side effects: species in tiny categories (fox, wild boar — 1 of only
// 2 in their group) stop being over-represented just because their
// category is small, and a species that was just asked has one fewer
// unused photo, so it's immediately less likely to come right back.
//
// `lastSpeciesId` (the previous round's answer) is additionally
// excluded outright whenever any other candidate exists, so the same
// species can never appear back-to-back — weighting alone only makes
// repeats rarer, not impossible.
//
// `uniqueSpecies` (endless mode) goes further: every species may only
// be asked once per run, whatever photos it has left, and each
// remaining species is equally likely.
//
// `allowExhaustedFallback` (default true) governs what happens once
// there's no legal non-repeat candidate left: a short practice run
// rarely reaches this, so it falls back to reusing the full species
// list as a safety net.
// Endless mode passes `false` instead, since for it this genuinely
// means "the run is over" — buildRound then returns null so the
// caller can end the game rather than silently reusing photos.
export function buildRound(
  speciesPool,
  categoryPool,
  usedImages,
  lastSpeciesId,
  { allowExhaustedFallback = true, uniqueSpecies = false } = {}
) {
  const candidates = speciesPool.filter((s) =>
    uniqueSpecies ? !usedImages.has(seenKey(s)) : unusedImageCount(s, usedImages) > 0
  );
  let pool = candidates.filter((s) => s.id !== lastSpeciesId);
  const exhausted = pool.length === 0;
  if (exhausted && !allowExhaustedFallback) return null;
  if (exhausted) pool = speciesPool;
  const weightOf = (s) =>
    uniqueSpecies ? 1 : exhausted ? Math.max(s.images.length, 1) : unusedImageCount(s, usedImages);

  const categoriesInPlay = categoryPool.filter((c) => pool.some((s) => s.category === c.id));
  const chosenCategory = pickWeighted(categoriesInPlay, (c) =>
    pool.filter((s) => s.category === c.id).reduce((sum, s) => sum + weightOf(s), 0)
  );
  const categoryCandidates = pool.filter((s) => s.category === chosenCategory.id);

  const answer = pickWeighted(categoryCandidates, weightOf);
  const unusedImages = answer.images.filter((img) => !usedImages.has(img));
  const image =
    answer.images.length > 0 ? pickRandom(unusedImages.length > 0 ? unusedImages : answer.images) : null;
  usedImages.add(slotKey(answer, image));
  usedImages.add(seenKey(answer));

  return { answer, image, options: buildOptionsFor(answer) };
}

// Builds one daily-challenge question for a given species. Unlike
// buildRound, the species itself is fixed (chosen by the day's seed
// before this runs) — only the photo is randomized here, freshly on
// every play, same as a normal round would pick among unused photos.
export function buildDailyRoundFor(species) {
  const image = species.images.length > 0 ? pickRandom(species.images) : null;
  return { answer: species, image, options: buildOptionsFor(species) };
}

// Starts downloading and decoding a photo before it's on screen, so
// the next round appears instantly instead of loading in. The Image is
// held onto until it's ready so it can't be garbage-collected mid-way.
const preloading = new Map();
export function preloadImage(src) {
  if (!src || preloading.has(src)) return;
  const img = new Image();
  img.src = src;
  preloading.set(src, img);
  img
    .decode()
    .catch(() => {})
    .finally(() => preloading.delete(src));
}
