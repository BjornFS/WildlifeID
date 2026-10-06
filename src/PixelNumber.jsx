// A number drawn in a tiny 3×5 bitmap font, as an inline SVG of
// squares — properly blocky at any size, with no font to download.
const GLYPHS = {
  0: ["111", "101", "101", "101", "111"],
  1: ["010", "110", "010", "010", "111"],
  2: ["111", "001", "111", "100", "111"],
  3: ["111", "001", "111", "001", "111"],
  4: ["101", "101", "111", "001", "001"],
  5: ["111", "100", "111", "001", "111"],
  6: ["111", "100", "111", "101", "111"],
  7: ["111", "001", "010", "010", "010"],
  8: ["111", "101", "111", "101", "111"],
  9: ["111", "101", "111", "001", "111"],
};

export default function PixelNumber({ value, pixel = 4, className = "" }) {
  const digits = String(value).split("");
  const width = digits.length * 4 - 1; // 3 columns per digit + 1 gap
  const cells = [];
  digits.forEach((d, i) => {
    GLYPHS[d]?.forEach((row, y) => {
      [...row].forEach((bit, x) => {
        if (bit === "1") cells.push(<rect key={`${i}-${x}-${y}`} x={i * 4 + x} y={y} width="1" height="1" />);
      });
    });
  });
  return (
    <svg
      className={`pixel-number ${className}`}
      viewBox={`0 0 ${width} 5`}
      width={width * pixel}
      height={5 * pixel}
      shapeRendering="crispEdges"
      fill="currentColor"
      role="img"
      aria-label={String(value)}
    >
      {cells}
    </svg>
  );
}
