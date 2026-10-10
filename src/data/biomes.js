// A fixed, standardized set of biomes for the FAKTA box's habitat line.
// Kept deliberately small and shared across future groups (birds, etc.)
// rather than free-text per species, so the icon always means the same
// thing everywhere. Every species' `habitat` field must be one of these
// ids. "vadehavet" has no mammal using it yet — it's here for birds.
const BIOMES = [
  { id: "kystvand", name_da: "Kystvand", emoji: "🌊" },
  { id: "vaadomrader", name_da: "Vådområder", emoji: "💧" },
  { id: "vadehavet", name_da: "Vadehavet", emoji: "🐚" },
  { id: "loevskov", name_da: "Løvskov", emoji: "🌿" },
  { id: "naaleskov", name_da: "Nåleskov", emoji: "🌲" },
  { id: "landbrugsland", name_da: "Markarealer", emoji: "🌾" },
  { id: "soeer", name_da: "Søer og vandløb", emoji: "🌊" },
  { id: "beboelse", name_da: "byområder", emoji: "🏘️" },
];

export default BIOMES;
