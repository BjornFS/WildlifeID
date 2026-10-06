// Little chiptune button sounds, synthesised on the fly with the Web
// Audio API (square and triangle waves, like an old 8-bit console) —
// no audio files to download, and every sound is a few tweakable
// notes. Kept quiet on purpose: cute, with a small low "thump" under
// some of them for oomph.
//
//   tap     any ordinary button
//   right   correct answer
//   wrong   wrong answer
//   home    buttons that take you back to the menu
//
// Buttons pick their sound with a data-sound attribute (see Shell.jsx,
// which plays "tap" for any button without one); data-sound="none"
// means the button plays its own sound in code, like the answers.

const MUTED_KEY = "wildlifeid-sound-muted";
const VOLUME = 0.18;

let ctx = null;
let master = null;

function audio() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
  }
  // Browsers start audio suspended until the first tap/click.
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// One note: a quick attack, then an exponential fade — optionally
// gliding from `freq` to `freqEnd` along the way.
function tone(freq, start, dur, type, vol, freqEnd) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

// A short low drop under a sound — felt more than heard.
const thump = (t, vol) => tone(140, t, 0.08, "triangle", vol, 60);

const SOUNDS = {
  tap(t) {
    tone(660, t, 0.06, "triangle", 0.3, 990);
    tone(1320, t, 0.03, "square", 0.05);
  },
  right(t) {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.055, i === 3 ? 0.22 : 0.08, "square", 0.11));
    thump(t, 0.2);
  },
  wrong(t) {
    tone(330, t, 0.12, "square", 0.1, 300);
    tone(247, t + 0.11, 0.26, "square", 0.1, 220);
    thump(t, 0.3);
  },
  home(t) {
    [784, 659, 523].forEach((f, i) => tone(f, t + i * 0.07, i === 2 ? 0.3 : 0.09, "triangle", 0.35));
  },
};

let mutedNow = isMuted();
let lastTap = -Infinity;

export function isMuted() {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted) {
  try {
    localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
  } catch {
    // Storage blocked (private mode etc.) — the toggle still works for
    // this visit, it just won't be remembered.
  }
  mutedNow = muted;
}

export function playSound(name) {
  if (mutedNow || !SOUNDS[name]) return;
  const c = audio();
  if (!c) return;
  // Drop taps that land on top of each other (e.g. a double click), so
  // they don't stack into one loud blip.
  if (name === "tap") {
    if (c.currentTime - lastTap < 0.05) return;
    lastTap = c.currentTime;
  }
  SOUNDS[name](c.currentTime + 0.01);
}
