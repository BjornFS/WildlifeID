// The player's points system — a single, persistent, cross-mode
// running total. This is deliberately separate from a single run's
// score (correct/total) and streak, which are just in-run stats: a
// species has a fixed *rarity* (see species.js) but its *difficulty*
// is a different, scoring-specific idea — how easy it is to mix up
// with something else — so it lives here instead of on the species
// data itself.
//
// This is meant to be the foundation for future, harder game modes:
// as more modes are added, they all just add to the same total via
// addRunPoints, and a later "difficulty progression" feature can key
// off getTotalPoints() to decide what a player is ready for.

// How hard each species is to tell apart from whatever it's most
// often confused with — 1 (easy) to 3 (hard). This drives how many
// points a correct identification is worth; a lucky guess on a
// genuinely tricky species is worth more than an easy give-away.
// Roughly targets 50% of all species at 1 point, 30% at 2, 20% at 3 —
// not exact, just the intended shape of the curve.
const DIFFICULTY = {
  // --- Pattedyr ---
  raadyr: 2,
  daadyr: 2,
  kronhjort: 1,
  sika: 3, // easily mixed up with dådyr
  ulv: 1,
  raev: 1,
  graevling: 1,
  ilder: 2, // confusable with mink
  brud: 3, // brud/lækat are the hardest mustelid pair
  laekat: 3,
  husmaar: 3, // husmår/skovmår — classic confusion pair
  skovmaar: 3,
  odder: 2,
  mink: 2,
  maarhund: 2,
  vaskebjoern: 1, // the ringed tail is a dead giveaway
  graasael: 2,
  spaettetsael: 2,
  kanin: 2, // kanin/hare — bound pair
  hare: 2,
  baever: 1, // its sheer size sets it apart
  bisamrotte: 3, // bisamrotte/sumpbæver — genuinely tricky
  sumpbaever: 3,
  egern: 1,
  markmus: 2, // small-rodent confusion cluster
  mosegris: 2,
  skovmus: 2,
  rotte: 1, // size alone sets it apart from the others
  muldvarp: 1,
  pindsvin: 1,
  vildsvin: 1, // nothing else looks like it
  muflon: 1,

  // --- Fugle ---
  huldue: 2,
  ringdue: 1,
  tyrkerdue: 1,
  amerikanskskarveand: 1,
  bjergand: 3, // confusable with troldand
  ederfugl: 1,
  floejlsand: 3, // confusable with sortand
  havlit: 1,
  hvinand: 1,
  roedhovedetand: 1,
  sortand: 3,
  taffeland: 2,
  troldand: 2,
  agerhoene: 2,
  fasan: 1,
  blisgaas: 2,
  bramgaas: 1,
  canadagaas: 1,
  graagaas: 1,
  knortegaas: 1,
  kortnaebbetgaas: 3, // confusable with sædgås
  nilgaas: 1,
  saedgaas: 3,
  haettemaage: 1,
  sildemaage: 3, // large dark-backed gull confusion
  soelvmaage: 1,
  stormmaage: 3, // "small lookalike of herring gull"
  svartbag: 1,
  duehoeg: 3, // duehøg/spurvehøg — classic accipiter pair
  fiskeoern: 1,
  kongeoern: 1,
  musvaage: 1,
  roerhoeg: 1,
  spurvehoeg: 3,
  vandrefalk: 1,
  lilleskallesluger: 1,
  skarv: 1,
  storskallesluger: 2,
  toppetskallesluger: 2,
  allike: 1,
  husskade: 1,
  krage: 1,
  raage: 2,
  ravn: 1,
  skovskade: 1,
  fiskehejre: 1,
  stork: 1,
  knopsvane: 1,
  sangsvane: 2,
  sortsvane: 1,
  atlingand: 2,
  graaand: 1,
  gravand: 1,
  knarand: 2,
  krikand: 1,
  pibeand: 1,
  skeand: 1,
  spidsand: 1,
  brushane: 2,
  dobbeltbekkasin: 3, // several easily-confused snipe/wader lookalikes
  enkeltbekkasin: 3,
  hjejle: 1,
  hvidklirre: 3, // Tringa waders are a notoriously hard group
  islandskryle: 2,
  lillekobbersneppe: 3, // confusable with stor kobbersneppe
  lilleregnspove: 3, // borderline impossible vs. stor regnspove at a glance
  roedben: 1,
  skovsneppe: 1,
  sortklirre: 3,
  storkobbersneppe: 3,
  storregnspove: 3,
  strandskade: 1,
  vibe: 1,
  blishoene: 1,
  groenbenetroerhoene: 2,
};

export function difficultyOf(speciesId) {
  return DIFFICULTY[speciesId] ?? 1;
}

// The same streak tiers already used to escalate the fire-streak icon
// during play (see streakIcon in App.jsx) — reused here rather than
// re-tuned separately, so a player's sense of "how good is my streak"
// stays consistent between what they see live and what it's worth
// afterward. Tier 0 = the base icon/no bonus; tier 3 = the best.
export function streakTier(streak) {
  if (streak >= 10) return 3;
  if (streak >= 5) return 2;
  if (streak >= 3) return 1;
  return 0;
}

const STREAK_MULTIPLIER = [0.8, 1, 1.2, 1.5];

function streakMultiplier(bestStreak) {
  return STREAK_MULTIPLIER[streakTier(bestStreak)];
}

// The full points formula for one finished run: the difficulty of
// every species you *correctly* identified, summed, then scaled by
// how good your best streak was this run. Rounded to a whole number —
// fractional points would be a meaningless thing to show a player.
// `answerLog` is the same {species, image, wasCorrect}[] list the
// result pop-up's katalog gallery already uses, so no separate
// tracking is needed just for scoring.
export function calculateRunPoints(answerLog, bestStreak) {
  const basePoints = answerLog
    .filter((entry) => entry.wasCorrect)
    .reduce((sum, entry) => sum + difficultyOf(entry.species.id), 0);
  return Math.round(basePoints * streakMultiplier(bestStreak));
}

// The player's all-time point total — persisted the same way as the
// endless highscore (no backend yet, so localStorage is the practical
// stand-in). This is the running "north star" number future, harder
// game modes will key off of.
const TOTAL_POINTS_KEY = "wildlifeid-total-points";

export function getTotalPoints() {
  const raw = localStorage.getItem(TOTAL_POINTS_KEY);
  const n = raw === null ? 0 : parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

// Adds one finished run's points to the running total and returns the
// new total. Call this exactly once per finished run, at the moment
// the result pop-up is shown.
export function addRunPoints(earnedPoints) {
  const next = getTotalPoints() + earnedPoints;
  localStorage.setItem(TOTAL_POINTS_KEY, String(next));
  return next;
}
