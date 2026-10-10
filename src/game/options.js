import { ALL_SPECIES } from "../data/groups.js";

// Small randomness + answer-option helpers for building quiz rounds
// (rounds.js), so "how a wrong answer gets picked" lives in one place.

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// "Bound pairs" — lookalike species that must always appear together
// as answer options, so the quiz forces you to actually tell them
// apart instead of guessing from the category alone. Whenever the
// answer is one of these, its whole group is included in the options.
const BOUND_GROUPS = [
  ["baever", "bisamrotte", "sumpbaever"], // beaver / muskrat / coypu
  ["hare", "kanin"], // hare / rabbit
  ["markmus", "mosegris", "skovmus", "rotte"], // voles, mouse & rat
];

function boundGroupFor(speciesId) {
  return BOUND_GROUPS.find((group) => group.includes(speciesId));
}

// Builds the answer-option grid for a given answer species: locked to
// its category, with its bound-pair group (if any) and its own
// `confusedWith` lookalikes always forced in alongside it. The grid is
// still topped up to 4 with random species from the category, so a
// lookalike pair shows up as 2 of 4 options rather than a bare 50/50.
// Lookalikes from another category are skipped (options never leave
// the category), and if more than 4 are forced, the answer is kept and
// a random subset of the rest fills the remaining slots. Shared by
// every mode. Always searches the full combined species list (not just
// whichever group is currently being played) — safe because category
// ids never overlap between groups, so a mammal category can never
// accidentally pull in a bird option.
export function buildOptionsFor(answer) {
  const sameCategory = ALL_SPECIES.filter((s) => s.category === answer.category);
  const optionCount = Math.min(4, sameCategory.length);

  const forcedIds = new Set([...(boundGroupFor(answer.id) ?? []), ...(answer.confusedWith ?? [])]);
  const forcedOthers = shuffle(sameCategory.filter((s) => s !== answer && forcedIds.has(s.id)));
  const forced = [answer, ...forcedOthers].slice(0, optionCount);
  const filler = shuffle(sameCategory.filter((s) => !forced.includes(s)));
  return shuffle([...forced, ...filler.slice(0, optionCount - forced.length)]);
}
