// Custom events for GoatCounter (script tag in index.html). Pageviews are
// counted by the script itself; this records what people do in the app,
// e.g. track("finish-daily"). A no-op if the script is blocked or hasn't
// loaded, and GoatCounter ignores localhost, so dev runs aren't counted.
export function track(name) {
  try {
    window.goatcounter?.count?.({ path: name, title: name, event: true });
  } catch {
    // Analytics must never break the game.
  }
}
