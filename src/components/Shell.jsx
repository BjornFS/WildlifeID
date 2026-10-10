import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { natureSceneSvg } from "../lib/natureScene.js";
import { isMuted, playSound, setMuted } from "../lib/sound.js";
import "../styles/Retro.css";

const NAV = [
  { id: "daily", label: "Daglig" },
  { id: "endless", label: "Endless ∞" },
  { id: "guide", label: "Feltguide" },
  // A side game rather than a main mode, so it sits apart in the bar.
  { id: "expert", label: "Ekspert", className: "desk-chip-extra" },
];

// How far to scale the title down for the top bar. It's always
// rendered at its big intro size (see .desk-title in Retro.css) and
// only ever shrunk with transform: scale(), which the GPU animates
// smoothly — animating font-size instead re-lays out and re-draws the
// text every frame, which stutters on phones. The landed size comes
// from --title-landed; the intro size depends on the window width, so
// this is re-measured on resize.
function useTitleScale(pageRef, titleRef, isDesktop) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const measure = () => {
      if (!pageRef.current || !titleRef.current) return;
      const landed = parseFloat(getComputedStyle(pageRef.current).getPropertyValue("--title-landed"));
      const intro = parseFloat(getComputedStyle(titleRef.current).fontSize);
      if (landed > 0 && intro > 0) setScale(landed / intro);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pageRef, titleRef, isDesktop]);
  return scale;
}

// The frame around every screen, on phones and desktop alike: the pixel
// landscape, a slim top bar and the mode chips along the bottom. The
// screen itself is passed in as children and restyles itself for this
// frame (see Retro.css). `isDesktop` only switches layout, not style.
//
// With `withIntro`, it opens on a landing view instead: just the title,
// large and centred over the scene. The first click or key press glides
// the title up into the top bar and fades everything else in.
export default function Shell({ isDesktop, active, onNavigate, withIntro, children }) {
  const pageRef = useRef(null);
  const titleRef = useRef(null);
  const titleScale = useTitleScale(pageRef, titleRef, isDesktop);
  const [landed, setLanded] = useState(!withIntro);
  // True for the moment right after the intro, while the screen fades
  // in — so anything that pops in can wait for it (see Retro.css).
  const [arriving, setArriving] = useState(false);
  const [muted, setMutedState] = useState(isMuted);

  const toggleSound = () => {
    setMuted(!muted);
    setMutedState(!muted);
    if (muted) playSound("tap");
  };

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
      playSound("home");
      setLanded(true);
      setArriving(true);
    };
    window.addEventListener("keydown", land, { capture: true });
    return () => window.removeEventListener("keydown", land, { capture: true });
  }, [landed]);

  useEffect(() => {
    if (!arriving) return;
    const timer = setTimeout(() => setArriving(false), 1500);
    return () => clearTimeout(timer);
  }, [arriving]);

  return (
    <div
      className={`page retro-page ${isDesktop ? "desktop-page" : "mobile-page"} ${landed ? "is-landed" : "is-intro"} ${arriving ? "is-arriving" : ""}`}
      ref={pageRef}
      style={{ "--title-scale": titleScale }}
      onClickCapture={(e) => {
        if (landed) return;
        e.stopPropagation();
        playSound("home");
        setLanded(true);
        setArriving(true);
      }}
      // Every button click anywhere in the frame plays its sound here:
      // its data-sound, or "tap" by default (see sound.js).
      onClick={(e) => {
        const button = e.target.closest("button");
        if (!button || button.disabled) return;
        const sound = button.dataset.sound ?? "tap";
        if (sound !== "none") playSound(sound);
      }}
    >
      <div className="nature-scene" aria-hidden="true" dangerouslySetInnerHTML={{ __html: natureSceneSvg() }} />

      <div className="desk-title-wrap">
        <h1 ref={titleRef} className="desk-title">
          WILDLIFE·ID
        </h1>
        <div className="desk-intro-text">
          <p className="desk-tagline">Det vilde Danmark</p>
          <p className="desk-start">Tryk for at begynde</p>
        </div>
      </div>

      <header className="desk-topbar desk-fade">
        <button
          type="button"
          className="desk-box desk-menu"
          data-sound="home"
          onClick={(e) => go(e, "menu")}
          aria-label="Menu"
        >
          ☰
        </button>
        <button
          type="button"
          className={`desk-box desk-sound ${muted ? "is-muted" : ""}`}
          data-sound="none"
          onClick={toggleSound}
          aria-pressed={!muted}
          aria-label={muted ? "Slå lyd til" : "Slå lyd fra"}
          title={muted ? "Slå lyd til" : "Slå lyd fra"}
        >
          ♪
        </button>
      </header>

      <main className="desk-stage desk-fade">{children}</main>

      <nav className="desk-nav desk-fade">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`desk-chip ${item.className ?? ""} ${active === item.id ? "is-active" : ""}`}
            onClick={(e) => go(e, item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
