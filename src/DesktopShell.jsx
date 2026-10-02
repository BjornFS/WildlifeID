import { useEffect, useState } from "react";
import { natureSceneSvg } from "./natureScene.js";
import { getTotalPoints } from "./points.js";
import "./Desktop.css";

// The phone card's fixed design height (see .card in App.css), and the
// room the top bar and bottom nav take — used to scale the phone-card
// screens (menu, calendar, trail) down to fit shorter desktop windows.
const CARD_HEIGHT = 844;
const CHROME_HEIGHT = 168;

const NAV = [
  { id: "daily", label: "Daglig" },
  { id: "trail", label: "Vildtsporet" },
  { id: "endless", label: "Endless ∞" },
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
// passed in as children — the quiz restyles itself for this frame (see
// Desktop.css), the other screens keep their phone card on top of it.
export default function DesktopShell({ active, onNavigate, children }) {
  const zoom = useCardZoom();

  return (
    <div className="page desktop-page" style={{ "--card-zoom": zoom }}>
      <div className="nature-scene" aria-hidden="true" dangerouslySetInnerHTML={{ __html: natureSceneSvg() }} />

      <header className="desk-topbar">
        <button type="button" className="desk-box desk-menu" onClick={() => onNavigate("menu")} aria-label="Menu">
          ☰
        </button>
        <span className="desk-title">WILDLIFE·ID</span>
        <span className="desk-box desk-points">{getTotalPoints().toLocaleString("da-DK")} PT</span>
      </header>

      <main className="desk-stage">{children}</main>

      <nav className="desk-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`desk-chip ${active === item.id ? "is-active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
