// Bird groups, mirroring categories.js's role for the mammal species —
// every entry in birdSpecies.js belongs to one of these via its
// `category` field.
const BIRD_CATEGORIES = [
  { id: "duer", name_da: "Duer", name_en: "Pigeons & doves" },
  { id: "dykaender", name_da: "Dykænder", name_en: "Diving ducks" },
  { id: "fasanfugle", name_da: "Fasanfugle", name_en: "Gamebirds" },
  { id: "gaes", name_da: "Gæs", name_en: "Geese" },
  { id: "maager", name_da: "Måger", name_en: "Gulls" },
  { id: "rovfugle", name_da: "Rovfugle", name_en: "Birds of prey" },
  { id: "skalleslugere", name_da: "Skalleslugere", name_en: "Sawbills & cormorant" },
  { id: "spurvefugle", name_da: "Spurvefugle", name_en: "Crow family" },
  { id: "storke", name_da: "Storke", name_en: "Storks & herons" },
  { id: "svaner", name_da: "Svaner", name_en: "Swans" },
  { id: "svoemmeaender", name_da: "Svømmeænder", name_en: "Dabbling ducks" },
  { id: "vadefugle", name_da: "Vadefugle", name_en: "Waders" },
  { id: "vandhoens", name_da: "Vandhøns", name_en: "Rails & coots" },
];

export default BIRD_CATEGORIES;
