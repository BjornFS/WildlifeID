import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site at https://bjornfs.github.io/WildlifeID/
  base: process.env.GITHUB_PAGES ? "/WildlifeID/" : "/",
});
