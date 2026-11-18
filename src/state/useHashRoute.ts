import { useEffect, useState } from 'react';

export const ROUTES = ['today', 'nutrition', 'hydration', 'carbs', 'glucose', 'progress', 'settings'] as const;
export type Route = (typeof ROUTES)[number];

const FALLBACK: Route = 'today';

export function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').split('?')[0].trim();
  return (ROUTES as readonly string[]).includes(clean) ? (clean as Route) : FALLBACK;
}

export function navigate(route: Route): void {
  if (window.location.hash !== `#/${route}`) {
    window.location.hash = `#/${route}`;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash) window.history.replaceState(null, '', `#/${FALLBACK}`);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return [route, navigate];
}
