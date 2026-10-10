// Expert mode: a photo and a text box — no answer options, you type
// the name. A side game next to the main modes, opened from the bottom
// nav. The helping hand (see game/expert.js) works like a spell
// check: a near miss is swapped for its best guess in the box, and
// Enter again sends it. Anything it can't place is flagged once, and
// counts as a (wrong) answer if sent again unchanged.
import { useCallback, useEffect, useRef, useState } from "react";
import { ALL_CATEGORIES, ALL_SPECIES } from "../data/groups.js";
import { EXPERT_ROUNDS, readAnswer } from "../game/expert.js";
import { buildRound, preloadImage } from "../game/rounds.js";
import { track } from "../lib/analytics.js";
import { playSound } from "../lib/sound.js";
import AnimalImage from "../components/AnimalImage.jsx";
import ResultPopup from "../components/ResultPopup.jsx";
import RunDots from "../components/RunDots.jsx";

// How long an answered photo stays up before the next one comes in on
// its own — a little longer after a miss, to take in the right name.
const ADVANCE_AFTER = { right: 1200, wrong: 2000 };

// The whole run is picked up front — every species at most once — so
// each next photo can preload while the current one is answered.
function buildRun() {
  const used = new Set();
  const rounds = [];
  for (let i = 0; i < EXPERT_ROUNDS; i++) {
    const round = buildRound(ALL_SPECIES, ALL_CATEGORIES, used, rounds[i - 1]?.answer.id, {
      uniqueSpecies: true,
      allowExhaustedFallback: false,
    });
    if (!round) break;
    rounds.push(round);
  }
  return rounds;
}

export default function ExpertQuiz({ isDesktop, onExit }) {
  const [rounds, setRounds] = useState(buildRun);
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  // What the helping hand made of the last submit, and the text it was
  // for (see readAnswer). Cleared as soon as you type again.
  const [hint, setHint] = useState(null);
  // Set once this photo is answered: the species named, or null when
  // the text sent wasn't one (then `typed` says what it was) or the
  // photo was skipped (no `typed`).
  const [answer, setAnswer] = useState(null);
  const [answerLog, setAnswerLog] = useState([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [result, setResult] = useState(null);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef(null);
  const nextRef = useRef(null);

  const round = rounds[index];
  const score = answerLog.filter((e) => e.wasCorrect).length;
  const isAnswered = answer !== null;
  const isLast = index === rounds.length - 1;

  useEffect(() => {
    track("start-expert");
  }, []);

  useEffect(() => {
    preloadImage(rounds[index + 1]?.image);
  }, [rounds, index]);

  // Typing goes straight into the box on every new photo; once it's
  // answered, focus moves to "next" so Enter carries on.
  useEffect(() => {
    if (result) return;
    (isAnswered ? nextRef : inputRef).current?.focus();
  }, [isAnswered, index, result]);

  const submitAnswer = useCallback(
    (species, typed) => {
      if (isAnswered) return;
      const wasCorrect = species?.id === round.answer.id;
      playSound(wasCorrect ? "right" : "wrong");
      setAnswer({ species, typed });
      setHint(null);
      setAnswerLog((log) => [...log, { species: round.answer, image: round.image, wasCorrect }]);
      setStreak((s) => {
        const next = wasCorrect ? s + 1 : 0;
        setBestStreak((best) => Math.max(best, next));
        return next;
      });
    },
    [isAnswered, round]
  );

  const onSubmit = (e) => {
    e.preventDefault();
    const read = readAnswer(text);
    if (read.kind === "exact") {
      submitAnswer(read.species);
      return;
    }
    if (read.kind === "empty") return;
    // Flagged already and sent again as is: that's the answer, then.
    if (hint && hint.text === text) {
      submitAnswer(null, text.trim());
      return;
    }
    playSound("tap");
    if (read.kind === "suggest") {
      setHint({ ...read, typed: text.trim(), text: read.species.name_da });
      setText(read.species.name_da);
    } else {
      setHint({ ...read, text });
    }
  };

  const next = () => {
    if (isLast) {
      // Let the pop-up's own Enter shortcut have the key from here.
      nextRef.current?.blur();
      setResult({ mode: "expert", type: "finished", total: rounds.length, subtitle: "Ekspert" });
      return;
    }
    setIndex((i) => i + 1);
    setAnswer(null);
    setText("");
  };

  const restart = () => {
    setClosing(true);
    setTimeout(() => {
      track("start-expert");
      setRounds(buildRun());
      setIndex(0);
      setText("");
      setHint(null);
      setAnswer(null);
      setAnswerLog([]);
      setStreak(0);
      setBestStreak(0);
      setResult(null);
      setClosing(false);
    }, 220);
  };

  const leave = () => {
    setClosing(true);
    setTimeout(onExit, 220);
  };

  const wasCorrect = answerLog[index]?.wasCorrect;
  const advanceAfter = wasCorrect ? ADVANCE_AFTER.right : ADVANCE_AFTER.wrong;

  // Move on by itself once answered. `next` is read through a ref so
  // re-renders in the meantime don't restart the countdown.
  const nextLatest = useRef(next);
  nextLatest.current = next;
  useEffect(() => {
    if (!isAnswered || result) return;
    const timer = setTimeout(() => nextLatest.current(), advanceAfter);
    return () => clearTimeout(timer);
  }, [isAnswered, result, advanceAfter]);

  return (
    <div className="card quiz-card expert-card">
      <div className="quiz-body">
        <header className="header">
          <p className="eyebrow">Ekspert</p>
          {isDesktop && <RunDots answerLog={answerLog} total={rounds.length} />}
          <div className="score">
            <span className="score-progress">
              {index + 1}/{rounds.length}
            </span>
          </div>
        </header>

        <div key={index} className="question-card">
          <div className={`image-frame ${isAnswered ? (wasCorrect ? "is-correct" : "is-wrong") : ""}`}>
            <AnimalImage key={round.image ?? round.answer.id} species={round.answer} src={round.image} />
            {isAnswered && (
              <span className="expert-stamp" aria-hidden="true">
                {wasCorrect ? "✓" : "✕"}
              </span>
            )}
          </div>
        </div>

        {/* Fills the space the Fakta box and answer grid take in the
            other modes, so the photo is the same size here. Holds the
            helping hand while typing, and what the photo was after. */}
        <div className="expert-deck" aria-live="polite">
          {isAnswered && (
            <div className={`expert-reveal ${wasCorrect ? "is-correct" : "is-wrong"}`}>
              <p className="expert-reveal-verdict">
                {wasCorrect ? "✓ Korrekt" : answer.species || answer.typed
                    ? `✕ Ikke ${answer.species?.name_da ?? `“${answer.typed}”`}`
                    : "✕ Sprunget over"}
              </p>
              <p className="expert-reveal-name">
                {round.answer.name_da}
                <span className="expert-reveal-latin">{round.answer.latin}</span>
              </p>
              <p className="expert-reveal-tip">{round.answer.differentiator}</p>
            </div>
          )}
          {hint && (
            <div key={hint.text} className="expert-hint">
              {hint.kind === "suggest" ? (
                <p className="expert-hint-main">
                  “{hint.typed}” <span className="expert-hint-arrow">→</span>{" "}
                  <span className="expert-hint-guess">“{hint.species.name_da}”</span>
                </p>
              ) : (
                <p className="expert-hint-main">
                  {hint.kind === "vague" ? "Passer på flere arter — vær mere præcis" : "Kender ingen art ved det navn"}
                </p>
              )}
              <p className="expert-hint-sub">
                {hint.kind === "suggest" ? "Enter igen for at svare · eller ret" : "Ret svaret · eller Enter igen for at svare alligevel"}
              </p>
            </div>
          )}
        </div>
      </div>

      {isAnswered ? (
        <button
          ref={nextRef}
          type="button"
          className={`next-button expert-advance ${result ? "" : "is-counting"}`}
          style={{ "--advance-after": `${advanceAfter}ms` }}
          onClick={next}
        >
          {isLast ? "Se resultat" : "Næste billede"}
          {isDesktop && <span className="next-key">Enter</span>}
        </button>
      ) : (
        <form className="expert-bar" onSubmit={onSubmit}>
          <button type="button" className="expert-skip" data-sound="none" onClick={() => submitAnswer(null)}>
            Skip
          </button>
          <input
            ref={inputRef}
            className="expert-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setHint(null);
            }}
            placeholder="skriv artens navn…"
            aria-label="Artens navn"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
          />
          <button type="submit" className="expert-submit" data-sound="none">
            Svar
          </button>
        </form>
      )}

      {result && (
        <ResultPopup
          result={result}
          score={score}
          streak={bestStreak}
          answerLog={answerLog}
          closing={closing}
          onExit={leave}
          onRetry={restart}
          onNext={restart}
          onOpenGuide={() => {}}
        />
      )}
    </div>
  );
}
