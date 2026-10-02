import { useEffect, useState } from "react";

// Wide enough for the desktop layout (see DesktopShell.jsx); anything
// smaller keeps the original phone card.
export const DESKTOP_QUERY = "(min-width: 1024px) and (min-height: 600px)";

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
