import { ACTIVITY_ICON, RarityDots, biomeOf } from "./facts.jsx";

// Small "did you know" box: weight, habitat, day/night activity, how
// common it is in Denmark (as a coloured dot count, top right), and
// whether it's native or introduced. Always mounted at a fixed size so
// it reserves its spot below the image from the very first render —
// `visible` just toggles opacity, so revealing it after answering
// never shifts anything below it.
export default function StatsBox({ species, visible }) {
  const biome = biomeOf(species);

  return (
    <div className={`stats-box ${visible ? "is-visible" : ""}`}>
      <div className="stats-title-row">
        <p className="stats-title">Fakta</p>
        <RarityDots rarity={species.rarity} />
      </div>
      <div className="stats-row">
        <span className="stats-weight">{species.weight}</span>
        <span className="stats-habitat">
          {biome.emoji} {biome.name_da}
        </span>
        <span className="stats-badge">Aktiv: {ACTIVITY_ICON[species.activity]}</span>
        <span className="stats-badge">{species.native ? "Tilhørende 🏠" : "Invasiv 👾"}</span>
      </div>
    </div>
  );
}
