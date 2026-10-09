import { useEffect } from "react";
import { TRAIL_ENABLED, getTrailProgress, trailSummary } from "./trail.js";
import { ALL_SPECIES } from "./groups.js";
import { ENDLESS_TOTAL, getHighscore } from "./endless.js";
import PixelNumber from "./PixelNumber.jsx";
import { getDailyResults, todayDateString } from "./dailyChallenge.js";
import DailyBanner from "./DailyBanner.jsx";

export default function Menu({ onOpenTrail, onStartEndless, onOpenDaily, onStartTodaysDaily, onOpenGuide }) {
  // Re-read on every visit to the menu, so the "continue" line always
  // reflects the step just finished on the trail.
  const trail = trailSummary(getTrailProgress());
  const highscore = getHighscore();
  // Today's challenge gets its own pixel banner until it's been played.
  const todayUnplayed = !getDailyResults()[todayDateString()];

  // Vildtsporet only appears while it's switched on (see TRAIL_ENABLED);
  // the rest are numbered in order, so the keys always match the badges.
  const options = [
    TRAIL_ENABLED && {
      id: "trail",
      className: "menu-option-trail",
      icon: "🥾",
      name: "Vildtsporet",
      sub: trail.region
        ? `Kapitel ${trail.region.index + 1} · ${trail.region.name} · ${trail.learned}/${trail.total} arter`
        : "Hele sporet er gennemført",
      onClick: onOpenTrail,
    },
    { id: "daily", icon: "🗓️", name: "Daglig udfordring", sub: "Nye spørgsmål hver dag", onClick: onOpenDaily },
    {
      id: "endless",
      icon: "♾️",
      name: "Endless mode",
      sub: "Endeløs sjov",
      // Your best run, shown big on the right of the button once
      // there is one.
      aside: highscore > 0 && (
        <span className="menu-record">
          <span className="menu-record-label">{highscore >= ENDLESS_TOTAL ? "🏆 Klaret" : "Rekord"}</span>
          <PixelNumber value={highscore} pixel={3} />
        </span>
      ),
      onClick: onStartEndless,
    },
    {
      id: "guide",
      className: "menu-option-guide",
      icon: "📖",
      name: "Feltguide",
      sub: `${ALL_SPECIES.length} arter · slå op og øv`,
      onClick: onOpenGuide,
    },
  ].filter(Boolean);

  // Number keys pick a mode, matching the number badges on desktop.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      options[Number(e.key) - 1]?.onClick();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="card menu-card">
      <div className="menu-body">
        <div className="menu-brand">
          <span className="menu-icon">🐾</span>
          <h1 className="menu-title">WildlifeID</h1>
          <p className="menu-subtitle">Det Vilde Danmark</p>
        </div>

        {todayUnplayed && <DailyBanner onClick={onStartTodaysDaily} />}

        <div className="menu-groups">
          {options.map((option, i) => (
            <button key={option.id} className={`menu-option ${option.className ?? ""}`} onClick={option.onClick}>
              <span className="menu-key">{i + 1}</span>
              <span className="menu-option-icon">{option.icon}</span>
              <span className="menu-option-text">
                <span className="menu-option-name">{option.name}</span>
                <span className="menu-option-sub">{option.sub}</span>
              </span>
              {option.aside}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
