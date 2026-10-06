import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { asset, thumb } from "./asset.js";
import GROUPS, { ALL_SPECIES, ALL_CATEGORIES } from "./groups.js";
import { ACTIVITY_ICON, RarityDots, biomeOf } from "./facts.jsx";
import Menu from "./Menu.jsx";
import Shell from "./Shell.jsx";
import FieldGuide from "./FieldGuide.jsx";
import { DESKTOP_QUERY, useMediaQuery } from "./useMediaQuery.js";
import DailyCalendar from "./DailyCalendar.jsx";
import { DAILY_ROUNDS, findNextDailyDate, saveDailyResult, speciesForDate, todayDateString } from "./dailyChallenge.js";
import { streakTier } from "./points.js";
import { playSound } from "./sound.js";
import { ENDLESS_TOTAL, getHighscore, setHighscore } from "./endless.js";
import { buildOptionsFor, pickRandom, shuffle } from "./options.js";
import Trail, { Stars } from "./Trail.jsx";
import {
  NODE_LABEL,
  PASS_RATE,
  TRAIL_ENABLED,
  buildTrailSteps,
  getTrailProgress,
  learnedSpecies,
  saveNodeResult,
  starsFor,
} from "./trail.js";

const TOTAL_ROUNDS = 20;
// A practice run on one category, started from the field guide.
const PRACTICE_ROUNDS = 8;
// Endless mode and the daily challenge deliberately pull from every
// group combined, rather than picking one — see groups.js.
const ALL_GROUPS_POOL = { species: ALL_SPECIES, categories: ALL_CATEGORIES, label: "Alle dyr" };

// Lookup for resolving `confusedWith` ids into species — ids are
// unique across every group, so one combined map is safe.
const SPECIES_BY_ID = new Map(ALL_SPECIES.map((s) => [s.id, s]));

// "2026-09-12" -> "12/9-2026" — a compact, informal Danish date
// shorthand, so the daily challenge's header can show which day
// you're on/replaying without taking up much space.
function formatShortDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${day}/${month}-${year}`;
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

// A species with no photos yet still needs a "slot" so it can't be
// asked twice with the same placeholder — it's identified by its id
// instead of an image path.
function slotKey(species, image) {
  return image ?? `species:${species.id}`;
}

// Marks a species as asked at all this run, whichever photo was shown
// — what `uniqueSpecies` checks in buildRound.
function seenKey(species) {
  return `seen:${species.id}`;
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
// `uniqueSpecies` (endless mode) goes further: every species may only
// be asked once per run, whatever photos it has left, and each
// remaining species is equally likely.
//
// `allowExhaustedFallback` (default true) governs what happens once
// there's no legal non-repeat candidate left: classic mode's 20
// rounds never actually reach this (57 photos, one 20-round run), so
// it falls back to reusing the full species list as a safety net.
// Endless mode passes `false` instead, since for it this genuinely
// means "the run is over" — buildRound then returns null so the
// caller can end the game rather than silently reusing photos.
function buildRound(
  speciesPool,
  categoryPool,
  usedImages,
  lastSpeciesId,
  { allowExhaustedFallback = true, uniqueSpecies = false } = {}
) {
  const candidates = speciesPool.filter((s) =>
    uniqueSpecies ? !usedImages.has(seenKey(s)) : unusedImageCount(s, usedImages) > 0
  );
  let pool = candidates.filter((s) => s.id !== lastSpeciesId);
  const exhausted = pool.length === 0;
  if (exhausted && !allowExhaustedFallback) return null;
  if (exhausted) pool = speciesPool;
  const weightOf = (s) =>
    uniqueSpecies ? 1 : exhausted ? Math.max(s.images.length, 1) : unusedImageCount(s, usedImages);

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
  usedImages.add(seenKey(answer));

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

// Starts downloading and decoding a photo before it's on screen, so
// the next round appears instantly instead of loading in. The Image is
// held onto until it's ready so it can't be garbage-collected mid-way.
const preloading = new Map();
function preloadImage(src) {
  if (!src || preloading.has(src)) return;
  const img = new Image();
  img.src = src;
  preloading.set(src, img);
  img
    .decode()
    .catch(() => {})
    .finally(() => preloading.delete(src));
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

  // The backdrop is a blurred copy of the photo, only shown on desktop
  // (see Retro.css), where the whole photo is fitted into a wide frame.
  return (
    <>
      <div className="image-backdrop" style={{ backgroundImage: `url("${src}")` }} aria-hidden="true" />
      <img
        className="image"
        src={src}
        alt={species.name_da}
        onError={() => setFailed(true)}
      />
    </>
  );
}

// Streak fire escalates through 4 stages as you rack up correct
// answers in a row — a bigger flame is a nicer reward to chase than
// just a number going up. Tier boundaries live in points.js.
function streakIcon(streak) {
  return asset(`/streak-icons/streak-icon-${streakTier(streak) + 1}.png`);
}

// Answer grid always has 4 slots so the boxes never move, even when a
// category (like hundedyr, with only 2 species) has fewer real
// options — missing slots render as an empty, non-interactive cell.
const EMPTY_SLOTS = [0, 1, 2, 3];

// Desktop-only progress strip: one square per question in a fixed-length
// run — right, wrong, the current one, and those still to come.
function RunDots({ answerLog, total }) {
  return (
    <span className="run-dots" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => {
        const entry = answerLog[i];
        const state = entry ? (entry.wasCorrect ? "is-correct" : "is-wrong") : i === answerLog.length ? "is-current" : "";
        return <i key={i} className={`run-dot ${state}`} />;
      })}
    </span>
  );
}

// "Forveksles med" row inside the Kendetegn overlay: the species this
// one is most easily mixed up with, as small photo + name chips.
// Renders nothing when a species has no lookalikes.
function Lookalikes({ species }) {
  const lookalikes = (species.confusedWith ?? []).map((id) => SPECIES_BY_ID.get(id)).filter(Boolean);
  if (lookalikes.length === 0) return null;

  return (
    <div className="lookalikes">
      <p className="lookalikes-title">Forveksles med</p>
      <ul className="lookalikes-list">
        {lookalikes.map((s) => (
          <li key={s.id} className="lookalike-chip">
            {s.images[0] && <img src={thumb(s.images[0])} alt="" className="lookalike-thumb" />}
            <span>{s.name_da}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Small "did you know" box: weight, habitat, day/night activity, how
// common it is in Denmark (as a coloured dot count, top right), and
// whether it's native or introduced. Always mounted at a fixed size so
// it reserves its spot below the image from the very first render —
// `visible` just toggles opacity, so revealing it after answering
// never shifts anything below it.
function StatsBox({ species, visible }) {
  const biome = biomeOf(species);

  return (
    <div className={`stats-box ${visible ? "is-visible" : ""}`}>
      <div className="stats-title-row">
        <p className="stats-title">Fakta</p>
        <RarityDots rarity={species.rarity} />
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

// Endless mode's "how much of Denmark have you covered" bar: species
// cleared out of every species in the game, with a tick at your
// previous best so there's always a mark to beat. Shown thin above the
// photo while playing, and larger in the result pop-up.
function EndlessProgress({ cleared, best, large = false }) {
  const pct = (n) => `${Math.min(n / ENDLESS_TOTAL, 1) * 100}%`;
  return (
    <div className={`endless-progress ${large ? "is-large" : ""}`}>
      {large && (
        <div className="endless-progress-head">
          <span>Arter klaret</span>
          <span>
            {cleared} {cleared === 1 ? "art" : "arter"}
          </span>
        </div>
      )}
      <div
        className="endless-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={ENDLESS_TOTAL}
        aria-valuenow={cleared}
        aria-label="Arter klaret"
      >
        <div className="endless-progress-fill" style={{ width: pct(cleared) }} />
        {best > 0 && best < ENDLESS_TOTAL && (
          <span className="endless-progress-best" style={{ left: pct(best) }} title={`Rekord: ${best}`} />
        )}
      </div>
    </div>
  );
}

// Pixel sparkles scattered over the "completed" card: little plus-shaped
// stars that blink on and off at their own pace. Positions are fixed
// per mount so they don't jump around on re-render.
function PixelSparkles({ count = 28 }) {
  const sparkles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: [3, 4, 4, 5][i % 4],
        color: ["#ffd28a", "#fff4dc", "#9fe08a", "#ffb35c"][i % 4],
        delay: `${(Math.random() * 1.6).toFixed(2)}s`,
        duration: `${(0.9 + Math.random() * 0.9).toFixed(2)}s`,
      })),
    [count]
  );
  return (
    <div className="pixel-sparkles" aria-hidden="true">
      {sparkles.map((p) => (
        <i
          key={p.id}
          className="pixel-sparkle"
          style={{
            left: p.left,
            top: p.top,
            "--px": `${p.size}px`,
            "--c": p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

// The single end-of-run pop-up, shared by every mode instead of each
// mode having its own results treatment. `closing` swaps in the
// out-animation right before the popup actually unmounts, so
// dismissing it never feels abrupt.
//
// The second stat tile is contextual: classic/daily show "korrekte"
// (score/total, since they have a fixed length), endless shows its
// highscore instead. Endless also swaps the katalog for its progress
// bar, and gets a celebratory card of its own when every species was
// named without a single miss.
function ResultPopup({ result, score, streak, answerLog, closing, onExit, onRetry, onNext }) {
  const { mode, total, highscore } = result;
  const isEndless = mode === "endless";
  const isCompleted = isEndless && result.type === "completed";

  const isTrail = mode === "trail";
  const title = isCompleted
    ? "Completed!!!!"
    : isTrail
      ? result.passed
        ? result.isTest
          ? "Feltprøve bestået!"
          : "Trin gennemført!"
        : "Ikke bestået"
      : mode === "daily" || mode === "practice"
        ? "Completed!"
        : "Game Over!";

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

  return (
    <div className={`result-overlay ${closing ? "is-closing" : ""}`}>
      <div className={`result-modal ${closing ? "is-closing" : ""} ${isCompleted ? "is-completed" : ""}`}>
        {isCompleted && <PixelSparkles />}
        <span className="result-paw">🐾</span>

        {isCompleted && <span className="completed-trophy" aria-hidden="true">🏆</span>}
        <p className="result-title">{title}</p>
        <p className="result-subtitle">
          {isCompleted ? `Alle ${ENDLESS_TOTAL} arter — uden en eneste fejl` : result.subtitle}
          {result.isToday && <span className="new-tag">New</span>}
          {isEndless && !isCompleted && result.isNewHighscore && <span className="new-tag">Ny rekord</span>}
        </p>
        {isTrail && <Stars count={result.passed ? result.stars : 0} className="result-stars" />}
        {isTrail && !result.passed && (
          <p className="result-subtitle">Du skal have {Math.round(PASS_RATE * 100)} % rigtige for at bestå.</p>
        )}

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

        <button type="button" onClick={onNext} className="result-btn-next">
          <span className="result-btn-next-icon">▶</span>{" "}
          {isTrail
            ? result.passed
              ? "Videre ad sporet"
              : "Tilbage til sporet"
            : mode === "practice"
              ? "Tilbage til feltguiden"
              : isEndless
                ? "Ny runde"
                : "Næste"}
          <span className="result-key">Enter</span>
        </button>

        <div className="result-actions-row">
          <button type="button" onClick={onExit} className="result-btn-icon is-home" data-sound="home" aria-label="Til menu">
            🏠<span className="result-key">Esc</span>
          </button>
          <button type="button" onClick={onRetry} className="result-btn-icon is-retry" aria-label="Prøv igen">
            ↻<span className="result-key">R</span>
          </button>
        </div>
      </div>
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
    previousHighscore: Math.max(highscore - 7, 0),
    subtitle,
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
              {["lost", "completed"].map((t) => (
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
  const [screen, setScreen] = useState("menu"); // "menu" | "calendar" | "trail" | "guide" | "playing" | "devpreview"
  // Which category the field guide scrolls to when it opens — the one
  // just practised, or the weak spot the result pop-up's tip points at.
  const [guideFocus, setGuideFocus] = useState(null);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [mode, setMode] = useState("classic"); // "classic" | "endless" | "daily" | "trail" | "practice"
  // Which species/categories the current run draws from — one single
  // group for classic mode, or every group combined for endless/daily
  // (see ALL_GROUPS_POOL). Set fresh at the start of every run.
  const [pool, setPool] = useState({ species: GROUPS[0].species, categories: GROUPS[0].categories, label: GROUPS[0].name_da });
  const [round, setRound] = useState(() => buildRound(pool.species, pool.categories, usedImages.current));
  // Classic and endless pick each round at random, so the round after
  // the current one is picked as soon as the current one shows — same
  // rules, just earlier — letting its photo preload while you answer.
  // `after` is the round it follows; null `next` means endless ran out.
  const upcoming = useRef(null);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  // The highest streak reached this run — shown in the result pop-up
  // instead of the live `streak`, since that resets to 0 the instant
  // a wrong answer ends the run, which would otherwise erase a good
  // run's streak the moment it's most worth showing.
  const [bestStreak, setBestStreak] = useState(0);
  const [asked, setAsked] = useState(0);
  // The endless highscore as it stood when this run began — the
  // progress bar's "beat this" tick.
  const [endlessBest, setEndlessBest] = useState(getHighscore);
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
  // Vildtsporet: the step ("node") being played, its ordered list of
  // intro cards and questions (see buildTrailSteps), which one is
  // showing, and what the trail should animate when we return to it.
  const [trailNode, setTrailNode] = useState(null);
  const [trailSteps, setTrailSteps] = useState([]);
  const [trailStep, setTrailStep] = useState(0);
  const [trailCelebrate, setTrailCelebrate] = useState(null);
  const isIntro = mode === "trail" && trailSteps[trailStep]?.kind === "intro";
  const trailQuestionCount = trailSteps.filter((s) => s.kind === "question").length;

  const isAnswered = picked !== null;
  const runLength =
    mode === "classic"
      ? TOTAL_ROUNDS
      : mode === "practice"
        ? PRACTICE_ROUNDS
        : mode === "daily"
          ? DAILY_ROUNDS
          : mode === "trail"
            ? trailQuestionCount
            : null;
  const isLastQuestion =
    (mode === "classic" && asked >= TOTAL_ROUNDS) ||
    (mode === "practice" && asked >= PRACTICE_ROUNDS) ||
    (mode === "daily" && asked >= DAILY_ROUNDS) ||
    (mode === "trail" && trailStep >= trailSteps.length - 1);
  // Moving on from here ends the daily challenge, which plays its own
  // finish sound instead of the usual tap.
  const finishesDaily = mode === "daily" && isLastQuestion;
  const modeLabel =
    mode === "endless"
      ? "Endless"
      : mode === "daily"
        ? `Dagens udfordring · ${formatShortDate(dailyDate)}`
        : mode === "trail"
          ? `${trailNode.region.name} · ${NODE_LABEL[trailNode.t]}`
          : mode === "practice"
            ? `Feltguide · ${pool.label}`
            : pool.label;

  const handlePick = useCallback(
    (species) => {
      if (isAnswered) return;
      const wasCorrect = species.id === round.answer.id;
      playSound(wasCorrect ? "right" : "wrong");
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
      setGameResult({
        mode: "endless",
        type,
        score: finalScore,
        highscore: isNewHighscore ? finalScore : highscore,
        isNewHighscore,
        previousHighscore: highscore,
        subtitle: modeLabel,
      });
    },
    [modeLabel]
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

  // The round that follows `current` in classic/endless — picked once
  // and reused, so preloading and actually moving on agree on it.
  const upcomingAfter = useCallback(
    (current) => {
      if (upcoming.current?.after !== current) {
        const next = buildRound(pool.species, pool.categories, usedImages.current, current.answer.id, {
          allowExhaustedFallback: mode !== "endless",
          uniqueSpecies: mode === "endless",
        });
        upcoming.current = { after: current, next };
      }
      return upcoming.current.next;
    },
    [pool, mode]
  );

  // Preload the next round's photo while this one is being answered.
  // Daily and trail runs are built up front, so theirs is already known.
  useEffect(() => {
    if (screen !== "playing") return;
    let next = null;
    if (mode === "classic" || mode === "endless" || mode === "practice") next = upcomingAfter(round);
    else if (mode === "daily") next = dailyRounds[dailyRounds.indexOf(round) + 1];
    else if (mode === "trail") next = trailSteps[trailSteps.indexOf(round) + 1];
    preloadImage(next?.image);
  }, [screen, mode, round, dailyRounds, trailSteps, upcomingAfter]);

  const nextRound = useCallback(() => {
    if (mode === "endless") {
      if (picked !== round.answer.id) {
        endEndlessRun("lost", score);
        return;
      }
      const next = upcomingAfter(round);
      if (next === null) {
        endEndlessRun("completed", score);
        return;
      }
      setRound(next);
      setPicked(null);
      setShowKendetegn(false);
      setRoundIndex((n) => n + 1);
      return;
    }

    if (mode === "trail") {
      if (isLastQuestion) {
        // Only a Feltprøve can be failed; every other step always passes
        // and just earns 1–3 stars for how cleanly it went.
        const passed = trailNode.t !== "test" || score / trailQuestionCount >= PASS_RATE;
        const stars = starsFor(score, trailQuestionCount);
        if (passed) {
          const before = learnedSpecies(getTrailProgress());
          const after = learnedSpecies(saveNodeResult(trailNode.id, stars));
          setTrailCelebrate({ nodeId: trailNode.id, revealed: [...after].filter((id) => !before.has(id)) });
        }
        setGameResult({
          mode: "trail",
          type: "finished",
          score,
          total: trailQuestionCount,
          subtitle: modeLabel,
          passed,
          stars,
          isTest: trailNode.t === "test",
        });
        return;
      }
      setRound(trailSteps[trailStep + 1]);
      setTrailStep((n) => n + 1);
      setPicked(null);
      setShowKendetegn(false);
      setRoundIndex((n) => n + 1);
      return;
    }

    if (mode === "daily") {
      if (isLastQuestion) {
        saveDailyResult(dailyDate, { score, total: DAILY_ROUNDS });
        playSound(score === DAILY_ROUNDS ? "dailyPerfect" : "daily");
        setGameResult({
          mode: "daily",
          type: "finished",
          score,
          total: DAILY_ROUNDS,
          subtitle: modeLabel,
          isToday: dailyDate === todayDateString(),
        });
        return;
      }
      setRound(dailyRounds[asked]);
      setPicked(null);
      setShowKendetegn(false);
      setRoundIndex((n) => n + 1);
      return;
    }

    // classic / practice
    if (isLastQuestion) {
      setGameResult({
        mode,
        type: "finished",
        score,
        total: runLength,
        subtitle: modeLabel,
      });
      return;
    }
    setRound(upcomingAfter(round));
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
    upcomingAfter,
    modeLabel,
    runLength,
    trailNode,
    trailSteps,
    trailStep,
    trailQuestionCount,
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
    setEndlessBest(getHighscore());
    setScreen("playing");
  }, []);

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

  const startTrailNode = useCallback((node) => {
    const steps = buildTrailSteps(node, getTrailProgress());
    setMode("trail");
    setTrailNode(node);
    setTrailSteps(steps);
    setTrailStep(0);
    setTrailCelebrate(null);
    setRound(steps[0]);
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

  const openTrail = useCallback(() => {
    if (!TRAIL_ENABLED) return;
    setScreen("trail");
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

  const openGuide = useCallback((categoryId = null) => {
    setGuideFocus(categoryId);
    setScreen("guide");
  }, []);

  // Practice one category from the field guide: a short run on just
  // that group's species.
  const startPractice = useCallback(
    (categoryId) => {
      const category = ALL_CATEGORIES.find((c) => c.id === categoryId);
      const species = ALL_SPECIES.filter((s) => s.category === categoryId);
      setGuideFocus(categoryId);
      startGame("practice", { species, categories: [category], label: category.name_da });
    },
    [startGame]
  );

  // A miss ends an endless run — show the result by itself a moment
  // later (long enough to see which answer was right), rather than
  // waiting for "Se resultat" to be tapped.
  useEffect(() => {
    if (mode !== "endless" || !isAnswered || picked === round.answer.id || gameResult) return;
    const timer = setTimeout(nextRound, 1000);
    return () => clearTimeout(timer);
  }, [mode, isAnswered, picked, round, gameResult, nextRound]);

  // Whether this endless round's correct answer was the very last
  // species left — then moving on shows the "completed" card.
  const clearsEndless =
    mode === "endless" && isAnswered && picked === round.answer.id && upcomingAfter(round) === null;

  // Keys 1–4 answer, Enter/Space moves on. Skipped while a live button
  // has focus, so its own Enter/Space click doesn't fire twice.
  useEffect(() => {
    if (screen !== "playing" || gameResult) return;
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLButtonElement && !e.target.disabled && (e.key === "Enter" || e.key === " ")) return;
      const slot = ["1", "2", "3", "4"].indexOf(e.key);
      if (slot !== -1 && !isAnswered && !isIntro && round.options[slot]) {
        handlePick(round.options[slot]);
      } else if ((e.key === "Enter" || e.key === " ") && (isAnswered || isIntro)) {
        e.preventDefault();
        if (!finishesDaily) playSound("tap");
        nextRound();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, gameResult, isAnswered, isIntro, round, handlePick, nextRound, finishesDaily]);

  // Wraps a screen in the retro frame, whose nav highlights the
  // `active` mode — laid out for phones or wide screens.
  const frame = (children, active) => {
    const navigate = { menu: backToMenu, daily: openCalendar, trail: openTrail, endless: startEndless, guide: () => openGuide() };
    return (
      <Shell isDesktop={isDesktop} active={active} onNavigate={(id) => navigate[id]()} withIntro={screen === "menu"}>
        {children}
      </Shell>
    );
  };

  if (screen === "menu") {
    return frame(
      <Menu onOpenTrail={openTrail} onStartEndless={startEndless} onOpenDaily={openCalendar} onOpenGuide={() => openGuide()} />
    );
  }

  if (screen === "calendar") {
    return frame(<DailyCalendar onSelectDate={startDaily} onBack={backToMenu} />, "daily");
  }

  if (screen === "trail") {
    return frame(<Trail celebrate={trailCelebrate} onStartNode={startTrailNode} onBack={backToMenu} />, "trail");
  }

  if (screen === "guide") {
    return frame(<FieldGuide focusCategoryId={guideFocus} onPlayCategory={startPractice} />, "guide");
  }

  if (screen === "devpreview") {
    return <DevPreview onBack={backToMenu} />;
  }

  return frame(
    <div className="card quiz-card">
      <div className="quiz-body">
        <header className="header">
          <p className="eyebrow">{modeLabel}</p>
          {isDesktop && runLength > 0 && <RunDots answerLog={answerLog} total={runLength} />}
          {isDesktop && mode === "endless" && <EndlessProgress cleared={score} best={endlessBest} />}
          <div className="score">
            <img src={streakIcon(streak)} alt="" title={`Streak: ${streak}`} className="streak-icon" />
            <span className="score-progress">
              {mode === "endless"
                ? score
                : mode === "trail"
                  ? isIntro
                    ? "Ny art"
                    : `${Math.min(asked + 1, trailQuestionCount)}/${trailQuestionCount}`
                  : `${Math.min(asked + 1, runLength)}/${runLength}`}
            </span>
          </div>
        </header>
        {!isDesktop && mode === "endless" && <EndlessProgress cleared={score} best={endlessBest} />}

        <div key={roundIndex} className="question-card">
          <div className="image-frame">
            <AnimalImage key={round.image ?? round.answer.id} species={round.answer} src={round.image} />

            {!isIntro && (
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
            )}

            {isAnswered && (
              <div className={`kendetegn-overlay ${showKendetegn ? "is-open" : ""}`}>
                <p className="kendetegn-overlay-text">{round.answer.differentiator}</p>
                <Lookalikes species={round.answer} />
              </div>
            )}
          </div>

          <StatsBox species={round.answer} visible={isAnswered || isIntro} />

          {isIntro ? (
            <div className="trail-intro">
              <span className="trail-intro-tag">Ny art</span>
              <p className="trail-intro-name">{round.answer.name_da}</p>
              <p className="trail-intro-latin">{round.answer.latin}</p>
              <p className="trail-intro-text">{round.answer.differentiator}</p>
            </div>
          ) : (
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
                    data-sound="none"
                    className={`option ${extraClass}`}
                  >
                    {isDesktop && <span className="option-key">{slot + 1}</span>}
                    <span className="option-name">{s.name_da}</span>
                    <span className="option-sub">{s.name_en}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <img src={asset("/bottom-banner.png")} alt="" aria-hidden="true" className="bottom-banner" />

      {(isAnswered || isIntro) && (
        <button onClick={nextRound} className="next-button" data-sound={finishesDaily ? "none" : undefined}>
          {isIntro
            ? "Næste"
            : mode === "endless"
              ? picked === round.answer.id && !clearsEndless
                ? "Næste dyr"
                : "Se resultat"
              : isLastQuestion
                ? "Se resultat"
                : "Næste dyr"}
          {isDesktop && <span className="next-key">Enter</span>}
        </button>
      )}

      {gameResult && (
        <ResultPopup
          result={gameResult}
          score={score}
          streak={bestStreak}
          answerLog={answerLog}
          closing={resultClosing}
          onExit={() =>
            dismissResult(
              gameResult.mode === "daily"
                ? backToCalendar
                : gameResult.mode === "trail"
                  ? openTrail
                  : gameResult.mode === "practice"
                    ? () => openGuide(guideFocus)
                    : backToMenu
            )
          }
          onRetry={() =>
            dismissResult(
              gameResult.mode === "daily"
                ? () => startDaily(dailyDate)
                : gameResult.mode === "trail"
                  ? () => startTrailNode(trailNode)
                  : () => startGame(gameResult.mode, pool)
            )
          }
          onNext={() => {
            if (gameResult.mode === "trail") {
              dismissResult(openTrail);
              return;
            }
            if (gameResult.mode === "practice") {
              dismissResult(() => openGuide(guideFocus));
              return;
            }
            if (gameResult.mode !== "daily") {
              dismissResult(() => startGame(gameResult.mode, pool));
              return;
            }
            const next = findNextDailyDate(dailyDate);
            dismissResult(next ? () => startDaily(next) : backToCalendar);
          }}
        />
      )}
    </div>,
    mode === "practice" ? "guide" : mode
  );
}
