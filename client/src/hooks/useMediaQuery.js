import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const listener = (event) => setMatches(event.matches);
    mql.addEventListener('change', listener);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
