import { useCallback, useEffect, useRef, useState } from "react";
import { thumb } from "../lib/asset.js";
import { playSound } from "../lib/sound.js";
import { ENDLESS_TOTAL } from "../game/endless.js";
import DailySummary from "./DailySummary.jsx";
import EndlessProgress from "./EndlessProgress.jsx";
import PixelSparkles from "./PixelSparkles.jsx";

// The single end-of-run pop-up, shared by every mode instead of each
// mode having its own results treatment. `closing` swaps in the
// out-animation right before the popup actually unmounts, so
// dismissing it never feels abrupt.
//
// The second stat tile is contextual: daily/practice show "korrekte"
// (score/total, since they have a fixed length), endless shows its
// highscore instead. Endless also swaps the katalog for its progress
// bar, and gets a celebratory card of its own when every species was
// named without a single miss.
export default function ResultPopup({ result, score, streak, answerLog, closing, onExit, onRetry, onNext, onOpenGuide }) {
  const { mode, total, highscore } = result;
  const isEndless = mode === "endless";
  const isDaily = mode === "daily";
  const isCompleted = isEndless && result.type === "completed";
  const title = isCompleted ? "Completed!!!!" : isEndless ? "Game Over!" : "Completed!";

  const thirdStat = isEndless
    ? { icon: "🏆", label: "HIGHSCORE", value: highscore }
    : { icon: "🎯", label: "KORREKTE", value: `${score}/${total}` };

  useEffect(() => {
    if (isCompleted) playSound("dailyPerfect");
  }, [isCompleted]);

  // Which edges of the katalog strip still have more to reveal, so the
  // fade only shows on a side you can actually scroll toward — never
  // both at rest (start), and never the right edge once you've
  // reached the last item.
  const galleryRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollFade = useCallback(() => {
    const el = galleryRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollFade();
  }, [updateScrollFade, answerLog]);

  // Enter = next, R = retry, Esc = back out.
  // The badges for these only show on desktop (see Retro.css).
  useEffect(() => {
    if (closing) return;
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLButtonElement && !e.target.disabled && (e.key === "Enter" || e.key === " ")) return;
      if (e.key === "Enter") onNext();
      else if (e.key === "r" || e.key === "R") onRetry();
      else if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closing, onNext, onRetry, onExit]);

  const nextButton = (
    <button type="button" onClick={onNext} className="result-btn-next">
      <span className="result-btn-next-icon">▶</span>{" "}
      {mode === "practice" ? "Tilbage til feltguiden" : isEndless || mode === "expert" ? "Ny runde" : "Næste"}
      <span className="result-key">Enter</span>
    </button>
  );

  return (
    <div className={`result-overlay ${closing ? "is-closing" : ""}`}>
      <div
        className={`result-modal ${closing ? "is-closing" : ""} ${isCompleted ? "is-completed" : ""} ${isDaily ? "is-daily" : ""}`}
      >
        {isCompleted && <PixelSparkles />}
        <span className="result-paw">🐾</span>

        {isCompleted && <span className="completed-trophy" aria-hidden="true">🏆</span>}
        <p className="result-title">{title}</p>
        <p className="result-subtitle">
          {isCompleted ? `Alle ${ENDLESS_TOTAL} arter — uden en eneste fejl` : result.subtitle}
          {result.isToday && <span className="new-tag">New</span>}
          {isEndless && !isCompleted && result.isNewHighscore && <span className="new-tag">Ny rekord</span>}
        </p>

        {isEndless ? (
          <>
            <div className="result-divider" />
            <EndlessProgress
              cleared={score}
              best={result.isNewHighscore ? result.previousHighscore : highscore}
              large
            />
          </>
        ) : (
          answerLog.length > 0 && (
            <>
              <div className="result-divider" />
              <p className="result-gallery-label">Katalog</p>
              {/* Every question this run, scrollable — 4 visible at a
                  time — each marked correct or wrong, not just a
                  highlight reel of the ones you got right. */}
              <div
                ref={galleryRef}
                onScroll={updateScrollFade}
                className={`result-gallery ${canScrollLeft ? "fade-left" : ""} ${canScrollRight ? "fade-right" : ""}`}
              >
                {answerLog.map((entry, i) => (
                  <div key={i} className="result-gallery-item">
                    <div className="result-gallery-thumb">
                      {entry.image ? <img src={thumb(entry.image)} alt="" /> : null}
                      <span className={`result-gallery-badge ${entry.wasCorrect ? "is-correct" : "is-wrong"}`}>
                        {entry.wasCorrect ? "✓" : "✕"}
                      </span>
                    </div>
                    <span className="result-gallery-name">{entry.species.name_da}</span>
                  </div>
                ))}
              </div>
            </>
          )
        )}

        {isDaily ? (
          <>
            {/* Compact: the run's own numbers as two small chips. */}
            <div className="result-chips">
              <span className="result-chip">
                🔥 Streak <strong>{streak}</strong>
              </span>
              <span className="result-chip">
                🎯 Korrekte <strong>{`${score}/${total}`}</strong>
              </span>
            </div>
            <div className="result-divider" />
            <DailySummary result={result} score={score} answerLog={answerLog} onOpenGuide={onOpenGuide} />
          </>
        ) : (
          <div className="result-stats">
            <div className="result-stat">
              <span className="result-stat-icon">🔥</span>
              <span className="result-stat-label">Streak</span>
              <span className="result-stat-value">{streak}</span>
            </div>
            <div className="result-stat">
              <span className="result-stat-icon">{thirdStat.icon}</span>
              <span className="result-stat-label">{thirdStat.label}</span>
              <span className="result-stat-value">{thirdStat.value}</span>
            </div>
          </div>
        )}

        {/* Daily puts the main button between home and retry, in one
            row, to leave room for its statistics above. */}
        {!isDaily && nextButton}

        <div className="result-actions-row">
          <button type="button" onClick={onExit} className="result-btn-icon is-home" data-sound="home" aria-label="Til menu">
            🏠<span className="result-key">Esc</span>
          </button>
          {isDaily && nextButton}
          <button type="button" onClick={onRetry} className="result-btn-icon is-retry" aria-label="Prøv igen">
            ↻<span className="result-key">R</span>
          </button>
        </div>
      </div>
    </div>
  );
}
