import { useState, useCallback, useRef } from "react";
import GROUPS, { ALL_SPECIES, ALL_CATEGORIES } from "./groups.js";
import BIOMES from "./biomes.js";
import Menu from "./Menu.jsx";
import Scorecard from "./Scorecard.jsx";
import DailyCalendar from "./DailyCalendar.jsx";
import { DAILY_ROUNDS, saveDailyResult, speciesForDate } from "./dailyChallenge.js";

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

// Per-species stats, e.g. { raadyr: { correct: 3, total: 4 }, ... }.
// Used at the end of the game to show what you're good at. Scoped to
// whichever species pool is actually in play for the current run.
function emptyTally(speciesPool) {
  return Object.fromEntries(speciesPool.map((s) => [s.id, { correct: 0, total: 0 }]));
}

// Streak fire escalates through 4 stages as you rack up correct
// answers in a row — a bigger flame is a nicer reward to chase than
// just a number going up.
function streakIcon(streak) {
  if (streak >= 10) return "/streak-icons/streak-icon-4.png";
  if (streak >= 5) return "/streak-icons/streak-icon-3.png";
  if (streak >= 3) return "/streak-icons/streak-icon-2.png";
  return "/streak-icons/streak-icon-1.png";
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

export default function App() {
  const usedImages = useRef(new Set());
  const [screen, setScreen] = useState("menu"); // "menu" | "calendar" | "playing" | "results"
  const [mode, setMode] = useState("classic"); // "classic" | "endless" | "daily"
  // Which species/categories the current run draws from — one single
  // group for classic mode, or every group combined for endless/daily
  // (see ALL_GROUPS_POOL). Set fresh at the start of every run.
  const [pool, setPool] = useState({ species: GROUPS[0].species, categories: GROUPS[0].categories, label: GROUPS[0].name_da });
  const [round, setRound] = useState(() => buildRound(pool.species, pool.categories, usedImages.current));
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [asked, setAsked] = useState(0);
  const [tally, setTally] = useState(() => emptyTally(pool.species));
  const [showKendetegn, setShowKendetegn] = useState(false);
  // Bumped on every new round — used as a React key to remount the
  // question card, which is what triggers its CSS entrance animation.
  const [roundIndex, setRoundIndex] = useState(0);
  // Set once an endless run ends (wrong answer, or the photo pool ran
  // dry) — drives the endless result pop-up. null while still playing.
  const [endlessResult, setEndlessResult] = useState(null);
  // The current daily challenge's 10 precomputed questions, and which
  // date they belong to (so the result can be saved under that date).
  const [dailyRounds, setDailyRounds] = useState([]);
  const [dailyDate, setDailyDate] = useState(null);

  const isAnswered = picked !== null;
  const isLastQuestion =
    (mode === "classic" && asked >= TOTAL_ROUNDS) || (mode === "daily" && asked >= DAILY_ROUNDS);

  const handlePick = useCallback(
    (species) => {
      if (isAnswered) return;
      const wasCorrect = species.id === round.answer.id;
      setPicked(species.id);
      setAsked((n) => n + 1);
      if (wasCorrect) {
        setScore((s) => s + 1);
        setStreak((s) => s + 1);
      } else {
        setStreak(0);
      }
      setTally((t) => ({
        ...t,
        [round.answer.id]: {
          correct: t[round.answer.id].correct + (wasCorrect ? 1 : 0),
          total: t[round.answer.id].total + 1,
        },
      }));
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
      setEndlessResult({ type, finalScore, highscore: isNewHighscore ? finalScore : highscore, isNewHighscore });
    },
    []
  );

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
        setScreen("results");
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
      setScreen("results");
      return;
    }
    setRound(buildRound(pool.species, pool.categories, usedImages.current, round.answer.id));
    setPicked(null);
    setShowKendetegn(false);
    setRoundIndex((n) => n + 1);
  }, [mode, isLastQuestion, picked, round, score, endEndlessRun, dailyRounds, dailyDate, asked, pool]);

  const startGame = useCallback((selectedMode, activePool) => {
    usedImages.current = new Set();
    setMode(selectedMode);
    setPool(activePool);
    setRound(buildRound(activePool.species, activePool.categories, usedImages.current));
    setPicked(null);
    setScore(0);
    setStreak(0);
    setAsked(0);
    setTally(emptyTally(activePool.species));
    setShowKendetegn(false);
    setRoundIndex(0);
    setEndlessResult(null);
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
    setAsked(0);
    setTally(emptyTally(ALL_GROUPS_POOL.species));
    setShowKendetegn(false);
    setRoundIndex(0);
    setEndlessResult(null);
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

  if (screen === "menu") {
    return (
      <div className="page">
        <Menu onStart={startClassic} onStartEndless={startEndless} onOpenDaily={openCalendar} />
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

  if (screen === "results") {
    return (
      <div className="page">
        <Scorecard
          score={score}
          total={mode === "daily" ? DAILY_ROUNDS : TOTAL_ROUNDS}
          tally={tally}
          species={pool.species}
          categories={pool.categories}
          groupLabel={pool.label}
          onBackToMenu={mode === "daily" ? backToCalendar : backToMenu}
          backLabel={mode === "daily" ? "Tilbage til kalender" : "Tilbage til menu"}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <div className="quiz-body">
          <header className="header">
            <p className="eyebrow">
              {pool.label}
              {mode === "endless" ? " · Endless" : mode === "daily" ? " · Dagens udfordring" : ""}
            </p>
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

        {endlessResult && (
          <div className="endless-overlay">
            <div className="endless-modal">
              <p className={`endless-modal-headline ${endlessResult.type === "exhausted" ? "is-exhausted" : "is-lost"}`}>
                {endlessResult.type === "exhausted" ? "DIN VIDEN ER ENDELØS" : "Du tabte!"}
              </p>
              {endlessResult.type === "exhausted" && (
                <p className="endless-modal-sub">Du har set alle billeder i spillet.</p>
              )}
              <p className="endless-modal-score">{endlessResult.finalScore}</p>
              <p className="endless-modal-score-label">rigtige i træk</p>
              <p className="endless-modal-highscore">
                {endlessResult.isNewHighscore ? "🎉 Ny highscore!" : `Highscore: ${endlessResult.highscore}`}
              </p>
              <button onClick={backToMenu} className="next-button">
                Tilbage til menu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
