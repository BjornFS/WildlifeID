// Resolves a path to a file in public/ against Vite's base URL, so the
// app still finds its images when served from a subpath (GitHub Pages
// serves it at /WildlifeID/). "/images/x.jpg" -> "/WildlifeID/images/x.jpg".
export const asset = (path) => import.meta.env.BASE_URL + path.replace(/^\//, "");
