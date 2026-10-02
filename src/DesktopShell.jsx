import { useEffect, useState } from "react";
import { natureSceneSvg } from "./natureScene.js";
import { getTotalPoints } from "./points.js";
import "./Desktop.css";

// The phone card's fixed design height (see .card in App.css), and the
// room the top bar and bottom nav take — used to scale the phone-card
// screens (trail, guide) down to fit shorter desktop windows.
const CARD_HEIGHT = 844;
const CHROME_HEIGHT = 168;

const NAV = [
  { id: "daily", label: "Daglig" },
  { id: "endless", label: "Endless ∞" },
  { id: "trail", label: "Vildtsporet" },
  { id: "guide", label: "Feltguide" },
];

function useCardZoom() {
  const fit = () => Math.min(1, (window.innerHeight - CHROME_HEIGHT) / CARD_HEIGHT);
  const [zoom, setZoom] = useState(fit);
  useEffect(() => {
    const onResize = () => setZoom(fit());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return zoom;
}

// Wide-screen frame around every screen: the pixel landscape, a slim
// top bar and the mode chips along the bottom. The screen itself is
// passed in as children and restyles itself for this frame (see
// Desktop.css).
//
// With `withIntro`, it opens on a landing view instead: just the title,
// large and centred over the scene. The first click or key press glides
// the title up into the top bar and fades everything else in.
export default function DesktopShell({ active, onNavigate, withIntro, children }) {
  const zoom = useCardZoom();
  const [landed, setLanded] = useState(!withIntro);

  // Drop focus after a nav click, so Enter/Space on the next screen go
  // to its own shortcuts instead of re-clicking the nav button.
  const go = (e, id) => {
    e.currentTarget.blur();
    onNavigate(id);
  };

  useEffect(() => {
    if (landed) return;
    const land = (e) => {
      // Swallow the key that dismissed the intro, so it doesn't also
      // pick a menu option underneath.
      e.stopImmediatePropagation();
      setLanded(true);
    };
    window.addEventListener("keydown", land, { capture: true });
    return () => window.removeEventListener("keydown", land, { capture: true });
  }, [landed]);

  return (
    <div
      className={`page desktop-page ${landed ? "is-landed" : "is-intro"}`}
      style={{ "--card-zoom": zoom }}
      onClickCapture={(e) => {
        if (landed) return;
        e.stopPropagation();
        setLanded(true);
      }}
    >
      <div className="nature-scene" aria-hidden="true" dangerouslySetInnerHTML={{ __html: natureSceneSvg() }} />

      <div className="desk-title-wrap">
        <h1 className="desk-title">WILDLIFE·ID</h1>
        <div className="desk-intro-text">
          <p className="desk-tagline">Det vilde Danmark</p>
          <p className="desk-start">▼ Tryk for at begynde ▼</p>
        </div>
      </div>

      <header className="desk-topbar desk-fade">
        <button type="button" className="desk-box desk-menu" onClick={(e) => go(e, "menu")} aria-label="Menu">
          ☰
        </button>
        <span className="desk-box desk-points">{getTotalPoints().toLocaleString("da-DK")} PT</span>
      </header>

      <main className="desk-stage desk-fade">{children}</main>

      <nav className="desk-nav desk-fade">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`desk-chip ${active === item.id ? "is-active" : ""}`}
            onClick={(e) => go(e, item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
