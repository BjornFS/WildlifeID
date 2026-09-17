import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import GROUPS, { ALL_SPECIES, ALL_CATEGORIES } from "./groups.js";
import BIOMES from "./biomes.js";
import Menu from "./Menu.jsx";
import DailyCalendar from "./DailyCalendar.jsx";
import { DAILY_ROUNDS, findNextDailyDate, saveDailyResult, speciesForDate } from "./dailyChallenge.js";
import { addRunPoints, calculateRunPoints, streakTier } from "./points.js";

const TOTAL_ROUNDS = 20;
// Endless mode and the daily challenge deliberately pull from every
// group combined, rather than picking one — see groups.js.
const ALL_GROUPS_POOL = { species: ALL_SPECIES, categories: ALL_CATEGORIES, label: "Alle dyr" };

// Endless mode's highscore, kept in localStorage — there's no backend
// to persist a real file to, so this is the practical stand-in: it
// survives app restarts on this device, same as a saved file would.
const HIGHSCORE_KEY = "wildlifeid-endless-highscore";

function getHighscore() {
  const raw = localStorage.getItem(HIGHSCORE_KEY);
  const n = raw === null ? 0 : parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

function setHighscore(value) {
  localStorage.setItem(HIGHSCORE_KEY, String(value));
}

// "2026-09-12" -> "12/9-2026" — a compact, informal Danish date
// shorthand, so the daily challenge's header can show which day
// you're on/replaying without taking up much space.
function formatShortDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${day}/${month}-${year}`;
}

const CATEGORY_BY_ID = Object.fromEntries(ALL_CATEGORIES.map((c) => [c.id, c]));

// Tallies one run's answers per species category (Rovfugle, Hjortevildt,
// etc. — see categories.js/birdCategories.js), for the result pop-up's
// "Se statistik" view. Grouping by category rather than species mirrors
// how the old scorecard reported progress, since a family is a more
// useful thing to reflect on than a single species.
function buildCategoryStats(answerLog) {
  const byCategory = new Map();
  for (const entry of answerLog) {
    const categoryId = entry.species.category;
    const stat = byCategory.get(categoryId) ?? { correct: 0, total: 0, image: entry.image };
    stat.total += 1;
    if (entry.wasCorrect) stat.correct += 1;
    byCategory.set(categoryId, stat);
  }
  return [...byCategory.entries()].map(([id, stat]) => ({
    id,
    name: CATEGORY_BY_ID[id]?.name_da ?? id,
    correct: stat.correct,
    total: stat.total,
    image: stat.image,
    accuracy: stat.correct / stat.total,
  }));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Picks one item at random, weighted by `weightFn`. Every item passed
// in must have weight > 0 — the caller is responsible for filtering
// out zero-weight items first (there's no "skip and retry" here).
function pickWeighted(items, weightFn) {
  const weights = items.map(weightFn);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1]; // float rounding safety net
}

// "Bound pairs" — lookalike species that must always appear together
// as answer options, so the quiz forces you to actually tell them
// apart instead of guessing from the category alone. Whenever the
// answer is one of these, its whole group is included in the options.
const BOUND_GROUPS = [
  ["baever", "bisamrotte", "sumpbaever"], // beaver / muskrat / coypu
  ["hare", "kanin"], // hare / rabbit
  ["markmus", "mosegris", "skovmus", "rotte"], // voles, mouse & rat
];

function boundGroupFor(speciesId) {
  return BOUND_GROUPS.find((group) => group.includes(speciesId));
}

// Builds the answer-option grid for a given answer species: locked to
// its category, with its bound-pair group (if any) always forced in
// alongside it. Shared by every mode, since the "can only guess within
// the category" and "lookalikes always appear together" rules apply
// no matter how the answer itself was chosen. Always searches the full
// combined species list (not just whichever group is currently being
// played) — safe because category ids never overlap between groups,
// so a mammal category can never accidentally pull in a bird option.
function buildOptionsFor(answer) {
  const sameCategory = ALL_SPECIES.filter((s) => s.category === answer.category);
  const optionCount = Math.min(4, sameCategory.length);

  const group = boundGroupFor(answer.id);
  const forced = group ? sameCategory.filter((s) => group.includes(s.id)) : [answer];
  const filler = shuffle(sameCategory.filter((s) => !forced.includes(s)));
  return shuffle([...forced, ...filler.slice(0, Math.max(0, optionCount - forced.length))]);
}

// A species with no photos yet still needs a "slot" so it can't be
// asked twice with the same placeholder — it's identified by its id
// instead of an image path.
function slotKey(species, image) {
  return image ?? `species:${species.id}`;
}

// How many photos of this species haven't been shown yet this run (a
// photo-less species just has one placeholder "slot" instead). This
// doubles as the species' selection weight — see buildRound.
function unusedImageCount(species, usedImages) {
  if (species.images.length === 0) {
    return usedImages.has(slotKey(species)) ? 0 : 1;
  }
  return species.images.filter((img) => !usedImages.has(img)).length;
}

// Picks the next question. `usedImages` is a Set of image paths (and
// no-photo species ids) already shown this run.
//
// Both the category and the species within it are picked weighted by
// remaining unused-image count, not uniformly. A category's weight is
// just the sum of its candidates' weights, so this collapses to "a
// species' chance is its own share of the whole remaining photo pool"
// — a species with 3 unused photos is 3x as likely as one with 1,
// regardless of how many other species share its category. Two nice
// side effects: species in tiny categories (fox, wild boar — 1 of only
// 2 in their group) stop being over-represented just because their
// category is small, and a species that was just asked has one fewer
// unused photo, so it's immediately less likely to come right back.
//
// `lastSpeciesId` (the previous round's answer) is additionally
// excluded outright whenever any other candidate exists, so the same
// species can never appear back-to-back — weighting alone only makes
// repeats rarer, not impossible.
//
// `allowExhaustedFallback` (default true) governs what happens once
// there's no legal non-repeat candidate left: classic mode's 20
// rounds never actually reach this (57 photos, one 20-round run), so
// it falls back to reusing the full species list as a safety net.
// Endless mode passes `false` instead, since for it this genuinely
// means "the run is over" — buildRound then returns null so the
// caller can end the game rather than silently reusing photos.
function buildRound(speciesPool, categoryPool, usedImages, lastSpeciesId, { allowExhaustedFallback = true } = {}) {
  const candidates = speciesPool.filter((s) => unusedImageCount(s, usedImages) > 0);
  let pool = candidates.filter((s) => s.id !== lastSpeciesId);
  const exhausted = pool.length === 0;
  if (exhausted && !allowExhaustedFallback) return null;
  if (exhausted) pool = speciesPool;
  const weightOf = (s) => (exhausted ? Math.max(s.images.length, 1) : unusedImageCount(s, usedImages));

  const categoriesInPlay = categoryPool.filter((c) => pool.some((s) => s.category === c.id));
  const chosenCategory = pickWeighted(categoriesInPlay, (c) =>
    pool.filter((s) => s.category === c.id).reduce((sum, s) => sum + weightOf(s), 0)
  );
  const categoryCandidates = pool.filter((s) => s.category === chosenCategory.id);

  const answer = pickWeighted(categoryCandidates, weightOf);
  const unusedImages = answer.images.filter((img) => !usedImages.has(img));
  const image =
    answer.images.length > 0 ? pickRandom(unusedImages.length > 0 ? unusedImages : answer.images) : null;
  usedImages.add(slotKey(answer, image));

  return { answer, image, options: buildOptionsFor(answer) };
}

// Builds one daily-challenge question for a given species. Unlike
// buildRound, the species itself is fixed (chosen by the day's seed
// before this runs) — only the photo is randomized here, freshly on
// every play, same as a normal round would pick among unused photos.
function buildDailyRoundFor(species) {
  const image = species.images.length > 0 ? pickRandom(species.images) : null;
  return { answer: species, image, options: buildOptionsFor(species) };
}

// Shows the given photo. If there's no photo (empty `images` list, or
// the file fails to load), it shows a placeholder sketch instead, so
// the quiz still works with no photos at all.
function AnimalImage({ species, src }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="placeholder">
        <span className="placeholder-label">Foto mangler — {species.name_da}</span>
        <span className="placeholder-hint">
          add a photo for "{species.id}" in species.js
        </span>
      </div>
    );
  }

  return (
    <img
      className="image"
      src={src}
      alt={species.name_da}
      onError={() => setFailed(true)}
    />
  );
}

// Streak fire escalates through 4 stages as you rack up correct
// answers in a row — a bigger flame is a nicer reward to chase than
// just a number going up. Uses the same tier boundaries as the points
// system's streak multiplier (see points.js), so the two stay in sync.
function streakIcon(streak) {
  return `/streak-icons/streak-icon-${streakTier(streak) + 1}.png`;
}

const ACTIVITY_ICON = { day: "☀️", night: "🌙", both: "🌗" };

// One muted colour per rarity tier (1 = common, 5 = rare). Deliberately
// calm, not a red-alert kind of red — a species being rare in Denmark
// isn't a crisis (see: sika deer), just a fact worth flagging gently.
const RARITY_COLOR = ["#5b8ec4", "#8ba36b", "#c7a23f", "#c98a4b", "#bd6456"];

// Answer grid always has 4 slots so the boxes never move, even when a
// category (like hundedyr, with only 2 species) has fewer real
// options — missing slots render as an empty, non-interactive cell.
const EMPTY_SLOTS = [0, 1, 2, 3];

// Small "did you know" box: weight, habitat, day/night activity, how
// common it is in Denmark (as a coloured dot count, top right), and
// whether it's native or introduced. Always mounted at a fixed size so
// it reserves its spot below the image from the very first render —
// `visible` just toggles opacity, so revealing it after answering
// never shifts anything below it.
function StatsBox({ species, visible }) {
  const biome = BIOMES.find((b) => b.id === species.habitat);
  const rarityColor = RARITY_COLOR[species.rarity - 1];

  return (
    <div className={`stats-box ${visible ? "is-visible" : ""}`}>
      <div className="stats-title-row">
        <p className="stats-title">Fakta</p>
        <span className="rarity-dots" title="Hvor almindelig i Danmark">
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className="rarity-dot"
              style={{ background: n <= species.rarity ? rarityColor : undefined }}
            />
          ))}
        </span>
      </div>
      <div className="stats-row">
        <span className="stats-weight">{species.weight}</span>
        <span className="stats-habitat">
          {biome.emoji} {biome.name_da}
        </span>
        <span className="stats-badge">Aktiv: {ACTIVITY_ICON[species.activity]}</span>
        <span className="stats-badge">{species.native ? "Tilhørende 🏠" : "Invasiv 👾"}</span>
      </div>
    </div>
  );
}

// The single end-of-run pop-up, shared by every mode instead of each
// mode having its own results treatment. `closing` swaps in the
// out-animation right before the popup actually unmounts, so
// dismissing it never feels abrupt.
//
// The third stat tile is contextual: classic/daily show "korrekte"
// (score/total, since they have a fixed length), endless shows its
// highscore instead (it has no fixed total to be "correct out of").
function ResultPopup({ result, score, streak, answerLog, closing, onExit, onRetry, onNext }) {
  const { mode, total, highscore, points } = result;
  const [view, setView] = useState("result"); // "result" | "stats"
  const [statsClosing, setStatsClosing] = useState(false);

  // Mirrors the popup's own closing pattern: play the slide-out first,
  // then actually swap the view back once it's done, so leaving the
  // stats view never feels like an instant cut.
  const closeStats = useCallback(() => {
    setStatsClosing(true);
    setTimeout(() => {
      setView("result");
      setStatsClosing(false);
    }, 220);
  }, []);

  const thirdStat =
    mode === "endless"
      ? { icon: "🏆", label: "HIGHSCORE", value: highscore }
      : { icon: "🎯", label: "KORREKTE", value: `${score}/${total}` };

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

  // Best/worst 3 categories this run, by accuracy (ties broken toward
  // whichever was asked more, since that's the more confident read).
  // Only categories actually asked this run show up at all.
  const categoryStats = useMemo(() => buildCategoryStats(answerLog), [answerLog]);
  const strongest = useMemo(
    () => [...categoryStats].sort((a, b) => b.accuracy - a.accuracy || b.total - a.total).slice(0, 3),
    [categoryStats]
  );
  const weakest = useMemo(
    () => [...categoryStats].sort((a, b) => a.accuracy - b.accuracy || b.total - a.total).slice(0, 3),
    [categoryStats]
  );
  const weakestOverall = weakest[0];

  return (
    <div className={`result-overlay ${closing ? "is-closing" : ""}`}>
      <div className={`result-modal ${closing ? "is-closing" : ""} ${view === "stats" ? "is-stats-view" : ""}`}>
        <span className="result-paw">🐾</span>

        {view === "stats" ? (
          <div className={`result-stats-view ${statsClosing ? "is-closing" : ""}`}>
            <div className="result-stats-header">
              <button type="button" onClick={closeStats} className="result-stats-back" aria-label="Tilbage">
                ‹
              </button>
              <div>
                <p className="result-title result-title-sm">Din runde</p>
                <p className="result-subtitle">Statistik for denne omgang</p>
              </div>
            </div>

            {categoryStats.length === 0 ? (
              <p className="result-stats-empty">Ingen kategorier at vise endnu.</p>
            ) : (
              <>
                {/* One shared bounding box, strongest/weakest side by
                    side, so both fit without the view growing taller
                    than the main Game Over screen. */}
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

                {/* Pinned to the bottom of the view (not just tacked on
                    after the lists) so it reads as the view's takeaway.
                    Doesn't lead anywhere yet — just a teaser for a
                    future "practice your weak spot" flow. */}
                <div className="result-stats-tip">
                  <span className="result-stats-tip-icon">💡</span>
                  {weakestOverall && weakestOverall.accuracy < 1 ? (
                    <p className="result-stats-tip-text">
                      <strong>{weakestOverall.name}</strong> var en af dine svageste kategorier. Prøv en ny runde med
                      fokus på {weakestOverall.name.toLowerCase()}!
                    </p>
                  ) : (
                    <p className="result-stats-tip-text">Flot! Du ramte plet i alle kategorier denne omgang.</p>
                  )}
                  <span className="result-stats-tip-chevron">›</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="result-title">Game Over!</p>
            <p className="result-subtitle">{result.subtitle}</p>

            {answerLog.length > 0 && (
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
                        {entry.image ? <img src={entry.image} alt="" /> : null}
                        <span className={`result-gallery-badge ${entry.wasCorrect ? "is-correct" : "is-wrong"}`}>
                          {entry.wasCorrect ? "✓" : "✕"}
                        </span>
                      </div>
                      <span className="result-gallery-name">{entry.species.name_da}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="result-stats">
              <div className="result-stat">
                <span className="result-stat-icon">⭐</span>
                <span className="result-stat-label">Point</span>
                <span className="result-stat-value">{points}</span>
              </div>
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

            <button type="button" onClick={onNext} className="result-btn-next">
              <span className="result-btn-next-icon">▶</span> Næste
            </button>

            <div className="result-actions-row">
              <button type="button" onClick={onExit} className="result-btn-icon is-home" aria-label="Til menu">
                🏠
              </button>
              <button type="button" onClick={() => setView("stats")} className="result-btn-stats">
                📊 Se statistik
              </button>
              <button type="button" onClick={onRetry} className="result-btn-icon is-retry" aria-label="Prøv igen">
                ↻
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// One row in the stats view's strongest/weakest lists: a thumbnail
// from this run, the category name, an accuracy bar, and the raw
// fraction — same "photo + fraction" language as the katalog gallery,
// just aggregated by category instead of per species.
function CategoryStatRow({ category }) {
  return (
    <div className="result-stats-row">
      <div className="result-stats-row-thumb">
        {category.image ? <img src={category.image} alt="" /> : <span>🐾</span>}
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

// Dev-only screen (never shown in a production build — see the
// import.meta.env.DEV check in Menu.jsx) for iterating on the result
// pop-up's design without having to play through an entire run every
// time. Every field is freely editable and updates the live preview
// instantly.
function DevPreview({ onBack }) {
  const [mode, setMode] = useState("classic");
  const [endlessType, setEndlessType] = useState("lost");
  const [score, setScore] = useState(14);
  const [total, setTotal] = useState(20);
  const [streak, setStreak] = useState(5);
  const [points, setPoints] = useState(22);
  const [highscore, setHighscore] = useState(11);
  const [isNewHighscore, setIsNewHighscore] = useState(false);

  const sampleAnswerLog = useCallback(() => {
    const withImages = ALL_SPECIES.filter((s) => s.images.length > 0);
    return shuffle(withImages)
      .slice(0, 9)
      .map((species) => ({ species, image: species.images[0], wasCorrect: Math.random() > 0.25 }));
  }, []);
  const [answerLog, setAnswerLog] = useState(sampleAnswerLog);

  const subtitle = mode === "endless" ? "Endless" : mode === "daily" ? "Dagens udfordring" : "Pattedyr";

  const result = {
    mode,
    type: mode === "endless" ? endlessType : "finished",
    score,
    total,
    highscore,
    isNewHighscore,
    subtitle,
    points,
  };

  return (
    <div className="page dev-page">
      <div className="dev-panel">
        <button type="button" onClick={onBack} className="dev-panel-back">
          ← Tilbage til menu
        </button>

        <p className="dev-panel-label">Mode</p>
        <div className="dev-panel-row">
          {["classic", "daily", "endless"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`dev-panel-btn ${mode === m ? "is-active" : ""}`}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === "endless" && (
          <>
            <p className="dev-panel-label">Endless type</p>
            <div className="dev-panel-row">
              {["lost", "exhausted"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEndlessType(t)}
                  className={`dev-panel-btn ${endlessType === t ? "is-active" : ""}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="dev-panel-field">
          Score
          <input type="number" value={score} onChange={(e) => setScore(Number(e.target.value))} />
        </label>
        {mode !== "endless" && (
          <label className="dev-panel-field">
            Total
            <input type="number" value={total} onChange={(e) => setTotal(Number(e.target.value))} />
          </label>
        )}
        <label className="dev-panel-field">
          Streak
          <input type="number" value={streak} onChange={(e) => setStreak(Number(e.target.value))} />
        </label>
        <label className="dev-panel-field">
          Points
          <input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} />
        </label>
        {mode === "endless" && (
          <>
            <label className="dev-panel-field">
              Highscore
              <input type="number" value={highscore} onChange={(e) => setHighscore(Number(e.target.value))} />
            </label>
            <label className="dev-panel-field dev-panel-checkbox">
              <input
                type="checkbox"
                checked={isNewHighscore}
                onChange={(e) => setIsNewHighscore(e.target.checked)}
              />
              Ny highscore
            </label>
          </>
        )}

        <button type="button" onClick={() => setAnswerLog(sampleAnswerLog())} className="dev-panel-btn dev-panel-shuffle">
          🔀 Nyt katalog
        </button>
        <button type="button" onClick={() => setAnswerLog([])} className="dev-panel-btn dev-panel-shuffle">
          Tomt katalog
        </button>
      </div>

      <div className="card">
        <ResultPopup
          result={result}
          score={score}
          streak={streak}
          answerLog={answerLog}
          closing={false}
          onExit={() => {}}
          onRetry={() => {}}
          onNext={() => {}}
        />
      </div>
    </div>
  );
}

export default function App() {
  const usedImages = useRef(new Set());
  const [screen, setScreen] = useState("menu"); // "menu" | "calendar" | "playing" | "devpreview"
  const [mode, setMode] = useState("classic"); // "classic" | "endless" | "daily"
  // Which species/categories the current run draws from — one single
  // group for classic mode, or every group combined for endless/daily
  // (see ALL_GROUPS_POOL). Set fresh at the start of every run.
  const [pool, setPool] = useState({ species: GROUPS[0].species, categories: GROUPS[0].categories, label: GROUPS[0].name_da });
  const [round, setRound] = useState(() => buildRound(pool.species, pool.categories, usedImages.current));
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  // The highest streak reached this run — shown in the result pop-up
  // instead of the live `streak`, since that resets to 0 the instant
  // a wrong answer ends the run, which would otherwise erase a good
  // run's streak the moment it's most worth showing.
  const [bestStreak, setBestStreak] = useState(0);
  const [asked, setAsked] = useState(0);
  const [showKendetegn, setShowKendetegn] = useState(false);
  // Bumped on every new round — used as a React key to remount the
  // question card, which is what triggers its CSS entrance animation.
  const [roundIndex, setRoundIndex] = useState(0);
  // Set once any run ends — drives the shared result pop-up for every
  // mode. null while still playing. `resultClosing` swaps in the
  // out-animation for the short window before the popup unmounts.
  const [gameResult, setGameResult] = useState(null);
  const [resultClosing, setResultClosing] = useState(false);
  // Every question answered this run — species, photo shown, and
  // whether you got it right — for the result pop-up's "Katalog"
  // gallery (the whole run, not just a highlight reel).
  const [answerLog, setAnswerLog] = useState([]);
  // The current daily challenge's 10 precomputed questions, and which
  // date they belong to (so the result can be saved under that date).
  const [dailyRounds, setDailyRounds] = useState([]);
  const [dailyDate, setDailyDate] = useState(null);

  const isAnswered = picked !== null;
  const isLastQuestion =
    (mode === "classic" && asked >= TOTAL_ROUNDS) || (mode === "daily" && asked >= DAILY_ROUNDS);
  const modeLabel =
    mode === "endless"
      ? "Endless"
      : mode === "daily"
        ? `Dagens udfordring · ${formatShortDate(dailyDate)}`
        : pool.label;

  const handlePick = useCallback(
    (species) => {
      if (isAnswered) return;
      const wasCorrect = species.id === round.answer.id;
      setPicked(species.id);
      setAsked((n) => n + 1);
      setAnswerLog((prev) => [...prev, { species: round.answer, image: round.image, wasCorrect }]);
      if (wasCorrect) {
        setScore((s) => s + 1);
        setStreak((s) => {
          const next = s + 1;
          setBestStreak((best) => Math.max(best, next));
          return next;
        });
      } else {
        setStreak(0);
      }
    },
    [isAnswered, round]
  );

  // Ends an endless run: compares the final score to the saved
  // highscore, updates it if beaten, and shows the result pop-up.
  const endEndlessRun = useCallback(
    (type, finalScore) => {
      const highscore = getHighscore();
      const isNewHighscore = finalScore > highscore;
      if (isNewHighscore) setHighscore(finalScore);
      const points = calculateRunPoints(answerLog, bestStreak);
      addRunPoints(points);
      setGameResult({
        mode: "endless",
        type,
        score: finalScore,
        highscore: isNewHighscore ? finalScore : highscore,
        isNewHighscore,
        subtitle: modeLabel,
        points,
      });
    },
    [modeLabel, answerLog, bestStreak]
  );

  // Plays the pop-up's exit animation, then actually performs the
  // dismissal action (go to menu/calendar, or start a fresh run) once
  // it's done — so leaving never feels like an instant cut.
  const dismissResult = useCallback((action) => {
    setResultClosing(true);
    setTimeout(() => {
      setGameResult(null);
      setResultClosing(false);
      action();
    }, 220);
  }, []);

  const nextRound = useCallback(() => {
    if (mode === "endless") {
      if (picked !== round.answer.id) {
        endEndlessRun("lost", score);
        return;
      }
      const next = buildRound(pool.species, pool.categories, usedImages.current, round.answer.id, {
        allowExhaustedFallback: false,
      });
      if (next === null) {
        endEndlessRun("exhausted", score);
        return;
      }
      setRound(next);
      setPicked(null);
      setShowKendetegn(false);
      setRoundIndex((n) => n + 1);
      return;
    }

    if (mode === "daily") {
      if (isLastQuestion) {
        saveDailyResult(dailyDate, { score, total: DAILY_ROUNDS });
        const dailyPoints = calculateRunPoints(answerLog, bestStreak);
        addRunPoints(dailyPoints);
        setGameResult({
          mode: "daily",
          type: "finished",
          score,
          total: DAILY_ROUNDS,
          subtitle: modeLabel,
          points: dailyPoints,
        });
        return;
      }
      setRound(dailyRounds[asked]);
      setPicked(null);
      setShowKendetegn(false);
      setRoundIndex((n) => n + 1);
      return;
    }

    // classic
    if (isLastQuestion) {
      const classicPoints = calculateRunPoints(answerLog, bestStreak);
      addRunPoints(classicPoints);
      setGameResult({
        mode: "classic",
        type: "finished",
        score,
        total: TOTAL_ROUNDS,
        subtitle: modeLabel,
        points: classicPoints,
      });
      return;
    }
    setRound(buildRound(pool.species, pool.categories, usedImages.current, round.answer.id));
    setPicked(null);
    setShowKendetegn(false);
    setRoundIndex((n) => n + 1);
  }, [
    mode,
    isLastQuestion,
    picked,
    round,
    score,
    endEndlessRun,
    dailyRounds,
    dailyDate,
    asked,
    pool,
    modeLabel,
    answerLog,
    bestStreak,
  ]);

  const startGame = useCallback((selectedMode, activePool) => {
    usedImages.current = new Set();
    setMode(selectedMode);
    setPool(activePool);
    setRound(buildRound(activePool.species, activePool.categories, usedImages.current));
    setPicked(null);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setAsked(0);
    setAnswerLog([]);
    setShowKendetegn(false);
    setRoundIndex(0);
    setGameResult(null);
    setResultClosing(false);
    setScreen("playing");
  }, []);

  const startClassic = useCallback(
    (groupId) => {
      const group = GROUPS.find((g) => g.id === groupId);
      startGame("classic", { species: group.species, categories: group.categories, label: group.name_da });
    },
    [startGame]
  );
  const startEndless = useCallback(() => startGame("endless", ALL_GROUPS_POOL), [startGame]);

  const startDaily = useCallback((dateStr) => {
    const rounds = shuffle(speciesForDate(dateStr)).map(buildDailyRoundFor);
    setMode("daily");
    setPool(ALL_GROUPS_POOL);
    setDailyDate(dateStr);
    setDailyRounds(rounds);
    setRound(rounds[0]);
    setPicked(null);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setAsked(0);
    setAnswerLog([]);
    setShowKendetegn(false);
    setRoundIndex(0);
    setGameResult(null);
    setResultClosing(false);
    setScreen("playing");
  }, []);

  const backToMenu = useCallback(() => {
    setScreen("menu");
  }, []);

  const openCalendar = useCallback(() => {
    setScreen("calendar");
  }, []);

  const backToCalendar = useCallback(() => {
    setScreen("calendar");
  }, []);

  const openDevPreview = useCallback(() => {
    setScreen("devpreview");
  }, []);

  if (screen === "menu") {
    return (
      <div className="page">
        <Menu
          onStart={startClassic}
          onStartEndless={startEndless}
          onOpenDaily={openCalendar}
          onOpenDevPreview={openDevPreview}
        />
      </div>
    );
  }

  if (screen === "calendar") {
    return (
      <div className="page">
        <DailyCalendar onSelectDate={startDaily} onBack={backToMenu} />
      </div>
    );
  }

  if (screen === "devpreview") {
    return <DevPreview onBack={backToMenu} />;
  }

  return (
    <div className="page">
      <div className="card">
        <div className="quiz-body">
          <header className="header">
            <p className="eyebrow">{modeLabel}</p>
            <div className="score">
              <img src={streakIcon(streak)} alt="" title={`Streak: ${streak}`} className="streak-icon" />
              <span className="score-progress">
                {mode === "endless"
                  ? asked
                  : mode === "daily"
                    ? `${Math.min(asked + 1, DAILY_ROUNDS)}/${DAILY_ROUNDS}`
                    : `${Math.min(asked + 1, TOTAL_ROUNDS)}/${TOTAL_ROUNDS}`}
              </span>
            </div>
          </header>

          <div key={roundIndex} className="question-card">
            <div className="image-frame">
              <AnimalImage key={round.image ?? round.answer.id} species={round.answer} src={round.image} />

              <button
                type="button"
                className={`kendetegn-tag ${isAnswered ? "is-active" : ""} ${showKendetegn ? "is-open" : ""}`}
                disabled={!isAnswered}
                onClick={() => setShowKendetegn((v) => !v)}
                aria-label={showKendetegn ? "Luk kendetegn" : "Kendetegn"}
              >
                <span key={showKendetegn ? "close" : "search"} className="kendetegn-tag-icon">
                  {showKendetegn ? "✕" : "🔍"}
                </span>
                <span className={`kendetegn-tag-label ${isAnswered && !showKendetegn ? "is-shown" : ""}`}>
                  Kendetegn
                </span>
              </button>

              {isAnswered && (
                <div className={`kendetegn-overlay ${showKendetegn ? "is-open" : ""}`}>
                  <p className="kendetegn-overlay-text">{round.answer.differentiator}</p>
                </div>
              )}
            </div>

            <StatsBox species={round.answer} visible={isAnswered} />

            <div className="options">
              {EMPTY_SLOTS.map((slot) => {
                const s = round.options[slot];
                if (!s) return <div key={slot} className="option option-empty" aria-hidden="true" />;

                const isPicked = picked === s.id;
                const isCorrectOption = s.id === round.answer.id;
                let extraClass = "";
                if (isAnswered && isCorrectOption) extraClass = "is-correct";
                else if (isAnswered && isPicked) extraClass = "is-wrong";
                else if (isAnswered) extraClass = "is-muted";

                return (
                  <button
                    key={s.id}
                    onClick={() => handlePick(s)}
                    disabled={isAnswered}
                    className={`option ${extraClass}`}
                  >
                    <span className="option-name">{s.name_da}</span>
                    <span className="option-sub">{s.name_en}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <img src="/bottom-banner.png" alt="" aria-hidden="true" className="bottom-banner" />

        {isAnswered && (
          <button onClick={nextRound} className="next-button">
            {mode === "endless"
              ? picked === round.answer.id
                ? "Næste dyr"
                : "Se resultat"
              : isLastQuestion
                ? "Se resultat"
                : "Næste dyr"}
          </button>
        )}

        {gameResult && (
          <ResultPopup
            result={gameResult}
            score={score}
            streak={bestStreak}
            answerLog={answerLog}
            closing={resultClosing}
            onExit={() => dismissResult(gameResult.mode === "daily" ? backToCalendar : backToMenu)}
            onRetry={() =>
              dismissResult(gameResult.mode === "daily" ? () => startDaily(dailyDate) : () => startGame(gameResult.mode, pool))
            }
            onNext={() => {
              if (gameResult.mode !== "daily") {
                dismissResult(() => startGame(gameResult.mode, pool));
                return;
              }
              const next = findNextDailyDate(dailyDate);
              dismissResult(next ? () => startDaily(next) : backToCalendar);
            }}
          />
        )}
      </div>
    </div>
  );
}
