<p align="center">
  <img src="docs/banner.svg" alt="WildlifeID: pixel landscape with deer, ducks, a fox, a boar and a hare" width="100%">
</p>

<p align="center">
  <a href="https://bjornfs.github.io/WildlifeID/"><img alt="Play now" src="https://img.shields.io/badge/play-bjornfs.github.io%2FWildlifeID-ffd28a?style=flat-square&labelColor=1f2e22"></a>
  <a href="https://github.com/BjornFS/WildlifeID/actions/workflows/deploy.yml"><img alt="Deploy" src="https://img.shields.io/github/actions/workflow/status/BjornFS/WildlifeID/deploy.yml?branch=main&style=flat-square&label=deploy&labelColor=1f2e22&color=4b7a3d"></a>
  <img alt="107 species" src="https://img.shields.io/badge/species-107-c06a3b?style=flat-square&labelColor=1f2e22">
  <img alt="React 18" src="https://img.shields.io/badge/react-18-6fa8c8?style=flat-square&labelColor=1f2e22&logo=react&logoColor=fff4dc">
  <img alt="Vite 5" src="https://img.shields.io/badge/vite-5-a99bd6?style=flat-square&labelColor=1f2e22&logo=vite&logoColor=fff4dc">
</p>

<p align="center">
  <b>Learn to tell Danish wildlife apart, one photo at a time.</b><br>
  A small quiz game for the mammals and birds of Denmark (in Danish), dressed as a retro pixel walk in the woods.
</p>

---

## Modes

| Mode | |
|---|---|
| **Vildtsporet** | The main mode: a trail through six habitats, from *Byen* (the town) to *Kysten* (the coast). Each step introduces a few new species, drills the classic lookalikes, and ends the chapter with a *Feltprøve* (field test) you need 80 % to pass. |
| **Daglig udfordring** | Ten species a day, the same for everyone. A calendar tracks the days you've cleared, and perfect days are marked in green. |
| **Endless** | Keep naming animals until you miss one. Your best run is saved as a highscore. |
| **Feltguide** | A field guide that fills in as you learn: photo, Latin name, distinguishing features and difficulty for every species you've met. |

The trickiest pairs, such as *husmår / skovmår*, *bisamrotte / sumpbæver* and *duehøg / spurvehøg*, are always asked side by side, so you can't guess from the category alone. After each answer you get the species' key features (*kendetegn*), its lookalikes and quick facts.

Works on phones and desktop. On desktop, keys `1`–`4` pick an answer and `Enter` moves on.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173. There's no backend: progress, daily results and the highscore are kept in the browser's local storage.

## Adding photos and species

Original photos live in [`photos/`](photos/), one folder per group and category. They aren't served directly. Instead, a script makes web-sized WebP copies (1600 px, plus 360 px thumbnails) in `public/images/`:

```bash
npm run photos
```

Then list the `.webp` path on the species in [`src/species.js`](src/species.js) (mammals) or [`src/birdSpecies.js`](src/birdSpecies.js) (birds):

```js
images: ["/images/pattedyr/hundedyr/raev_1.webp"],
```

A new species only needs an entry with its `category` and `habitat`. Its habitat decides which trail chapter it appears in, and it shows up in the other modes automatically. See [`photos/README.txt`](photos/README.txt) for the folder layout.

## Project layout

```
src/
  App.jsx               quiz screen, rounds and result pop-up
  Shell.jsx             retro frame: landscape, top bar, bottom nav
  Trail.jsx, trail.js   Vildtsporet map, chapters and steps
  DailyCalendar.jsx     daily challenge calendar
  dailyChallenge.js     date-seeded daily picks
  FieldGuide.jsx        Felthåndbogen
  species.js            mammals
  birdSpecies.js        birds
  options.js            answer options and lookalike pairs
  natureScene.js        the pixel landscape (generated SVG)
  Retro.css             the retro look, desktop and phone layouts
scripts/
  optimize-photos.mjs   photos/ → public/images/ (WebP)
  make-banner.mjs       builds docs/banner.svg for this README
```

## Deployment

Every push to `main` builds the site and publishes it to GitHub Pages ([workflow](.github/workflows/deploy.yml)). You can also start a deploy by hand from the Actions tab with **Run workflow**.

---

<p align="center"><sub>Photos: <a href="https://www.pexels.com">Pexels</a> · Made in Denmark 🌲</sub></p>
