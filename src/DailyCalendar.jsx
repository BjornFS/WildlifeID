import { useEffect, useRef, useState } from "react";
import { DAILY_START_DATE, getDailyResults, todayDateString } from "./dailyChallenge.js";

const MONTH_NAMES_DA = [
  "Januar",
  "Februar",
  "Marts",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "December",
];
const WEEKDAY_LABELS_DA = ["M", "T", "O", "T", "F", "L", "S"];

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Monday-first weekday index (0 = Mon .. 6 = Sun) for the 1st of the
// month — JS's own getDay() is Sunday-first (0 = Sun .. 6 = Sat).
function firstWeekdayIndex(year, month) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

export default function DailyCalendar({ onSelectDate, onBack }) {
  const today = todayDateString();
  const [todayYear, todayMonthNum] = today.split("-").map(Number);
  const todayMonth = todayMonthNum - 1;

  const startYear = Number(DAILY_START_DATE.slice(0, 4));
  const startMonth = Number(DAILY_START_DATE.slice(5, 7)) - 1;

  // Read once per mount — freshly re-read every time this screen
  // opens, which is exactly when a just-cleared day needs to show up.
  const [results] = useState(() => getDailyResults());
  const [view, setView] = useState({ year: todayYear, month: todayMonth });
  // Which way the last month change went — drives which slide-in
  // direction plays, so flipping forward/back reads like flicking
  // through physical calendar pages instead of an instant swap.
  const [direction, setDirection] = useState("next");

  const atStart = view.year === startYear && view.month === startMonth;
  const atEnd = view.year === todayYear && view.month === todayMonth;

  function goPrev() {
    if (atStart) return;
    setDirection("prev");
    setView((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }));
  }

  function goNext() {
    if (atEnd) return;
    setDirection("next");
    setView((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }));
  }

  // Enter plays today, ← / → flip months. Skipped while a live button
  // has focus, so its own Enter click doesn't fire twice.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement && !e.target.disabled)) onSelectDate(today);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Touch swipe between months. The month content follows the finger
  // (with rubber-band resistance past the first/last month); a long
  // enough drag or a quick flick throws the old month out the way it
  // was pushed, and the new one then slides in via the usual animation.
  // Transforms are written straight to the element so dragging doesn't
  // re-render the grid on every touchmove.
  const contentRef = useRef(null);
  const swipe = useRef(null);
  const suppressClickUntil = useRef(0);

  function setContentStyle(transform, opacity, transition) {
    const el = contentRef.current;
    if (!el) return;
    el.style.animation = "none";
    el.style.transition = transition;
    el.style.transform = transform;
    el.style.opacity = opacity;
  }

  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY, t: performance.now(), dx: 0, axis: null };
  }

  function onTouchMove(e) {
    const s = swipe.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (s.axis !== "x") return;
    const blocked = (dx > 0 && atStart) || (dx < 0 && atEnd);
    s.dx = blocked ? dx * 0.25 : dx;
    setContentStyle(`translateX(${s.dx}px)`, "", "none");
  }

  function onTouchEnd() {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.axis !== "x") return;
    // A horizontal drag shouldn't also count as a tap on the day under
    // the finger when it lifts.
    suppressClickUntil.current = performance.now() + 400;

    const width = contentRef.current?.offsetWidth || 300;
    const velocity = s.dx / Math.max(1, performance.now() - s.t);
    const flick = Math.abs(velocity) > 0.5 && Math.abs(s.dx) > 30;
    const goingNext = s.dx < 0;
    const allowed = goingNext ? !atEnd : !atStart;

    if (allowed && (flick || Math.abs(s.dx) > width * 0.25)) {
      setContentStyle(`translateX(${goingNext ? -width * 0.4 : width * 0.4}px)`, "0", "transform 0.14s ease-in, opacity 0.14s ease-in");
      setTimeout(() => (goingNext ? goNext() : goPrev()), 140);
    } else {
      setContentStyle("translateX(0)", "", "transform 0.2s ease-out");
    }
  }

  const monthKey = `${view.year}-${view.month}`;

  const numDays = daysInMonth(view.year, view.month);
  const leadingBlanks = firstWeekdayIndex(view.year, view.month);
  const cells = [...Array(leadingBlanks).fill(null), ...Array.from({ length: numDays }, (_, i) => i + 1)];

  return (
    <div
      className="card calendar-card"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onClickCapture={(e) => {
        if (performance.now() < suppressClickUntil.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <header className="header">
        <div>
          <p className="eyebrow">Daglig udfordring</p>
        </div>
      </header>

      <div className="calendar-nav">
        <div className="calendar-nav-pill">
          <button type="button" onClick={goPrev} disabled={atStart} className="calendar-nav-btn" aria-label="Forrige måned">
            ‹
          </button>
          <p className="calendar-month-label">
            <span key={monthKey} className={`calendar-month-label-text calendar-slide-${direction}`}>
              {MONTH_NAMES_DA[view.month]} {view.year}
            </span>
          </p>
          <button type="button" onClick={goNext} disabled={atEnd} className="calendar-nav-btn" aria-label="Næste måned">
            ›
          </button>
        </div>
      </div>

      <div key={monthKey} ref={contentRef} className={`calendar-month-content calendar-slide-${direction}`}>
        <div className="calendar-days">
          <div className="calendar-weekdays">
            {WEEKDAY_LABELS_DA.map((d, i) => (
              <span key={i} className="calendar-weekday">
                {d}
              </span>
            ))}
          </div>

          <div className="calendar-grid">
            {cells.map((day, i) => {
              if (day === null) return <div key={`blank-${i}`} className="calendar-cell calendar-cell-empty" />;

              const dateStr = `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isFuture = dateStr > today;
              const isToday = dateStr === today;
              const result = results[dateStr];
              const isPerfect = result && result.score === result.total;

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={isFuture}
                  onClick={() => onSelectDate(dateStr)}
                  className={`calendar-cell calendar-day ${result ? (isPerfect ? "is-perfect" : "is-completed") : ""} ${
                    isToday ? "is-today" : ""
                  } ${isFuture ? "is-future" : ""}`}
                >
                  {isToday && <span className="new-tag">New</span>}
                  <span className="calendar-day-num">{day}</span>
                  {result && <span className="calendar-day-check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button onClick={onBack} className="next-button" data-sound="home">
        Tilbage til menu
      </button>
      {/* Desktop only (see Retro.css) — the bottom nav already covers
          going back, so the spare button jumps straight into today. */}
      <button onClick={() => onSelectDate(today)} className="calendar-play-today">
        Spil dagens udfordring <span className="next-key">Enter</span>
      </button>
    </div>
  );
}
