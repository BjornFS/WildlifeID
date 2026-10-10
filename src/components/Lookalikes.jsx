import { ALL_SPECIES } from "../data/groups.js";
import { thumb } from "../lib/asset.js";

// Lookup for resolving `confusedWith` ids into species — ids are
// unique across every group, so one combined map is safe.
const SPECIES_BY_ID = new Map(ALL_SPECIES.map((s) => [s.id, s]));

// "Forveksles med" row inside the Kendetegn overlay: the species this
// one is most easily mixed up with, as small photo + name chips.
// Renders nothing when a species has no lookalikes.
export default function Lookalikes({ species }) {
  const lookalikes = (species.confusedWith ?? []).map((id) => SPECIES_BY_ID.get(id)).filter(Boolean);
  if (lookalikes.length === 0) return null;

  return (
    <div className="lookalikes">
      <p className="lookalikes-title">Forveksles med</p>
      <ul className="lookalikes-list">
        {lookalikes.map((s) => (
          <li key={s.id} className="lookalike-chip">
            {s.images[0] && <img src={thumb(s.images[0])} alt="" className="lookalike-thumb" />}
            <span>{s.name_da}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
