import { useLayoutEffect, useRef, useState } from "react";
import { TRAIL_REGIONS, learnedSpecies, speciesById } from "./trail.js";
import { thumb } from "./asset.js";
import { difficultyOf } from "./points.js";

// Felthåndbogen — every species on Vildtsporet, grouped by chapter.
// Species you've met show their photo and name; the rest stay blurred
// as "???" until the trail introduces them. Opened from the chapter
// banner, scrolled straight to that chapter.
export default function FieldGuide({ progress, focusRegionId, onBack }) {
  const learned = learnedSpecies(progress);
  const scrollRef = useRef(null);
  const [detail, setDetail] = useState(null);
  const total = TRAIL_REGIONS.reduce((sum, r) => sum + r.species.length, 0);

  useLayoutEffect(() => {
    const section = scrollRef.current.querySelector(`[data-region="${focusRegionId}"]`);
    if (section) scrollRef.current.scrollTop = section.offsetTop - 8;
  }, [focusRegionId]);

  const detailRegion = detail && TRAIL_REGIONS.find((r) => r.species.includes(detail.id));

  return (
    <div className="guide">
      <header className="trail-topbar">
        <button type="button" className="trail-back" onClick={onBack} aria-label="Tilbage til sporet">
          ‹
        </button>
        <span className="trail-title">Felthåndbogen</span>
        <span className="trail-stat">
          🐾 {learned.size}/{total}
        </span>
      </header>

      <div className="guide-scroll" ref={scrollRef}>
        {TRAIL_REGIONS.filter((r) => !r.teaser).map((region) => {
          // Met species first (easiest first), then the unmet ones.
          const ids = [...region.species].sort(
            (a, b) => Number(learned.has(b)) - Number(learned.has(a)) || difficultyOf(a) - difficultyOf(b)
          );
          return (
            <section key={region.id} className="guide-section" data-region={region.id} style={{ "--n": region.pal.n }}>
              <div className="guide-section-head">
                <b>{region.name}</b>
                <span>
                  {region.species.filter((id) => learned.has(id)).length}/{region.species.length}
                </span>
              </div>
              <div className="guide-grid">
                {ids.map((id) => {
                  const sp = speciesById(id);
                  const known = learned.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`guide-card ${known ? "" : "is-locked"}`}
                      disabled={!known}
                      onClick={() => setDetail(sp)}
                    >
                      <div
                        className="guide-card-photo"
                        style={{ backgroundImage: sp.images[0] ? `url(${thumb(sp.images[0])})` : undefined }}
                      />
                      <span className="guide-card-name">{known ? sp.name_da : "???"}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className={`trail-scrim ${detail ? "is-open" : ""}`} onClick={() => setDetail(null)} />
      <div className={`trail-sheet ${detail ? "is-open" : ""}`} aria-hidden={!detail}>
        <div className="trail-grab" />
        {detail && (
          <div className="trail-sheet-body" style={{ "--n": detailRegion.pal.n, "--nd": detailRegion.pal.nd }}>
            <div
              className="guide-detail-photo"
              style={{ backgroundImage: detail.images[0] ? `url(${detail.images[0]})` : undefined }}
            />
            <h3 className="trail-sheet-title">{detail.name_da}</h3>
            <p className="guide-latin">{detail.latin}</p>
            <div className="guide-kendetegn">
              <b>Kendetegn</b>
              {detail.differentiator}
            </div>
            <div className="trail-levers">
              <span className="trail-lever">{detailRegion.name}</span>
              <span className="trail-lever">Sværhedsgrad {difficultyOf(detail.id)}/3</span>
              {(detail.confusedWith ?? []).length > 0 && (
                <span className="trail-lever">
                  Forveksles med {detail.confusedWith.map((id) => speciesById(id)?.name_da ?? id).join(", ")}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
