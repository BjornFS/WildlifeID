// Animal groups. Every entry in species.js belongs to one of these via
// its `category` field. The scorecard reports progress per category
// (e.g. "Hundedyr 1/3") rather than per individual species, since
// grouping by family is more useful for learning than single species.
const CATEGORIES = [
  { id: "gnavere", name_da: "Gnavere", name_en: "Rodents" },
  { id: "maarvildt", name_da: "Mårvildt", name_en: "Mustelids" },
  { id: "hjortevildt", name_da: "Hjortevildt", name_en: "Deer" },
  { id: "saeler", name_da: "Sæler", name_en: "Seals" },
  { id: "hundedyr", name_da: "Hundedyr", name_en: "Canids" },
  { id: "andet", name_da: "Andet", name_en: "Other" },
];

export default CATEGORIES;
