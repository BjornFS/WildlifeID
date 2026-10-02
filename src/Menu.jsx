import { useEffect } from "react";
import { getTrailProgress, trailSummary } from "./trail.js";

export default function Menu({ onOpenTrail, onStartEndless, onOpenDaily }) {
  // Re-read on every visit to the menu, so the "continue" line always
  // reflects the step just finished on the trail.
  const trail = trailSummary(getTrailProgress());

  // Keys 1–3 pick a mode, matching the number badges on desktop.
  useEffect(() => {
    const actions = { 1: onOpenTrail, 2: onStartEndless, 3: onOpenDaily };
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      actions[e.key]?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenTrail, onStartEndless, onOpenDaily]);

  return (
    <div className="card menu-card">
      <div className="menu-body">
        <div className="menu-brand">
          <span className="menu-icon">🐾</span>
          <h1 className="menu-title">WildlifeID</h1>
          <p className="menu-subtitle">Det Vilde Danmark</p>
        </div>

        <div className="menu-groups">
          <button className="menu-option menu-option-trail" onClick={onOpenTrail}>
            <span className="menu-key">1</span>
            <span className="menu-option-icon">🥾</span>
            <span className="menu-option-text">
              <span className="menu-option-name">Vildtsporet</span>
              <span className="menu-option-sub">
                {trail.region
                  ? `Kapitel ${trail.region.index + 1} · ${trail.region.name} · ${trail.learned}/${trail.total} arter`
                  : "Hele sporet er gennemført"}
              </span>
            </span>
          </button>

          <button className="menu-option" onClick={onStartEndless}>
            <span className="menu-key">2</span>
            <span className="menu-option-icon">♾️</span>
            <span className="menu-option-text">
              <span className="menu-option-name">Endless mode</span>
              <span className="menu-option-sub">Endeløs sjov</span>
            </span>
          </button>

          <button className="menu-option" onClick={onOpenDaily}>
            <span className="menu-key">3</span>
            <span className="menu-option-icon">🗓️</span>
            <span className="menu-option-text">
              <span className="menu-option-name">Daglig udfordring</span>
              <span className="menu-option-sub">Nye spørgsmål hver dag</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
