import { ALL_SPECIES } from "../data/groups.js";

// Endless mode asks every species exactly once, so a run that never
// misses "clears" it after this many answers.
export const ENDLESS_TOTAL = ALL_SPECIES.length;

// Endless mode's highscore, kept in localStorage — there's no backend
// to persist a real file to, so this is the practical stand-in: it
// survives app restarts on this device, same as a saved file would.
const HIGHSCORE_KEY = "wildlifeid-endless-highscore";

export function getHighscore() {
  const raw = localStorage.getItem(HIGHSCORE_KEY);
  const n = raw === null ? 0 : parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export function setHighscore(value) {
  localStorage.setItem(HIGHSCORE_KEY, String(value));
}
