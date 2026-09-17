import { ALL_SPECIES } from "./groups.js";

export const DAILY_ROUNDS = 10;
// Earliest month the calendar lets you navigate to.
export const DAILY_START_DATE = "2026-01-01";

const DAILY_RESULTS_KEY = "wildlifeid-daily-results";

export function todayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Turns a date string into a stable 32-bit seed, so the same date
// always hashes to the same number for anyone, anywhere.
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

// mulberry32 — a small, deterministic PRNG. Given the same seed it
// always produces the same sequence, which is exactly what a
// same-for-everyone daily challenge needs (unlike Math.random).
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(array, seed) {
  const rng = mulberry32(seed);
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The 10 species for a given day's challenge — deterministic from the
// date alone, so it's identical for every player and every replay.
// Which photo represents each species, and what order they're asked
// in, is intentionally NOT part of this seed — those are randomized
// fresh each time the challenge is played (see App.jsx).
export function speciesForDate(dateStr) {
  return seededShuffle(ALL_SPECIES, hashString(dateStr)).slice(0, DAILY_ROUNDS);
}

export function getDailyResults() {
  try {
    const raw = localStorage.getItem(DAILY_RESULTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveDailyResult(dateStr, result) {
  const results = getDailyResults();
  results[dateStr] = result;
  localStorage.setItem(DAILY_RESULTS_KEY, JSON.stringify(results));
}

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, delta) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + delta);
  return formatDate(date);
}

// Searches outward from `fromDateStr` one day at a time (forward
// before backward on a tie), staying within the calendar's valid
// range (DAILY_START_DATE through today), for the closest date
// matching `predicate`. Shared by findNextDailyDate's two search
// tiers below — same "closest in either direction" logic either way,
// just a different definition of "still worth playing".
function nearestDateMatching(fromDateStr, predicate) {
  const today = todayDateString();
  const isValid = (d) => d >= DAILY_START_DATE && d <= today;

  for (let radius = 1; radius <= 3660; radius++) {
    const forward = addDays(fromDateStr, radius);
    if (isValid(forward) && predicate(forward)) return forward;
    const backward = addDays(fromDateStr, -radius);
    if (isValid(backward) && predicate(backward)) return backward;
    if (forward > today && backward < DAILY_START_DATE) break;
  }
  return null;
}

// What "Næste" uses after finishing a daily challenge, so continuing
// is frictionless — no manual trip back to the calendar, and no risk
// of skipping past (or blindly replaying) a day that still needs
// attention. Three tiers, each only consulted if the one before it
// finds nothing anywhere in the whole valid range:
//   1. The closest date you haven't played at all yet.
//   2. Failing that (you've at least attempted every day), the
//      closest date you didn't get a perfect score on — worth another
//      go.
//   3. Failing that too, every single day has a perfect score: there
//      is genuinely nothing left to hand back, so this returns null
//      and the caller sends the player to the calendar instead.
export function findNextDailyDate(fromDateStr) {
  const results = getDailyResults();

  const unplayed = nearestDateMatching(fromDateStr, (d) => !results[d]);
  if (unplayed) return unplayed;

  const imperfect = nearestDateMatching(fromDateStr, (d) => {
    const r = results[d];
    return Boolean(r) && r.total > 0 && r.score < r.total;
  });
  if (imperfect) return imperfect;

  return null;
}
