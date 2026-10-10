// Expert mode: a photo and a text box — no answer options, you type
// the name. A side game next to the main modes, opened from the bottom
// nav. While typing, the helping hand (see game/expert.js) offers
// "did you mean…?" picks for near misses; only a recognised species
// name counts as an answer.
import { useCallback, useEffect, useRef, useState } from "react";
import { ALL_CATEGORIES, ALL_SPECIES } from "../data/groups.js";
import { EXPERT_ROUNDS, readAnswer } from "../game/expert.js";
import { buildRound, preloadImage } from "../game/rounds.js";
import { track } from "../lib/analytics.js";
import { playSound } from "../lib/sound.js";
import AnimalImage from "../components/AnimalImage.jsx";
import ResultPopup from "../components/ResultPopup.jsx";
import RunDots from "../components/RunDots.jsx";

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
  // What the helping hand made of the last submit: suggestions, or
  // "no species by that name". Cleared as soon as you type again.
  const [hint, setHint] = useState(null);
  // Set once this photo is answered: what was picked (null = gave up).
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
    (species) => {
      if (isAnswered) return;
      const wasCorrect = species?.id === round.answer.id;
      playSound(wasCorrect ? "right" : "wrong");
      setAnswer({ species });
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
    playSound("tap");
    setHint(read);
  };

  const next = () => {
    if (isLast) {
      // Let the pop-up's own Enter shortcut have the key from here.
      nextRef.current?.blur();
      setResult({ mode: "expert", type: "finished", total: rounds.length, subtitle: "Ekspert · skriv navnet" });
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

  // With suggestions showing, the number keys pick one — names never
  // contain digits, so the box loses nothing.
  const onInputKeyDown = (e) => {
    if (hint?.kind !== "suggest") return;
    const pick = hint.suggestions[Number(e.key) - 1];
    if (pick) {
      e.preventDefault();
      submitAnswer(pick);
    }
  };

  const wasCorrect = answerLog[index]?.wasCorrect;

  return (
    <div className="card quiz-card expert-card">
      <div className="quiz-body">
        <header className="header">
          <p className="eyebrow">Ekspert · skriv navnet</p>
          {isDesktop && <RunDots answerLog={answerLog} total={rounds.length} />}
          <div className="score">
            <span className="score-progress">
              {index + 1}/{rounds.length}
            </span>
          </div>
        </header>

        <div key={index} className="question-card">
          <div className="image-frame">
            <AnimalImage key={round.image ?? round.answer.id} species={round.answer} src={round.image} />
            {isAnswered && (
              <div className={`expert-reveal ${wasCorrect ? "is-correct" : "is-wrong"}`}>
                <p className="expert-reveal-verdict">
                  {wasCorrect ? "✓ Korrekt" : answer.species ? `✕ Ikke ${answer.species.name_da}` : "✕ Sprunget over"}
                </p>
                <p className="expert-reveal-name">
                  {round.answer.name_da}
                  <span className="expert-reveal-latin">{round.answer.latin}</span>
                </p>
                <p className="expert-reveal-tip">{round.answer.differentiator}</p>
              </div>
            )}
          </div>
        </div>

        <div className="expert-hint" aria-live="polite">
          {hint?.kind === "suggest" && (
            <>
              <span className="expert-hint-label">Mente du</span>
              {hint.suggestions.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className="expert-suggestion"
                  data-sound="none"
                  onClick={() => submitAnswer(s)}
                >
                  {isDesktop && <span className="expert-suggestion-key">{i + 1}</span>}
                  {s.name_da}?
                </button>
              ))}
              {hint.more && <span className="expert-hint-label">… eller vær mere præcis</span>}
            </>
          )}
          {hint?.kind === "unknown" && (
            <span key={text} className="expert-hint-label is-unknown">
              Kender ingen art ved det navn — prøv igen
            </span>
          )}
          {!hint && !isAnswered && (
            <span className="expert-hint-label is-idle">Stavefejl er ok — vi hjælper dig på vej</span>
          )}
        </div>

        {isAnswered ? (
          <button ref={nextRef} type="button" className="expert-next" onClick={next}>
            {isLast ? "Se resultat" : "Næste billede"}
            {isDesktop && <span className="next-key">Enter</span>}
          </button>
        ) : (
          <form className="expert-bar" onSubmit={onSubmit}>
            <button
              type="button"
              className="expert-skip"
              data-sound="none"
              onClick={() => submitAnswer(null)}
              title="Ved ikke — vis svaret"
            >
              Ved ikke
            </button>
            <input
              ref={inputRef}
              className="expert-input"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setHint(null);
              }}
              onKeyDown={onInputKeyDown}
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
      </div>

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
