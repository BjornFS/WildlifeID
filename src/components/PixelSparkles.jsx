import { useMemo } from "react";

// Pixel sparkles scattered over the "completed" card: little plus-shaped
// stars that blink on and off at their own pace. Positions are fixed
// per mount so they don't jump around on re-render.
export default function PixelSparkles({ count = 28 }) {
  const sparkles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: [3, 4, 4, 5][i % 4],
        color: ["#ffd28a", "#fff4dc", "#9fe08a", "#ffb35c"][i % 4],
        delay: `${(Math.random() * 1.6).toFixed(2)}s`,
        duration: `${(0.9 + Math.random() * 0.9).toFixed(2)}s`,
      })),
    [count]
  );
  return (
    <div className="pixel-sparkles" aria-hidden="true">
      {sparkles.map((p) => (
        <i
          key={p.id}
          className="pixel-sparkle"
          style={{
            left: p.left,
            top: p.top,
            "--px": `${p.size}px`,
            "--c": p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}
