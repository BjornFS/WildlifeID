// Desktop-only progress strip: one square per question in a fixed-length
// run — right, wrong, the current one, and those still to come.
export default function RunDots({ answerLog, total }) {
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
