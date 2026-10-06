import { useEffect, useLayoutEffect, useRef, useState } from "react";
import GROUPS, { ALL_SPECIES } from "./groups.js";
import { thumb } from "./asset.js";
import { ACTIVITY_ICON, ACTIVITY_LABEL, RARITY_LABEL, RarityDots, biomeOf } from "./facts.jsx";
import "./FieldGuide.css";

const SPECIES_BY_ID = new Map(ALL_SPECIES.map((s) => [s.id, s]));
const CATEGORY_BY_ID = new Map(GROUPS.flatMap((g) => g.categories.map((c) => [c.id, c])));
// Every species in the order the guide lists them — mammals then birds,
// category by category — which the animal card's arrows step through.
const GUIDE_ORDER = GROUPS.flatMap((g) => g.categories.flatMap((c) => g.species.filter((s) => s.category === c.id)));

// Each category in guide order, with its species — shared by the index
// and the main list so the two always agree.
const SECTIONS = GROUPS.map((group) => ({
  group,
  categories: group.categories
    .map((category) => ({ category, species: group.species.filter((s) => s.category === category.id) }))
    .filter((c) => c.species.length > 0),
}));

// How far `el` sits from the top of the scrolling container's content.
const offsetIn = (scroller, el) =>
  el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;

// Restarts a one-shot CSS highlight on `el`, even if it's still playing.
function flash(el) {
  el.classList.remove("is-flash");
  void el.offsetWidth;
  el.classList.add("is-flash");
}

// Feltguiden — every species in the game, mammals then birds, grouped by
// the same categories the quiz uses. Each category has a play button
// for a short practice run on just that group, and every species opens
// an animal card with its photo and FAKTA. The index on the left jumps
// to a category or species, and follows along as you scroll (on phones
// it's a row of category chips instead). Opened with `focusCategoryId`
// (e.g. from the result pop-up's tip), it scrolls straight to that
// category and flashes it.
export default function FieldGuide({ focusCategoryId, onPlayCategory }) {
  const scrollRef = useRef(null);
  const indexRef = useRef(null);
  const [detail, setDetail] = useState(null);
  const [active, setActive] = useState(focusCategoryId ?? SECTIONS[0].categories[0].category.id);

  useLayoutEffect(() => {
    if (!focusCategoryId) return;
    const section = scrollRef.current.querySelector(`[data-category="${focusCategoryId}"]`);
    if (section) scrollRef.current.scrollTop = offsetIn(scrollRef.current, section) - 12;
  }, [focusCategoryId]);

  // Scroll-spy: the active category is the last one whose top has
  // passed (near) the top of the list.
  const onScroll = () => {
    const scroller = scrollRef.current;
    let current = null;
    for (const el of scroller.querySelectorAll("[data-category]")) {
      if (offsetIn(scroller, el) - 40 <= scroller.scrollTop) current = el.dataset.category;
    }
    // At the very bottom, the last category wins even if it's short.
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
      current = [...scroller.querySelectorAll("[data-category]")].at(-1).dataset.category;
    }
    setActive(current ?? SECTIONS[0].categories[0].category.id);
  };

  // Keep the active index entry in view inside the index itself.
  useEffect(() => {
    const index = indexRef.current;
    const item = index?.querySelector(`[data-index="${active}"]`);
    if (!item) return;
    const box = index.getBoundingClientRect();
    const r = item.getBoundingClientRect();
    if (index.scrollWidth > index.clientWidth) {
      index.scrollTo({ left: index.scrollLeft + r.left - box.left - 16, behavior: "smooth" });
    } else if (r.top < box.top || r.bottom > box.bottom) {
      index.scrollTo({ top: index.scrollTop + r.top - box.top - 40, behavior: "smooth" });
    }
  }, [active]);

  const jumpTo = (selector, highlight) => {
    const scroller = scrollRef.current;
    const el = scroller.querySelector(selector);
    if (!el) return;
    scroller.scrollTo({ top: offsetIn(scroller, el) - 12, behavior: "smooth" });
    flash(highlight(el));
  };
  const jumpToCategory = (id) => jumpTo(`[data-category="${id}"]`, (el) => el);
  const jumpToSpecies = (id) => jumpTo(`[data-species="${id}"]`, (el) => el.querySelector(".fg-tile-photo"));

  return (
    <div className="card fg-screen">
      <header className="fg-header">
        <p className="fg-eyebrow">Feltguide</p>
        <span className="fg-count">{ALL_SPECIES.length} arter</span>
      </header>

      <div className="fg-body">
        <nav className="fg-index" ref={indexRef} aria-label="Indeks">
          {SECTIONS.map(({ group, categories }) => (
            <div key={group.id} className="fg-index-group">
              <p className="fg-index-group-title">
                <span aria-hidden="true">{group.emoji}</span> {group.name_da}
              </p>
              {categories.map(({ category, species }) => {
                const isActive = category.id === active;
                return (
                  <div key={category.id} className={`fg-index-cat ${isActive ? "is-active" : ""}`}>
                    <button
                      type="button"
                      data-index={category.id}
                      className="fg-index-cat-btn"
                      onClick={() => jumpToCategory(category.id)}
                    >
                      <span className="fg-index-cat-name">{category.name_da}</span>
                      <span className="fg-index-cat-count">{species.length}</span>
                    </button>
                    {isActive && (
                      <ul className="fg-index-species">
                        {species.map((s) => (
                          <li key={s.id}>
                            <button type="button" onClick={() => jumpToSpecies(s.id)}>
                              {s.name_da}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="fg-scroll" ref={scrollRef} onScroll={onScroll}>
          {SECTIONS.map(({ group, categories }) => (
            <section key={group.id} className="fg-group">
              <h2 className="fg-group-title">
                <span aria-hidden="true">{group.emoji}</span> {group.name_da}
              </h2>

              {categories.map(({ category, species }) => (
                <div
                  key={category.id}
                  data-category={category.id}
                  className={`fg-category ${category.id === focusCategoryId ? "is-flash" : ""}`}
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
                      <button
                        key={s.id}
                        type="button"
                        data-species={s.id}
                        className="fg-tile"
                        onClick={() => setDetail(s)}
                      >
                        <span
                          className="fg-tile-photo"
                          style={{ backgroundImage: s.images[0] ? `url(${thumb(s.images[0])})` : undefined }}
                        />
                        <span className="fg-tile-name">{s.name_da}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>

      {detail && (
        <AnimalCard
          species={detail}
          onOpen={setDetail}
          onClose={() => setDetail(null)}
          onPlay={() => onPlayCategory(detail.category)}
        />
      )}
    </div>
  );
}

// The enlarged "animal card": the species' first photo, its FAKTA, the
// kendetegn line and its lookalikes — each lookalike opens its own card
// in place, so you can flick between two easily confused species. Only
// ever the one photo: showing them all would let players memorise the
// quiz's pictures instead of the animals. The arrows step to the
// previous/next species in guide order.
function AnimalCard({ species, onOpen, onClose, onPlay }) {
  const photo = species.images[0];
  const category = CATEGORY_BY_ID.get(species.category);
  const biome = biomeOf(species);
  const lookalikes = (species.confusedWith ?? []).map((id) => SPECIES_BY_ID.get(id)).filter(Boolean);
  const index = GUIDE_ORDER.indexOf(species);
  const step = (dir) => onOpen(GUIDE_ORDER[(index + dir + GUIDE_ORDER.length) % GUIDE_ORDER.length]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="fg-overlay" onClick={onClose}>
      <article className="fg-card" onClick={(e) => e.stopPropagation()} aria-label={species.name_da}>
        <div className="fg-card-photo">
          {photo ? (
            <>
              <div className="fg-card-backdrop" style={{ backgroundImage: `url("${photo}")` }} />
              <img
                className="fg-card-img"
                src={photo}
                alt={species.name_da}
                style={{ backgroundImage: `url("${thumb(photo)}")` }}
              />
            </>
          ) : (
            <span className="fg-card-nophoto">Foto mangler</span>
          )}
          <button type="button" className="fg-card-close" onClick={onClose} data-sound="home" aria-label="Luk">
            ✕
          </button>
          <button type="button" className="fg-card-arrow is-prev" onClick={() => step(-1)} aria-label="Forrige art">
            ‹
          </button>
          <button type="button" className="fg-card-arrow is-next" onClick={() => step(1)} aria-label="Næste art">
            ›
          </button>
          <span className="fg-card-counter">
            {index + 1}/{GUIDE_ORDER.length}
          </span>
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
