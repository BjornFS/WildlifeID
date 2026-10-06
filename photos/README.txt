Original photos, organized in one subfolder per category (see src/categories.js):

  images/gnavere/       Gnavere (rodents + hare/rabbit + a couple of
                        insectivores) — kanin, hare, baever, bisamrotte,
                        sumpbaever, egern, markmus, mosegris, skovmus,
                        rotte, muldvarp, pindsvin
  images/maarvildt/     Mårvildt (mustelids) — graevling, ilder, brud, laekat,
                        husmaar, skovmaar, odder, mink, maarhund, vaskebjoern
  images/hjortevildt/    Hjortevildt (deer) — raadyr, daadyr, kronhjort, sika
  images/saeler/        Sæler (seals) — graasael, spaettetsael
  images/hundedyr/      Hundedyr (canids) — ulv, raev
  images/andet/         Andet (other) — vildsvin, muflon

These are the full-size originals. They are NOT served to players —
the site uses smaller web copies that `npm run photos` makes from
them in public/images/ (plus thumbnails in public/images/thumbs/).

To add a photo: drop the original into the right category folder
here, run

  npm run photos

then list the .webp path in that species' `images` array in
src/species.js (or src/birdSpecies.js), e.g.

  photos/pattedyr/hundedyr/raev_1.jpg  ->  "/images/pattedyr/hundedyr/raev_1.webp"

You can list several photos for one species (like raadyr_1/2/3.jpg) —
the quiz picks a random one each time. If a species' `images` list is
empty, or a listed file is missing, a placeholder sketch is shown
instead, so the quiz works fine before you've added every photo.

Adding a brand new species (e.g. the still-empty gnavere category):
add its entry to src/species.js with the matching `category` id, and
it'll show up in the quiz and scorecard automatically.

Quiz answer options are always drawn from the SAME category as the
photo, so a deer photo only offers other deer as options.

A few lookalike species are "bound pairs" (see BOUND_GROUPS in
App.jsx) — they always appear together as options, so you have to
actually tell them apart instead of guessing from category alone:
  - beaver / muskrat / coypu
  - hare / rabbit
  - field vole / water vole / wood mouse / brown rat

src: pexels.com