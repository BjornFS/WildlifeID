import { useEffect, useLayoutEffect, useRef, useState } from "react";
import GROUPS, { ALL_SPECIES } from "./groups.js";
import { thumb } from "./asset.js";
import { ACTIVITY_ICON, ACTIVITY_LABEL, RARITY_LABEL, RarityDots, biomeOf } from "./facts.jsx";
import "./FieldGuide.css";

const SPECIES_BY_ID = new Map(ALL_SPECIES.map((s) => [s.id, s]));
const CATEGORY_BY_ID = new Map(GROUPS.flatMap((g) => g.categories.map((c) => [c.id, c])));

// Feltguiden — every species in the game, mammals then birds, grouped by
// the same categories the quiz uses. Each category has a play button
// for a short practice run on just that group, and every species opens
// an animal card with its photos and FAKTA. Opened with
// `focusCategoryId` (e.g. from the result pop-up's tip), it scrolls
// straight to that category and flashes it.
export default function FieldGuide({ focusCategoryId, onPlayCategory }) {
  const scrollRef = useRef(null);
  const [detail, setDetail] = useState(null);

  useLayoutEffect(() => {
    if (!focusCategoryId) return;
    const section = scrollRef.current.querySelector(`[data-category="${focusCategoryId}"]`);
    if (section) scrollRef.current.scrollTop = section.offsetTop - scrollRef.current.offsetTop - 12;
  }, [focusCategoryId]);

  return (
    <div className="card fg-screen">
      <header className="fg-header">
        <p className="fg-eyebrow">Feltguide</p>
        <span className="fg-count">{ALL_SPECIES.length} arter</span>
      </header>

      <div className="fg-scroll" ref={scrollRef}>
        {GROUPS.map((group) => (
          <section key={group.id} className="fg-group">
            <h2 className="fg-group-title">
              <span aria-hidden="true">{group.emoji}</span> {group.name_da}
            </h2>

            {group.categories.map((category) => {
              const species = group.species.filter((s) => s.category === category.id);
              if (species.length === 0) return null;
              return (
                <div
                  key={category.id}
                  data-category={category.id}
                  className={`fg-category ${category.id === focusCategoryId ? "is-focus" : ""}`}
                >
                  <div className="fg-category-head">
                    <button
                      type="button"
                      className="fg-play"
                      onClick={() => onPlayCategory(category.id)}
                      aria-label={`Øv ${category.name_da}`}
                      title={`Øv ${category.name_da}`}
                    >
                      ▶
                    </button>
                    <span className="fg-category-name">{category.name_da}</span>
                    <span className="fg-category-count">{species.length}</span>
                  </div>

                  <div className="fg-grid">
                    {species.map((s) => (
                      <button key={s.id} type="button" className="fg-tile" onClick={() => setDetail(s)}>
                        <span
                          className="fg-tile-photo"
                          style={{ backgroundImage: s.images[0] ? `url(${thumb(s.images[0])})` : undefined }}
                        />
                        <span className="fg-tile-name">{s.name_da}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>

      {detail && (
        <AnimalCard
          key={detail.id}
          species={detail}
          onOpen={setDetail}
          onClose={() => setDetail(null)}
          onPlay={() => onPlayCategory(detail.category)}
        />
      )}
    </div>
  );
}

// The enlarged "animal card": every photo of the species, its FAKTA,
// the kendetegn line and its lookalikes — each lookalike opens its own
// card in place, so you can flick between two easily confused species.
function AnimalCard({ species, onOpen, onClose, onPlay }) {
  const [photo, setPhoto] = useState(0);
  const images = species.images;
  const category = CATEGORY_BY_ID.get(species.category);
  const biome = biomeOf(species);
  const lookalikes = (species.confusedWith ?? []).map((id) => SPECIES_BY_ID.get(id)).filter(Boolean);
  const step = (dir) => setPhoto((i) => (i + dir + images.length) % images.length);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && images.length > 1) step(-1);
      else if (e.key === "ArrowRight" && images.length > 1) step(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="fg-overlay" onClick={onClose}>
      <article className="fg-card" onClick={(e) => e.stopPropagation()} aria-label={species.name_da}>
        <div className="fg-card-photo">
          {images.length > 0 ? (
            <>
              <div className="fg-card-backdrop" style={{ backgroundImage: `url("${images[photo]}")` }} />
              <img
                className="fg-card-img"
                src={images[photo]}
                alt={species.name_da}
                style={{ backgroundImage: `url("${thumb(images[photo])}")` }}
              />
            </>
          ) : (
            <span className="fg-card-nophoto">Foto mangler</span>
          )}
          <button type="button" className="fg-card-close" onClick={onClose} data-sound="home" aria-label="Luk">
            ✕
          </button>
          {images.length > 1 && (
            <>
              <button type="button" className="fg-card-arrow is-prev" onClick={() => step(-1)} aria-label="Forrige foto">
                ‹
              </button>
              <button type="button" className="fg-card-arrow is-next" onClick={() => step(1)} aria-label="Næste foto">
                ›
              </button>
              <span className="fg-card-dots" aria-hidden="true">
                {images.map((_, i) => (
                  <i key={i} className={i === photo ? "is-on" : ""} />
                ))}
              </span>
            </>
          )}
        </div>

        <div className="fg-card-body">
          <div className="fg-card-titles">
            <span className="fg-card-tag">{category?.name_da}</span>
            <h3 className="fg-card-name">{species.name_da}</h3>
            <p className="fg-card-sub">
              {species.name_en} · <i>{species.latin}</i>
            </p>
          </div>

          <dl className="fg-facts">
            <div>
              <dt>Vægt</dt>
              <dd>{species.weight}</dd>
            </div>
            <div>
              <dt>Levested</dt>
              <dd>
                {biome.emoji} {biome.name_da}
              </dd>
            </div>
            <div>
              <dt>Aktiv</dt>
              <dd>
                {ACTIVITY_ICON[species.activity]} {ACTIVITY_LABEL[species.activity]}
              </dd>
            </div>
            <div>
              <dt>Oprindelse</dt>
              <dd>{species.native ? "🏠 Tilhørende" : "👾 Invasiv"}</dd>
            </div>
            <div className="fg-facts-wide">
              <dt>Hyppighed</dt>
              <dd>
                <RarityDots rarity={species.rarity} /> {RARITY_LABEL[species.rarity - 1]}
              </dd>
            </div>
          </dl>

          <div className="fg-kendetegn">
            <p className="fg-label">🔍 Kendetegn</p>
            <p className="fg-kendetegn-text">{species.differentiator}</p>
          </div>

          {lookalikes.length > 0 && (
            <div className="fg-lookalikes">
              <p className="fg-label">Forveksles med</p>
              <div className="fg-lookalike-list">
                {lookalikes.map((s) => (
                  <button key={s.id} type="button" className="fg-lookalike" onClick={() => onOpen(s)}>
                    {s.images[0] && <img src={thumb(s.images[0])} alt="" />}
                    <span>{s.name_da}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="button" className="fg-card-play" onClick={onPlay}>
            ▶ Øv {category?.name_da.toLowerCase()}
          </button>
        </div>
      </article>
    </div>
  );
}
