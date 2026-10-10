import { useEffect } from "react";
import { ALL_SPECIES } from "../data/groups.js";
import { ENDLESS_TOTAL, getHighscore } from "../game/endless.js";
import PixelNumber from "../components/PixelNumber.jsx";
import { getDailyResults, todayDateString } from "../game/dailyChallenge.js";
import DailyBanner from "../components/DailyBanner.jsx";

export default function Menu({ onStartEndless, onOpenDaily, onStartTodaysDaily, onOpenGuide }) {
  const highscore = getHighscore();
  // Today's challenge gets a pixel tab on the daily button until it's
  // been played.
  const todayUnplayed = !getDailyResults()[todayDateString()];

  // Numbered in order, so the keys always match the badges.
  const options = [
    {
      id: "daily",
      icon: "🗓️",
      name: "Daglig udfordring",
      sub: "Nye spørgsmål hver dag",
      tab: todayUnplayed && <DailyBanner onClick={onStartTodaysDaily} />,
      onClick: onOpenDaily,
    },
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
  ];

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

        <div className="menu-groups">
          {options.map((option, i) => (
            // The daily tab is its own button, so it sits beside the option
            // in a wrapper rather than inside it.
            <div key={option.id} className="menu-option-wrap">
              <button className={`menu-option ${option.className ?? ""}`} onClick={option.onClick}>
                <span className="menu-key">{i + 1}</span>
                <span className="menu-option-icon">{option.icon}</span>
                <span className="menu-option-text">
                  <span className="menu-option-name">{option.name}</span>
                  <span className="menu-option-sub">{option.sub}</span>
                </span>
                {option.aside}
              </button>
              {option.tab}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
