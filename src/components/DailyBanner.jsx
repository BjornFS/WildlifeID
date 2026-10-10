// Today's daily challenge, as a slim pixel-art tab that pops in on the
// daily challenge's menu button: a calendar, the label, and a play arrow.
// Only shown until today's has been played (see Menu.jsx). Everything
// is drawn as SVG squares, like PixelNumber.jsx — properly blocky at
// any size, with no font or image to download.

// 7-row bitmap letters — only the ones the label needs.
const GLYPHS = {
  A: [".XXX.", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
  D: ["XXXX.", "X...X", "X...X", "X...X", "X...X", "X...X", "XXXX."],
  E: ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"],
  F: ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "X...."],
  G: [".XXXX", "X....", "X....", "X.XXX", "X...X", "X...X", ".XXXX"],
  I: ["XXX", ".X.", ".X.", ".X.", ".X.", ".X.", "XXX"],
  N: ["X...X", "XX..X", "XX..X", "X.X.X", "X..XX", "X..XX", "X...X"],
  O: [".XXX.", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
  R: ["XXXX.", "X...X", "X...X", "XXXX.", "X.X..", "X..X.", "X...X"],
  S: [".XXXX", "X....", "X....", ".XXX.", "....X", "....X", "XXXX."],
  U: ["X...X", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
};

function PixelText({ text }) {
  const cells = [];
  let x = 0;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    glyph.forEach((row, y) =>
      [...row].forEach((bit, dx) => {
        if (bit === "X") cells.push(<rect key={`${x + dx}-${y}`} x={x + dx} y={y} width="1" height="1" />);
      })
    );
    x += glyph[0].length + 1;
  }
  const cols = x - 1;
  return (
    <svg className="daily-tab-text" viewBox={`0 0 ${cols} 7`} style={{ "--cols": cols }} shapeRendering="crispEdges" aria-hidden="true">
      {cells}
    </svg>
  );
}

// A small pixel sprite: one character per pixel, coloured by `colors`
// ("." and anything unlisted stay transparent).
function Sprite({ rows, colors, className }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${rows[0].length} ${rows.length}`}
      style={{ "--cols": rows[0].length, "--rows": rows.length }}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => colors[c] && <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={colors[c]} />)
      )}
    </svg>
  );
}

// A calendar page with binder rings and a star, 9×9.
const CALENDAR = [
  ".K.....K.",
  "KGKGGGKGK",
  "KGGGGGGGK",
  "KWWWSWWWK",
  "KWWSSSWWK",
  "KWSSSSSWK",
  "KWWSWSWWK",
  "KWWWWWWWK",
  "KKKKKKKKK",
];
const CALENDAR_COLORS = { K: "#1f2e22", G: "#5c9a3c", W: "#fff4dc", S: "#e8a72c" };

// The play arrow, 4×7.
const ARROW = ["X...", "XX..", "XXX.", "XXXX", "XXX.", "XX..", "X..."];
const ARROW_COLORS = { X: "#3f7a2c" };

export default function DailyBanner({ onClick }) {
  return (
    <button type="button" className="daily-tab" onClick={onClick} aria-label="Spil dagens udfordring">
      <span className="daily-tab-box">
        <Sprite rows={CALENDAR} colors={CALENDAR_COLORS} className="daily-tab-icon" />
        <span className="daily-tab-label">
          <PixelText text="DAGENS" />
          <PixelText text="UDFORDRING" />
        </span>
        <Sprite rows={ARROW} colors={ARROW_COLORS} className="daily-tab-arrow" />
      </span>
    </button>
  );
}
