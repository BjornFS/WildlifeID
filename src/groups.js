import SPECIES from "./species.js";
import CATEGORIES from "./categories.js";
import BIRD_SPECIES from "./birdSpecies.js";
import BIRD_CATEGORIES from "./birdCategories.js";

// Every playable group, each with its own species + category lists.
// Classic mode picks exactly one group to quiz on; endless mode and
// the daily challenge intentionally span every group combined (see
// ALL_SPECIES/ALL_CATEGORIES below) — that's why a new group just
// slots in here without either of those modes needing to change.
const GROUPS = [
  { id: "pattedyr", name_da: "Pattedyr", name_en: "Mammals", emoji: "🦌", species: SPECIES, categories: CATEGORIES },
  { id: "fugle", name_da: "Fugle", name_en: "Birds", emoji: "🐦", species: BIRD_SPECIES, categories: BIRD_CATEGORIES },
];

export const ALL_SPECIES = GROUPS.flatMap((g) => g.species);
export const ALL_CATEGORIES = GROUPS.flatMap((g) => g.categories);

export default GROUPS;
