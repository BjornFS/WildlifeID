// Expert mode: name the animal in the photo by typing it, with no
// answer options. The hard part is reading what was typed — this file
// turns free text into either a species, or a short list of "did you
// mean…?" suggestions (the helping hand) when it's close but not
// exact: a small typo ("jejle" → Hjejle) or not precise enough
// ("kobbersneppe" → Stor / Lille kobbersneppe).
//
// The suggestions are drawn from every species, not just the right
// answer, so they help with spelling without giving the answer away.
import { ALL_SPECIES } from "../data/groups.js";

// Fixed run length for now, so runs are comparable while it's tested.
export const EXPERT_ROUNDS = 10;

// At most this many suggestions are shown at once.
const MAX_SUGGESTIONS = 5;

// Lowercase, single-spaced, letters only — and æ/ø/å spelled out, so
// "raadyr" or "radyr" on a non-Danish keyboard still lands on Rådyr.
export function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFC")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

const squash = (text) => text.replace(/ /g, "");

// Edits needed to turn `a` into `b`: insert, delete, replace, or swap
// two neighbouring letters (the usual typing slip).
function editDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

// How many slips a word of this length may have and still count as
// "close" — none for very short words, where one edit is a different
// word entirely.
function tolerance(length) {
  if (length < 4) return 0;
  if (length <= 6) return 1;
  if (length <= 10) return 2;
  return 3;
}

// A looser spelling to compare on as well: doubled letters collapsed
// and sounds that are easy to mix up merged, so "kopper" and "kobber"
// are the same word here.
function loosen(text) {
  return text
    .replace(/b/g, "p")
    .replace(/d/g, "t")
    .replace(/g/g, "k")
    .replace(/c/g, "k")
    .replace(/w/g, "v")
    .replace(/z/g, "s")
    .replace(/(.)\1+/g, "$1");
}

// Whether `a` is within a typo or two of `b`, either as typed or once
// both are loosened.
function isClose(a, b) {
  const allowed = tolerance(a.length);
  return editDistance(a, b) <= allowed || editDistance(loosen(a), loosen(b)) <= allowed;
}

// Every name a species answers to, normalized once up front: Danish
// (what's shown, always first), English and Latin.
const NAMES = ALL_SPECIES.map((species) => ({
  species,
  names: [species.name_da, species.name_en, species.latin].filter(Boolean).map(normalize),
}));

// How well `query` fits one name — lower is better, null for no fit.
//   0  a typo of the whole name           "jejle"        → hjejle
//   1  exactly one word of it             "kobbersneppe" → stor kobbersneppe
//   2  the tail of a compound word        "måge"         → hættemåge
//   3  a typo of one word                 "koppersneppe" → stor kobbersneppe
//   4  a typo of a compound word's tail   "snepe"        → skovsneppe
// 0–2 are precise fits; 3–4 are only offered when there's nothing
// precise, so "måge" lists the gulls and not Musvåge too. Compound
// tails (2, 4) are a Danish thing, so English and Latin names skip them.
function fit(query, name, compound) {
  const q = squash(query);
  const words = name.split(" ");
  if (isClose(q, squash(name))) return 0;
  if (words.includes(query)) return 1;
  if (compound && q.length >= 3 && words.some((w) => w.endsWith(q))) return 2;
  if (words.some((w) => isClose(query, w))) return 3;
  if (compound && q.length >= 5 && words.some((w) => w.length > q.length && editDistance(q, w.slice(-q.length)) <= 1)) return 4;
  return null;
}
const PRECISE = 2;

// Reads a typed answer. Returns one of:
//   { kind: "empty" }                          nothing to go on yet
//   { kind: "exact", species }                 counts as the answer
//   { kind: "suggest", suggestions, more }     close — ask which one
//   { kind: "unknown" }                        no species by that name
export function readAnswer(text) {
  const query = normalize(text);
  if (squash(query).length < 2) return { kind: "empty" };

  const exact = NAMES.find(({ names }) => names.some((n) => squash(n) === squash(query)));
  if (exact) return { kind: "exact", species: exact.species };

  const matches = NAMES.map(({ species, names }) => {
    const fits = names.map((n, i) => fit(query, n, i === 0)).filter((f) => f !== null);
    return fits.length ? { species, rank: Math.min(...fits) } : null;
  })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank || a.species.name_da.localeCompare(b.species.name_da, "da"));

  if (matches.length === 0) return { kind: "unknown" };
  const shown = matches[0].rank <= PRECISE ? matches.filter((m) => m.rank <= PRECISE) : matches;
  return {
    kind: "suggest",
    suggestions: shown.slice(0, MAX_SUGGESTIONS).map((m) => m.species),
    more: shown.length > MAX_SUGGESTIONS,
  };
}
