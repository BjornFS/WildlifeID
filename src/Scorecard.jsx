function encouragement(score, total) {
  const pct = score / total;
  if (pct >= 0.9) return "Fremragende! Du kender dine dyr.";
  if (pct >= 0.7) return "Godt klaret.";
  if (pct >= 0.5) return "Pænt forsøg — der er stadig plads til forbedring.";
  return "Bliv ved med at øve dig, det kommer.";
}

// Rolls the per-species tally up to per-category totals, so the
// scorecard can say e.g. "Hundefamilien 1/3" instead of naming a
// single species — the group is what's worth practicing.
function summarizeByCategory(tally, species, categories) {
  const totals = Object.fromEntries(categories.map((c) => [c.id, { correct: 0, total: 0 }]));
  for (const s of species) {
    const t = tally[s.id];
    totals[s.category].correct += t.correct;
    totals[s.category].total += t.total;
  }
  return categories.map((c) => {
    const t = totals[c.id];
    const accuracy = t.total > 0 ? t.correct / t.total : null;
    return { ...c, correct: t.correct, total: t.total, accuracy };
  }).sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1));
}

export default function Scorecard({
  score,
  total,
  tally,
  species,
  categories,
  groupLabel = "Pattedyr",
  onBackToMenu,
  backLabel = "Tilbage til menu",
}) {
  const rows = summarizeByCategory(tally, species, categories);
  const attempted = rows.filter((r) => r.total > 0);
  const best = attempted[0];
  const worst = attempted[attempted.length - 1];
  const showTip = best && worst && best.id !== worst.id && best.accuracy > worst.accuracy;

  return (
    <div className="card">
      <header className="header">
        <div>
          <p className="eyebrow">{groupLabel}</p>
          <h1 className="title">Resultat</h1>
        </div>
      </header>

      <p className="final-score">
        {score} / {total}
      </p>
      <p className="encouragement">{encouragement(score, total)}</p>

      {showTip && (
        <p className="tip">
          Du er bedst til <strong>{best.name_da}</strong> ({best.correct}/{best.total} rigtige).
          Øv dig mere på <strong>{worst.name_da}</strong> ({worst.correct}/{worst.total} rigtige).
        </p>
      )}

      <ul className="tally-list">
        {rows.map((r) => (
          <li key={r.id} className="tally-row">
            <div className="tally-label">
              <span className="tally-name">{r.name_da}</span>
              <span className="tally-count">{r.total > 0 ? `${r.correct}/${r.total}` : "ikke spurgt"}</span>
            </div>
            <div className="tally-bar">
              <div
                className="tally-bar-fill"
                style={{ width: `${r.total > 0 ? r.accuracy * 100 : 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <button onClick={onBackToMenu} className="next-button">
        {backLabel}
      </button>
    </div>
  );
}
