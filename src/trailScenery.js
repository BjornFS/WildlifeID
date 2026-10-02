// Hand-drawn SVG scenery for Vildtsporet's biome chapters — houses,
// wheat, trees, water, reeds, dunes. Each function takes the chapter's
// palette (see `pal` in trail.js) and returns a static SVG string that
// Trail.jsx injects as-is. They're plain strings rather than JSX only
// because they're pure decoration built from our own constants; no
// user input ever reaches them.

export const SCENERY = {
  house: (p, r = 0.8) =>
    `<svg width="64" height="62" viewBox="0 0 64 62"><rect x="12" y="26" width="40" height="32" fill="${p.d1}"/><path d="M6 28 32 6 58 28Z" fill="${p.d2}"/><rect x="${r > 0.5 ? 20 : 36}" y="36" width="9" height="9" fill="#fff8e6" opacity=".85"/><rect x="${r > 0.5 ? 36 : 20}" y="40" width="9" height="18" fill="${p.d2}"/></svg>`,
  house2: (p) => SCENERY.house(p, 0.2),
  bush: (p) =>
    `<svg width="56" height="36" viewBox="0 0 56 36"><circle cx="16" cy="22" r="13" fill="${p.d3}"/><circle cx="32" cy="16" r="15" fill="${p.d3}"/><circle cx="44" cy="24" r="11" fill="${p.d3}"/></svg>`,
  bale: (p) =>
    `<svg width="50" height="40" viewBox="0 0 50 40"><rect x="3" y="6" width="44" height="30" rx="15" fill="${p.d1}"/><circle cx="18" cy="21" r="10" fill="none" stroke="${p.d2}" stroke-width="2.5"/><circle cx="18" cy="21" r="4" fill="none" stroke="${p.d2}" stroke-width="2.5"/></svg>`,
  wheat: (p) =>
    `<svg width="46" height="62" viewBox="0 0 46 62">${[10, 23, 36]
      .map((x, i) => {
        const tip = x + (i - 1) * 5;
        const grains = [0, 1, 2, 3]
          .map((k) => {
            const y = 14 + k * 6;
            return `<ellipse cx="${tip - 2.5}" cy="${y}" rx="2.6" ry="4.5" fill="${p.d1}" transform="rotate(-25 ${tip - 2.5} ${y})"/><ellipse cx="${tip + 2.5}" cy="${y}" rx="2.6" ry="4.5" fill="${p.d1}" transform="rotate(25 ${tip + 2.5} ${y})"/>`;
          })
          .join("");
        return `<path d="M${x} 62 Q${x + (i - 1) * 3} 34 ${tip} 10" stroke="${p.d2}" stroke-width="2.5" fill="none"/>${grains}`;
      })
      .join("")}</svg>`,
  tree: (p) =>
    `<svg width="60" height="80" viewBox="0 0 60 80"><rect x="27" y="48" width="7" height="30" rx="2" fill="${p.trunk}"/><circle cx="30" cy="32" r="24" fill="${p.d1}"/><circle cx="22" cy="26" r="11" fill="${p.d3}" opacity=".6"/></svg>`,
  pine: (p) =>
    `<svg width="50" height="86" viewBox="0 0 50 86"><rect x="22" y="66" width="6" height="18" fill="${p.trunk}"/><path d="M25 4 42 34H8Z M25 20 46 52H4Z M25 38 49 70H1Z" fill="${p.d2}"/></svg>`,
  water: (p) =>
    `<svg width="150" height="110" viewBox="0 0 150 110"><ellipse cx="75" cy="55" rx="72" ry="50" fill="${p.d1}"/><path d="M35 50q8-6 16 0t16 0M70 72q8-6 16 0t16 0M88 34q8-6 16 0" stroke="#fff" stroke-width="2.5" fill="none" opacity=".7" stroke-linecap="round"/><circle cx="112" cy="68" r="9" fill="${p.d3}"/><path d="M112 68 121 64 121 72Z" fill="${p.d1}"/></svg>`,
  lily: (p) =>
    `<svg width="44" height="30" viewBox="0 0 44 30"><ellipse cx="22" cy="15" rx="20" ry="13" fill="${p.d1}" opacity=".9"/><circle cx="16" cy="15" r="7" fill="${p.d3}"/><path d="M16 15 24 11 24 19Z" fill="${p.d1}"/><circle cx="29" cy="12" r="3.2" fill="#fff" opacity=".9"/></svg>`,
  reeds: (p) =>
    `<svg width="40" height="74" viewBox="0 0 40 74">${[8, 16, 24, 32]
      .map(
        (x, i) =>
          `<path d="M${x} 74 Q${x - 2 + i} 40 ${x + (i % 2 ? 4 : -4)} ${10 + i * 5}" stroke="${p.d3}" stroke-width="2.4" fill="none"/>`
      )
      .join(
        ""
      )}<rect x="14" y="16" width="5" height="16" rx="2.5" fill="${p.trunk}"/><rect x="26" y="24" width="5" height="15" rx="2.5" fill="${p.trunk}"/></svg>`,
  tussock: (p) =>
    `<svg width="60" height="34" viewBox="0 0 60 34"><ellipse cx="30" cy="28" rx="28" ry="6" fill="${p.d1}" opacity=".7"/><path d="M14 28 Q12 10 6 4M22 28Q22 8 20 0M30 28Q32 10 36 2M38 28Q40 14 48 6M46 28Q48 18 56 14" stroke="${p.d3}" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`,
  dune: (p) =>
    `<svg width="90" height="44" viewBox="0 0 90 44"><path d="M0 44 Q24 4 50 20 Q70 30 90 18 V44Z" fill="${p.d2}"/><path d="M30 18 Q28 6 24 2M36 16Q37 6 40 0M42 18Q46 8 52 6" stroke="${p.d3}" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`,
  waves: (p) =>
    `<svg width="120" height="70" viewBox="0 0 120 70"><rect width="120" height="70" rx="35" fill="${p.d1}"/><path d="M14 28q10-8 20 0t20 0t20 0M40 46q10-8 20 0t20 0t20 0" stroke="#fff" stroke-width="3" fill="none" opacity=".75" stroke-linecap="round"/></svg>`,
  shell: () =>
    `<svg width="30" height="26" viewBox="0 0 30 26"><path d="M15 2 C4 4 2 16 6 22 L24 22 C28 16 26 4 15 2Z" fill="#f6e2cf"/><path d="M15 4V22M9 7 11 22M21 7 19 22" stroke="#e0bfa0" stroke-width="1.6"/></svg>`,
};

// Big pieces that sit flush against the card edge rather than inset.
export const EDGE_SCENERY = new Set(["water", "waves"]);

// Small deterministic PRNG (mulberry32) so a chapter's scenery lands
// in the same spots on every render instead of jumping around.
export function seededRandom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
