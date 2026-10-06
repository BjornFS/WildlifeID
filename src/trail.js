import { ALL_SPECIES } from "./groups.js";
import { buildOptionsFor, pickRandom, shuffle } from "./options.js";

// Vildtsporet — the adventure path. The player walks a fixed trail of
// steps ("nodes") through six biome chapters, easiest first. Each
// chapter's species are simply every species whose `habitat` is one
// of the chapter's biomes (see biomes.js), so new species slot into
// the right chapter automatically — only the hand-written node lists
// below decide *when* they're introduced.
//
// Node types:
//   meet       introduces 1–4 new species (intro card each), then a
//              short quiz on just those, with easy wrong answers
//   practice   mixed review of the chapter so far, plus a couple of
//              species from earlier chapters
//   lookalike  head-to-head rounds where the only options are the
//              lookalike species themselves
//   chest      a breather mid-chapter — no quiz
//   test       chapter exam (Feltprøve); needs PASS_RATE to unlock
//              the next chapter
//
// Progress is keyed by node id (`<region>-<index>`), so reordering an
// existing chapter's node list will shift saved progress within it.

// Vildtsporet is switched off for players for now: no menu entry, no
// nav chip, and openTrail does nothing. Everything else stays in place
// — flip this to true to bring it back.
export const TRAIL_ENABLED = false;

export const PASS_RATE = 0.8;

const SPECIES_BY_ID = new Map(ALL_SPECIES.map((s) => [s.id, s]));

// `pal` drives every colour on the trail for that chapter: bg (ground),
// n/nd (node face + its 3D underside), ink2 (chapter text), d1–d3 and
// trunk (scenery). `deco` is the scenery rotation (see trailScenery.js)
// and `feat` places a featured species' photo beside node <index> —
// shown as a dark silhouette until that species has been met.
export const TRAIL_REGIONS = [
  {
    id: "byen",
    name: "Byen",
    sub: "Haver, parker og byområder",
    habitats: ["beboelse"],
    pal: {
      bg: "#ebe5dc",
      n: "#c06a3b",
      nd: "#94502a",
      ink2: "#7d5a44",
      d1: "#d9cbbb",
      d2: "#c79a80",
      d3: "#b8c49b",
      trunk: "#8a6a4f",
    },
    deco: ["house", "bush", "house2", "bush"],
    feat: { pindsvin: 0, vaskebjoern: 1, husmaar: 4 },
    nodes: [
      { t: "meet", s: ["pindsvin", "rotte", "husskade"] },
      { t: "meet", s: ["tyrkerdue", "allike", "vaskebjoern"] },
      { t: "practice" },
      { t: "chest" },
      { t: "meet", s: ["husmaar"] },
      { t: "test" },
    ],
  },
  {
    id: "marken",
    name: "Marken",
    sub: "Markarealer og levende hegn",
    habitats: ["landbrugsland"],
    pal: {
      bg: "#f0e8c8",
      n: "#c4961b",
      nd: "#94700f",
      ink2: "#86702c",
      d1: "#e2c66a",
      d2: "#c9a64b",
      d3: "#a9b86a",
      trunk: "#8a6a4f",
    },
    deco: ["wheat", "bale", "bush", "wheat"],
    feat: { raev: 0, stork: 3, laekat: 6 },
    nodes: [
      { t: "meet", s: ["raev", "hare", "kanin"] },
      { t: "meet", s: ["fasan", "krage", "raage"] },
      { t: "lookalike", s: ["hare", "kanin"] },
      { t: "meet", s: ["stork", "musvaage", "vibe"] },
      { t: "chest" },
      { t: "meet", s: ["graagaas", "bramgaas", "blisgaas", "hjejle"] },
      { t: "meet", s: ["laekat", "brud", "markmus", "muldvarp"] },
      { t: "meet", s: ["agerhoene", "stormmaage", "kortnaebbetgaas", "saedgaas"] },
      { t: "lookalike", s: ["brud", "laekat"] },
      { t: "test" },
    ],
  },
  {
    id: "skoven",
    name: "Skoven",
    sub: "Løvskov og nåleskov",
    habitats: ["loevskov", "naaleskov"],
    pal: {
      bg: "#d7e6ca",
      n: "#4f8a3f",
      nd: "#386530",
      ink2: "#4d6b40",
      d1: "#86b36b",
      d2: "#3f6f45",
      d3: "#a8cc8c",
      trunk: "#7a5a3c",
    },
    deco: ["tree", "pine", "tree", "bush", "pine"],
    feat: { egern: 0, vildsvin: 1, kronhjort: 2, ulv: 5, skovmaar: 6, kongeoern: 8 },
    nodes: [
      { t: "meet", s: ["egern", "raadyr", "ringdue"] },
      { t: "meet", s: ["vildsvin", "graevling", "skovskade"] },
      { t: "meet", s: ["kronhjort", "daadyr", "sika"] },
      { t: "lookalike", s: ["raadyr", "daadyr", "sika"] },
      { t: "chest" },
      { t: "meet", s: ["ulv", "muflon", "huldue"] },
      { t: "meet", s: ["skovmaar", "skovmus", "ravn", "skovsneppe"] },
      { t: "lookalike", s: ["husmaar", "skovmaar"] },
      { t: "meet", s: ["kongeoern", "spurvehoeg", "duehoeg"] },
      { t: "lookalike", s: ["duehoeg", "spurvehoeg"] },
      { t: "practice" },
      { t: "test" },
    ],
  },
  {
    id: "soeen",
    name: "Søen",
    sub: "Søer og vandløb",
    habitats: ["soeer"],
    pal: {
      bg: "#d3e7ee",
      n: "#2f7fb5",
      nd: "#215d87",
      ink2: "#3c6a85",
      d1: "#a5cfe1",
      d2: "#6f9ab0",
      d3: "#86ad62",
      trunk: "#8b6a45",
    },
    deco: ["water", "reeds", "lily", "reeds"],
    feat: { graaand: 0, odder: 2, fiskeoern: 6 },
    nodes: [
      { t: "meet", s: ["graaand", "knopsvane", "blishoene"] },
      { t: "meet", s: ["fiskehejre", "haettemaage", "canadagaas"] },
      { t: "meet", s: ["odder", "mink", "ilder"] },
      { t: "lookalike", s: ["ilder", "mink"] },
      { t: "chest" },
      { t: "meet", s: ["troldand", "taffeland", "hvinand", "knarand"] },
      { t: "meet", s: ["fiskeoern", "sangsvane", "sortsvane", "nilgaas"] },
      { t: "meet", s: ["bisamrotte", "sumpbaever", "mosegris"] },
      { t: "lookalike", s: ["bisamrotte", "sumpbaever"] },
      { t: "meet", s: ["storskallesluger", "lilleskallesluger", "roedhovedetand", "amerikanskskarveand"] },
      { t: "test" },
    ],
  },
  {
    id: "mosen",
    name: "Mosen",
    sub: "Moser, enge og vådområder",
    habitats: ["vaadomrader"],
    pal: {
      bg: "#e0e5cc",
      n: "#7b8a32",
      nd: "#5b6724",
      ink2: "#66703a",
      d1: "#b9d3cb",
      d2: "#9aa35a",
      d3: "#8aa152",
      trunk: "#7a5232",
    },
    deco: ["reeds", "tussock", "reeds", "lily"],
    feat: { baever: 0, roerhoeg: 1, roedben: 2 },
    nodes: [
      { t: "meet", s: ["baever", "skeand", "krikand"] },
      { t: "meet", s: ["roerhoeg", "maarhund", "groenbenetroerhoene"] },
      { t: "meet", s: ["roedben", "atlingand", "brushane"] },
      { t: "chest" },
      { t: "meet", s: ["hvidklirre", "sortklirre"] },
      { t: "lookalike", s: ["hvidklirre", "sortklirre"] },
      { t: "meet", s: ["enkeltbekkasin", "dobbeltbekkasin", "storkobbersneppe"] },
      { t: "lookalike", s: ["enkeltbekkasin", "dobbeltbekkasin"] },
      { t: "test" },
    ],
  },
  {
    id: "kysten",
    name: "Kysten",
    sub: "Kystvand og Vadehavet",
    habitats: ["kystvand", "vadehavet"],
    pal: {
      bg: "#f2e9d4",
      n: "#1f6f8b",
      nd: "#16526a",
      ink2: "#4d6f78",
      d1: "#a3d0dc",
      d2: "#e4cf9e",
      d3: "#a7b56a",
      trunk: "#8b6a45",
    },
    deco: ["waves", "dune", "shell", "dune"],
    feat: { strandskade: 0, graasael: 1, gravand: 3, storregnspove: 8 },
    nodes: [
      { t: "meet", s: ["strandskade", "soelvmaage", "ederfugl"] },
      { t: "meet", s: ["graasael", "spaettetsael", "skarv"] },
      { t: "lookalike", s: ["graasael", "spaettetsael"] },
      { t: "meet", s: ["gravand", "pibeand", "spidsand", "knortegaas"] },
      { t: "chest" },
      { t: "meet", s: ["svartbag", "sildemaage", "vandrefalk", "havlit"] },
      { t: "lookalike", s: ["soelvmaage", "stormmaage", "sildemaage"] },
      { t: "meet", s: ["sortand", "floejlsand", "bjergand", "toppetskallesluger"] },
      { t: "meet", s: ["storregnspove", "lilleregnspove", "lillekobbersneppe", "islandskryle"] },
      { t: "lookalike", s: ["lilleregnspove", "storregnspove"] },
      { t: "test" },
    ],
  },
  // A locked preview of the second, harder lap — not playable yet.
  {
    id: "skoven2",
    name: "Skoven II",
    sub: "Samme skov, sværere spørgsmål",
    habitats: [],
    teaser: true,
    pal: {
      bg: "#e3e5df",
      n: "#4f8a3f",
      nd: "#386530",
      ink2: "#6d7468",
      d1: "#b9c1b0",
      d2: "#8d978a",
      d3: "#c7cec0",
      trunk: "#8d8a80",
    },
    deco: ["pine", "tree", "pine"],
    feat: {},
    nodes: [{ t: "meet", s: [] }, { t: "lookalike", s: [] }, { t: "test" }],
  },
];

// Flat list of every node in trail order, each knowing its region,
// index within it (`i`) and position along the whole trail (`g`).
export const TRAIL_NODES = [];
TRAIL_REGIONS.forEach((region, ri) => {
  region.index = ri;
  region.species = ALL_SPECIES.filter((s) => region.habitats.includes(s.habitat)).map((s) => s.id);
  region.nodes.forEach((node, i) => {
    node.id = `${region.id}-${i}`;
    node.region = region;
    node.i = i;
    node.g = TRAIL_NODES.length;
    TRAIL_NODES.push(node);
  });
});
const PLAYABLE_NODES = TRAIL_NODES.filter((n) => !n.region.teaser);

export const NODE_LABEL = {
  meet: "Mød arterne",
  practice: "Øvelse",
  lookalike: "Forveksling",
  chest: "Kiste",
  test: "Feltprøve",
};

export function speciesById(id) {
  return SPECIES_BY_ID.get(id);
}

// ---------- Progress ----------
// { done: { [nodeId]: stars (1–3) } } in localStorage — same "no
// backend yet" stand-in as the endless highscore and daily results.
const PROGRESS_KEY = "wildlifeid-trail-progress";

export function getTrailProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    if (parsed && typeof parsed.done === "object") return parsed;
  } catch {
    // fall through to a fresh start
  }
  return { done: {} };
}

function saveTrailProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

// Records a finished node, keeping the best star count if it's a replay.
export function saveNodeResult(nodeId, stars) {
  const progress = getTrailProgress();
  progress.done[nodeId] = Math.max(progress.done[nodeId] ?? 0, stars);
  saveTrailProgress(progress);
  return progress;
}

export function resetTrailProgress() {
  saveTrailProgress({ done: {} });
  return { done: {} };
}

export function isNodeDone(progress, node) {
  return node.id in progress.done;
}

// The first unfinished node — the one the trail's "START" bubble sits
// on. null once the whole playable trail is done.
export function currentNode(progress) {
  return PLAYABLE_NODES.find((n) => !isNodeDone(progress, n)) ?? null;
}

// A species counts as learned once the "meet" node introducing it is done.
export function learnedSpecies(progress) {
  const learned = new Set();
  for (const node of PLAYABLE_NODES) {
    if (node.t === "meet" && isNodeDone(progress, node)) node.s.forEach((id) => learned.add(id));
  }
  return learned;
}

export function isRegionUnlocked(progress, region) {
  if (region.teaser) return false;
  const cur = currentNode(progress);
  return !cur || region.nodes[0].g <= cur.g;
}

// Short summary for the menu's "continue" line.
export function trailSummary(progress) {
  const cur = currentNode(progress);
  return {
    region: cur ? cur.region : null,
    learned: learnedSpecies(progress).size,
    total: TRAIL_REGIONS.reduce((sum, r) => sum + r.species.length, 0),
  };
}

export function starsFor(correct, total) {
  if (total === 0 || correct === total) return 3;
  return correct / total >= PASS_RATE ? 2 : 1;
}

// ---------- Building a lesson ----------

// One photo per question, never repeating a photo within the lesson
// while the species still has unused ones.
function photoPicker() {
  const used = new Set();
  return (species) => {
    if (species.images.length === 0) return null;
    const fresh = species.images.filter((img) => !used.has(img));
    const image = pickRandom(fresh.length > 0 ? fresh : species.images);
    used.add(image);
    return image;
  };
}

// Easy wrong answers for a "meet" node: deliberately from *other*
// categories (a deer next to a duck), preferring species the player
// has already seen so the names aren't all unfamiliar.
function easyOptions(answer, familiarIds) {
  const otherCategory = (s) => s.category !== answer.category && s.id !== answer.id;
  const familiar = shuffle([...familiarIds].map(speciesById).filter((s) => s && otherCategory(s)));
  const rest = shuffle(ALL_SPECIES.filter((s) => otherCategory(s) && !familiar.includes(s)));
  return shuffle([answer, ...[...familiar, ...rest].slice(0, 3)]);
}

// Turns a node into the ordered list of steps the quiz screen plays:
// { kind: "intro", answer, image } or { kind: "question", answer, image, options }.
export function buildTrailSteps(node, progress) {
  const region = node.region;
  const learned = learnedSpecies(progress);
  const photo = photoPicker();
  const question = (species, options) => ({ kind: "question", answer: species, image: photo(species), options });

  if (node.t === "meet") {
    const species = node.s.map(speciesById);
    const familiar = new Set([...learned, ...node.s]);
    const intros = species.map((s) => ({ kind: "intro", answer: s, image: photo(s) }));
    // Every new species is asked twice, in two separate shuffled passes,
    // so a 3-species node is a 6-question quiz rather than a 3-question one.
    const asked = [...shuffle(species), ...shuffle(species)].map((s) => question(s, easyOptions(s, familiar)));
    return [...intros, ...asked];
  }

  if (node.t === "lookalike") {
    const species = node.s.map(speciesById);
    return Array.from({ length: 6 }, () => {
      const answer = pickRandom(species);
      return question(answer, shuffle(species));
    });
  }

  const regionLearned = region.species.filter((id) => learned.has(id)).map(speciesById);

  if (node.t === "practice") {
    const earlier = [...learned].filter((id) => !region.species.includes(id)).map(speciesById);
    const pool = [...shuffle(regionLearned).slice(0, 4), ...shuffle(earlier).slice(0, 2)];
    return shuffle(pool).map((s) => question(s, buildOptionsFor(s)));
  }

  if (node.t === "test") {
    return shuffle(regionLearned)
      .slice(0, 8)
      .map((s) => question(s, buildOptionsFor(s)));
  }

  return [];
}
