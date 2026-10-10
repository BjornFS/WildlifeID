// Turning a finished run into numbers and text: per-category tallies
// for the daily end card, the shareable result, and a short date.
import { ALL_CATEGORIES } from "../data/groups.js";

// "2026-09-12" -> "12/9-2026" — a compact, informal Danish date
// shorthand, so the daily challenge's header can show which day
// you're on/replaying without taking up much space.
export function formatShortDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${day}/${month}-${year}`;
}

const CATEGORY_BY_ID = Object.fromEntries(ALL_CATEGORIES.map((c) => [c.id, c]));

// Tallies one run's answers per species category (Rovfugle, Hjortevildt,
// etc. — see categories.js/birdCategories.js), for the daily end card's
// strongest/weakest lists. Grouping by category rather than species
// mirrors how the old scorecard reported progress, since a family is a
// more useful thing to reflect on than a single species.
export function buildCategoryStats(answerLog) {
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

// The daily challenge's result as copy-pasteable text, Wordle style:
// one square per question, in the order they were asked.
export function dailyShareText(date, score, total, answerLog) {
  const squares = answerLog.map((e) => (e.wasCorrect ? "🟩" : "🟥")).join("");
  // Centre the score over the squares. Emoji are about two characters
  // wide in most fonts, so the squares are 2 × count wide and "🐾 7/10"
  // is 3 + the fraction's length. Nudged two spaces left of the true
  // middle, which reads as centred in most chat apps.
  const scoreLine = `🐾 ${score}/${total}`;
  const pad = Math.max(0, Math.round((answerLog.length * 2 - (3 + `${score}/${total}`.length)) / 2) - 2);
  return `WildlifeID · ${formatShortDate(date)}\n${" ".repeat(pad)}${scoreLine}\n${squares}\nhttps://bjornfs.github.io/WildlifeID/`;
}
