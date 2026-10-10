// Expert mode: name the animal in the photo by typing it, with no
// answer options. The hard part is reading what was typed — this file
// turns free text into a species, or into the helping hand's one best
// guess when it's close but not exact ("jejle" → Hjejle). The help is
// kept soft on purpose: one guess at most, and a name that fits several
// species ("mus", "kobbersneppe") just asks for more precision rather
// than listing them all, which would give the answer away.
import { ALL_SPECIES } from "../data/groups.js";

// Fixed run length for now, so runs are comparable while it's tested.
export const EXPERT_ROUNDS = 10;

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

// How many typos `a` is from `b` — as typed, or once both are loosened,
// whichever is fewer — or null if that's more than `a` may have.
function typos(a, b) {
  const distance = Math.min(editDistance(a, b), editDistance(loosen(a), loosen(b)));
  return distance <= tolerance(a.length) ? distance : null;
}

// Every name a species answers to, normalized once up front: Danish
// (what's shown, plus any aliases like Krondyr), then English and Latin.
// `danish` counts how many of the names come first and are Danish.
const NAMES = ALL_SPECIES.map((species) => {
  const danish = [species.name_da, ...(species.aliases ?? [])];
  return {
    species,
    danish: danish.length,
    names: [...danish, species.name_en, species.latin].filter(Boolean).map(normalize),
  };
});

// Whether `query` is a precise part of a Danish name: one of its words
// ("kobbersneppe" in Stor kobbersneppe) or the tail of a compound word
// ("ræv" in Rødræv).
function isPart(query, name) {
  const q = squash(query);
  return name.split(" ").some((w) => w === query || (q.length >= 3 && w.endsWith(q)));
}

// How far `query` is from a name, as a typo — lower is better, null if
// too far. A slip in the whole name beats a slip in one of its words,
// which beats a slip in the tail of a compound word ("snepe" →
// skovsneppe). Compound tails are a Danish thing, so English and Latin
// names skip them.
function typoScore(query, name, compound) {
  const q = squash(query);
  const whole = typos(q, squash(name));
  if (whole !== null) return whole;
  const words = name.split(" ");
  const word = Math.min(...words.map((w) => typos(query, w) ?? Infinity));
  if (word < Infinity) return 10 + word;
  if (compound && q.length >= 5 && words.some((w) => w.length > q.length && editDistance(q, w.slice(-q.length)) <= 1)) {
    return 20;
  }
  return null;
}

// Reads a typed answer. Returns one of:
//   { kind: "empty" }               nothing to go on yet
//   { kind: "exact", species }      counts as the answer
//   { kind: "suggest", species }    close — the helping hand's guess
//   { kind: "vague" }               fits several species equally well
//   { kind: "unknown" }             no species by that name
export function readAnswer(text) {
  const query = normalize(text);
  if (squash(query).length < 2) return { kind: "empty" };

  const exact = NAMES.find(({ names }) => names.some((n) => squash(n) === squash(query)));
  if (exact) return { kind: "exact", species: exact.species };

  // A precise part of a name first: one fit is a guess, several is vague.
  const parts = NAMES.filter(({ names, danish }) =>
    names.some((n, i) => (i < danish ? isPart(query, n) : n.split(" ").includes(query)))
  );
  if (parts.length > 1) return { kind: "vague" };
  if (parts.length === 1) return { kind: "suggest", species: parts[0].species };

  // Otherwise the closest typo, if any is close enough — and vague if
  // two species are equally close.
  const scored = NAMES.map(({ species, names, danish }) => ({
    species,
    score: Math.min(...names.map((n, i) => typoScore(query, n, i < danish) ?? Infinity)),
  })).filter((m) => m.score < Infinity);
  if (scored.length === 0) return { kind: "unknown" };
  const top = Math.min(...scored.map((m) => m.score));
  const best = scored.filter((m) => m.score === top);
  return best.length > 1 ? { kind: "vague" } : { kind: "suggest", species: best[0].species };
}
