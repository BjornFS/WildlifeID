// Resolves a path to a file in public/ against Vite's base URL, so the
// app still finds its images when served from a subpath (GitHub Pages
// serves it at /WildlifeID/). "/images/x.jpg" -> "/WildlifeID/images/x.jpg".
export const asset = (path) => import.meta.env.BASE_URL + path.replace(/^\//, "");

// The small copy of a species photo (see scripts/optimize-photos.mjs),
// for anything shown at tile or chip size rather than full width.
// ".../images/fugle/x.webp" -> ".../images/thumbs/fugle/x.webp".
export const thumb = (src) => src && src.replace("/images/", "/images/thumbs/");
