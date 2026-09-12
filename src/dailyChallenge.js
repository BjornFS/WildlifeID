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
