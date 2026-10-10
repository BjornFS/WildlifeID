// The app: which screen is showing, the state of the current run, and
// the quiz screen itself. Rules live in game/, data in data/, and the
// other screens and pieces in screens/ and components/.
import { useState, useCallback, useRef, useEffect } from "react";
import { ALL_SPECIES, ALL_CATEGORIES } from "./data/groups.js";
import { DAILY_ROUNDS, findNextDailyDate, saveDailyResult, speciesForDate, todayDateString } from "./game/dailyChallenge.js";
import { getHighscore, setHighscore } from "./game/endless.js";
import { shuffle } from "./game/options.js";
import { buildRound, buildDailyRoundFor, preloadImage } from "./game/rounds.js";
import { formatShortDate } from "./game/stats.js";
import { asset } from "./lib/asset.js";
import { track } from "./lib/analytics.js";
import { playSound } from "./lib/sound.js";
import { DESKTOP_QUERY, useMediaQuery } from "./lib/useMediaQuery.js";
import Shell from "./components/Shell.jsx";
import AnimalImage from "./components/AnimalImage.jsx";
import EndlessProgress from "./components/EndlessProgress.jsx";
import Lookalikes from "./components/Lookalikes.jsx";
import ResultPopup from "./components/ResultPopup.jsx";
import RunDots from "./components/RunDots.jsx";
import StatsBox from "./components/StatsBox.jsx";
import Menu from "./screens/Menu.jsx";
import DailyCalendar from "./screens/DailyCalendar.jsx";
import FieldGuide from "./screens/FieldGuide.jsx";
import ExpertQuiz from "./screens/ExpertQuiz.jsx";

// A practice run on one category, started from the field guide.
const PRACTICE_ROUNDS = 8;
// Endless mode and the daily challenge deliberately pull from every
// group combined, rather than picking one — see groups.js.
const ALL_GROUPS_POOL = { species: ALL_SPECIES, categories: ALL_CATEGORIES, label: "Alle dyr" };

// Streak fire escalates through 4 stages as you rack up correct
// answers in a row — a bigger flame is a nicer reward to chase than
// just a number going up: 3, 5 and 10 in a row.
function streakIcon(streak) {
  const tier = streak >= 10 ? 4 : streak >= 5 ? 3 : streak >= 3 ? 2 : 1;
  return asset(`/streak-icons/streak-icon-${tier}.png`);
}

// Answer grid always has 4 slots so the boxes never move, even when a
// category (like hundedyr, with only 2 species) has fewer real
// options — missing slots render as an empty, non-interactive cell.
const EMPTY_SLOTS = [0, 1, 2, 3];

export default function App() {
  const usedImages = useRef(new Set());
  const [screen, setScreen] = useState("menu"); // "menu" | "calendar" | "guide" | "expert" | "playing"
  // Bumped each time expert mode is opened, so opening it again from
  // its own nav chip starts a fresh run.
  const [expertRun, setExpertRun] = useState(0);
  // Which category the field guide scrolls to when it opens — the one
  // just practised, or the weak spot the result pop-up's tip points at.
  const [guideFocus, setGuideFocus] = useState(null);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [mode, setMode] = useState("endless"); // "endless" | "daily" | "practice"
  // Which species/categories the current run draws from — one category
  // for practice, or every group combined for endless/daily (see
  // ALL_GROUPS_POOL). Set fresh at the start of every run.
  const [pool, setPool] = useState(ALL_GROUPS_POOL);
  const [round, setRound] = useState(() => buildRound(pool.species, pool.categories, usedImages.current));
  // Endless and practice pick each round at random, so the round after
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
  useEffect(() => {
    if (gameResult) track(`finish-${gameResult.mode}`);
  }, [gameResult]);
  // Which screens get visited (menu is the landing page, already a pageview).
  useEffect(() => {
    if (screen === "guide" || screen === "calendar") track(`open-${screen}`);
  }, [screen]);
  // Every question answered this run — species, photo shown, and
  // whether you got it right — for the result pop-up's "Katalog"
  // gallery (the whole run, not just a highlight reel).
  const [answerLog, setAnswerLog] = useState([]);
  // The current daily challenge's 10 precomputed questions, and which
  // date they belong to (so the result can be saved under that date).
  const [dailyRounds, setDailyRounds] = useState([]);
  const [dailyDate, setDailyDate] = useState(null);

  const isAnswered = picked !== null;
  // Endless has no fixed length.
  const runLength = mode === "practice" ? PRACTICE_ROUNDS : mode === "daily" ? DAILY_ROUNDS : null;
  const isLastQuestion = runLength !== null && asked >= runLength;
  // Moving on from here ends the daily challenge, which plays its own
  // finish sound instead of the usual tap.
  const finishesDaily = mode === "daily" && isLastQuestion;
  const modeLabel =
    mode === "endless"
      ? "Endless"
      : mode === "daily"
        ? `Dagens udfordring · ${formatShortDate(dailyDate)}`
        : `Feltguide · ${pool.label}`;

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

  // The round that follows `current` in endless/practice — picked once
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
  // Daily runs are built up front, so theirs is already known.
  useEffect(() => {
    if (screen !== "playing") return;
    const next = mode === "daily" ? dailyRounds[dailyRounds.indexOf(round) + 1] : upcomingAfter(round);
    preloadImage(next?.image);
  }, [screen, mode, round, dailyRounds, upcomingAfter]);

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
          date: dailyDate,
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

    // practice
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
  ]);

  const startGame = useCallback((selectedMode, activePool) => {
    track(`start-${selectedMode}`);
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
    track(dateStr === todayDateString() ? "start-daily" : "start-daily-past");
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

  const openGuide = useCallback((categoryId = null) => {
    setGuideFocus(categoryId);
    setScreen("guide");
  }, []);

  const openExpert = useCallback(() => {
    setExpertRun((n) => n + 1);
    setScreen("expert");
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
      if (slot !== -1 && !isAnswered && round.options[slot]) {
        handlePick(round.options[slot]);
      } else if ((e.key === "Enter" || e.key === " ") && isAnswered) {
        e.preventDefault();
        if (!finishesDaily) playSound("tap");
        nextRound();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, gameResult, isAnswered, round, handlePick, nextRound, finishesDaily]);

  // Wraps a screen in the retro frame, whose nav highlights the
  // `active` mode — laid out for phones or wide screens.
  const frame = (children, active) => {
    const navigate = {
      menu: backToMenu,
      daily: openCalendar,
      endless: startEndless,
      guide: () => openGuide(),
      expert: openExpert,
    };
    return (
      <Shell isDesktop={isDesktop} active={active} onNavigate={(id) => navigate[id]()} withIntro={screen === "menu"}>
        {children}
      </Shell>
    );
  };

  if (screen === "menu") {
    return frame(
      <Menu
        onStartEndless={startEndless}
        onOpenDaily={openCalendar}
        onStartTodaysDaily={() => startDaily(todayDateString())}
        onOpenGuide={() => openGuide()}
      />
    );
  }

  if (screen === "calendar") {
    return frame(<DailyCalendar onSelectDate={startDaily} onBack={backToMenu} />, "daily");
  }

  if (screen === "expert") {
    return frame(<ExpertQuiz key={expertRun} isDesktop={isDesktop} onExit={backToMenu} />, "expert");
  }

  if (screen === "guide") {
    return frame(<FieldGuide focusCategoryId={guideFocus} onPlayCategory={startPractice} />, "guide");
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
              {mode === "endless" ? score : `${Math.min(asked + 1, runLength)}/${runLength}`}
            </span>
          </div>
        </header>
        {!isDesktop && mode === "endless" && <EndlessProgress cleared={score} best={endlessBest} />}

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
                <Lookalikes species={round.answer} />
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
        </div>
      </div>

      <img src={asset("/bottom-banner.png")} alt="" aria-hidden="true" className="bottom-banner" />

      {isAnswered && (
        <button onClick={nextRound} className="next-button" data-sound={finishesDaily ? "none" : undefined}>
          {mode === "endless"
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
                : gameResult.mode === "practice"
                  ? () => openGuide(guideFocus)
                  : backToMenu
            )
          }
          onOpenGuide={(categoryId) => dismissResult(() => openGuide(categoryId))}
          onRetry={() =>
            dismissResult(
              gameResult.mode === "daily" ? () => startDaily(dailyDate) : () => startGame(gameResult.mode, pool)
            )
          }
          onNext={() => {
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
