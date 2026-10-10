import { useMemo, useState } from "react";
import { thumb } from "../lib/asset.js";
import { track } from "../lib/analytics.js";
import { buildCategoryStats, dailyShareText } from "../game/stats.js";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older/insecure contexts: fall back to a hidden textarea.
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  }
}

// The daily end card's statistics, shown right on the card: the run's
// strongest and weakest categories side by side, a tip that opens the
// field guide at the weakest one, and the shareable row of squares.
export default function DailySummary({ result, score, answerLog, onOpenGuide }) {
  const [copied, setCopied] = useState(false);
  const shareText = dailyShareText(result.date, score, result.total, answerLog);

  // Best/worst 3 categories this run, by accuracy (ties broken toward
  // whichever was asked more, since that's the more confident read).
  // Only categories actually asked this run show up at all.
  const categoryStats = useMemo(() => buildCategoryStats(answerLog), [answerLog]);
  const strongest = [...categoryStats].sort((a, b) => b.accuracy - a.accuracy || b.total - a.total).slice(0, 3);
  const weakest = [...categoryStats].sort((a, b) => a.accuracy - b.accuracy || b.total - a.total).slice(0, 3);
  const weakestOverall = weakest[0];

  const onCopy = async () => {
    if (await copyText(shareText)) {
      track("share-daily");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className="daily-summary">
      {categoryStats.length > 0 && (
        <div className="result-stats-box">
          <div className="result-stats-col">
            <p className="result-stats-section-label">⭐ Stærkeste</p>
            <div className="result-stats-list">
              {strongest.map((c) => (
                <CategoryStatRow key={c.id} category={c} />
              ))}
            </div>
          </div>
          <div className="result-stats-col-divider" />
          <div className="result-stats-col">
            <p className="result-stats-section-label">🎯 Kan forbedres</p>
            <div className="result-stats-list">
              {weakest.map((c) => (
                <CategoryStatRow key={c.id} category={c} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Points at the weakest category, and opens the field guide
          right at it. */}
      {weakestOverall && weakestOverall.accuracy < 1 ? (
        <button type="button" className="result-stats-tip is-link" onClick={() => onOpenGuide(weakestOverall.id)}>
          <span className="result-stats-tip-icon">💡</span>
          <p className="result-stats-tip-text">
            <strong>{weakestOverall.name}</strong> var en af dine svageste kategorier. Slå dem op i feltguiden og
            øv dem!
          </p>
          <span className="result-stats-tip-chevron">›</span>
        </button>
      ) : (
        <div className="result-stats-tip">
          <span className="result-stats-tip-icon">💡</span>
          <p className="result-stats-tip-text">Flot! Du ramte plet i alle kategorier denne omgang.</p>
        </div>
      )}

      <div className="daily-share">
        <span className="daily-share-squares" aria-label={`${score} af ${result.total} rigtige`}>
          {answerLog.map((e, i) => (
            <i key={i} className={`daily-share-square ${e.wasCorrect ? "is-correct" : "is-wrong"}`} />
          ))}
        </span>
        <button type="button" className={`daily-share-btn ${copied ? "is-copied" : ""}`} onClick={onCopy}>
          {copied ? "✓ Kopieret" : "📋 Kopiér"}
        </button>
      </div>
    </div>
  );
}

// One row in the strongest/weakest lists: a thumbnail from this run,
// the category name, an accuracy bar, and the raw fraction — same
// "photo + fraction" language as the katalog gallery, just aggregated
// by category instead of per species.
function CategoryStatRow({ category }) {
  return (
    <div className="result-stats-row">
      <div className="result-stats-row-thumb">
        {category.image ? <img src={thumb(category.image)} alt="" /> : <span>🐾</span>}
      </div>
      <div className="result-stats-row-body">
        <span className="result-stats-row-name">{category.name}</span>
        <div className="result-stats-row-bar">
          <div className="result-stats-row-bar-fill" style={{ width: `${Math.round(category.accuracy * 100)}%` }} />
        </div>
      </div>
      <span className="result-stats-row-frac">
        {category.correct}/{category.total}
      </span>
    </div>
  );
}
