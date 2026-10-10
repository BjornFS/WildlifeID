import { ENDLESS_TOTAL } from "../game/endless.js";

// Endless mode's "how much of Denmark have you covered" bar: species
// cleared out of every species in the game, with a tick at your
// previous best so there's always a mark to beat. Shown thin above the
// photo while playing, and larger in the result pop-up.
export default function EndlessProgress({ cleared, best, large = false }) {
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
