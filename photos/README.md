# Original photos

Full-size source photos, one folder per group and category:

```
photos/
  pattedyr/   mammals: gnavere, maarvildt, hjortevildt, saeler, hundedyr, andet
  fugle/      birds: duer, dykaender, fasanfugle, gaes, maager, rovfugle,
              skalleslugere, spurvefugle, storke, svaner, svoemmeaender,
              vadefugle, vandhoens
```

Folder names match the category ids in `src/data/categories.js` and
`src/data/birdCategories.js`. Files are named after the species plus a number, e.g.
`raev_1.jpg`.

These originals are **not** served to players. The site uses small WebP
copies in `public/images/` (1600 px) and `public/images/thumbs/` (360 px).

## Adding a photo

1. Drop the original into the right category folder.
2. Run `npm run photos`. Only new or changed photos are processed.
3. Add the `.webp` path to that species' `images` list in
   `src/data/species.js` or `src/data/birdSpecies.js`:

   ```
   photos/pattedyr/hundedyr/raev_1.jpg  ->  "/images/pattedyr/hundedyr/raev_1.webp"
   ```

A species can have several photos; the quiz picks one at random each
time. If the list is empty, a placeholder sketch is shown instead.

Photos: [Pexels](https://www.pexels.com).
