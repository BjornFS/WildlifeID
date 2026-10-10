// Animal groups. Every entry in species.js belongs to one of these via
// its `category` field. Answer options are always drawn from the same
// category, and the field guide and result pop-up are organised by it.
const CATEGORIES = [
  { id: "gnavere", name_da: "Gnavere", name_en: "Rodents" },
  { id: "maarvildt", name_da: "Mårvildt", name_en: "Mustelids" },
  { id: "hjortevildt", name_da: "Hjortevildt", name_en: "Deer" },
  { id: "saeler", name_da: "Sæler", name_en: "Seals" },
  { id: "hundedyr", name_da: "Hundedyr", name_en: "Canids" },
  { id: "andet", name_da: "Andet", name_en: "Other" },
];

export default CATEGORIES;
