import { useState } from "react";
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

// One piece of seasonal artwork per calendar month (index 0 = Jan),
// each used exactly once across the year — winter runs Dec/Jan/Feb in
// that chronological order, so December gets winter's first piece.
const MONTH_ART = [
  "/calendar-art/winter_2.png", // January
  "/calendar-art/winter_3.png", // February
  "/calendar-art/spring_1.png", // March
  "/calendar-art/spring_2.png", // April
  "/calendar-art/spring_3.png", // May
  "/calendar-art/summer_1.png", // June
  "/calendar-art/summer_2.png", // July
  "/calendar-art/summer_3.png", // August
  "/calendar-art/autumn_1.png", // September
  "/calendar-art/autumn_2.png", // October
  "/calendar-art/autumn_3.png", // November
  "/calendar-art/winter_1.png", // December
];

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

  const monthKey = `${view.year}-${view.month}`;

  const numDays = daysInMonth(view.year, view.month);
  const leadingBlanks = firstWeekdayIndex(view.year, view.month);
  const cells = [...Array(leadingBlanks).fill(null), ...Array.from({ length: numDays }, (_, i) => i + 1)];

  return (
    <div className="card calendar-card">
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

      <div key={monthKey} className={`calendar-month-content calendar-slide-${direction}`}>
        <div className="calendar-art">
          <img src={MONTH_ART[view.month]} alt="" aria-hidden="true" />
        </div>

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
                  <span className="calendar-day-num">{day}</span>
                  {result && <span className="calendar-day-check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button onClick={onBack} className="next-button">
        Tilbage til menu
      </button>
    </div>
  );
}
