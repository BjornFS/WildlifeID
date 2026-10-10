import BIOMES from "../data/biomes.js";

// Shared display bits for a species' FAKTA fields (see species.js), used
// by the quiz's StatsBox and the field guide's animal card alike.

export const ACTIVITY_ICON = { day: "☀️", night: "🌙", both: "🌗" };
export const ACTIVITY_LABEL = { day: "Dag", night: "Nat", both: "Dag & nat" };

// One muted colour per rarity tier (1 = common, 5 = rare). Deliberately
// calm, not a red-alert kind of red — a species being rare in Denmark
// isn't a crisis (see: sika deer), just a fact worth flagging gently.
export const RARITY_COLOR = ["#5b8ec4", "#8ba36b", "#c7a23f", "#c98a4b", "#bd6456"];

export const RARITY_LABEL = ["Meget almindelig", "Almindelig", "Middel", "Fåtallig", "Sjælden"];

export const biomeOf = (species) => BIOMES.find((b) => b.id === species.habitat);

export function RarityDots({ rarity }) {
  return (
    <span className="rarity-dots" title="Hvor almindelig i Danmark">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="rarity-dot" style={{ background: n <= rarity ? RARITY_COLOR[rarity - 1] : undefined }} />
      ))}
    </span>
  );
}
