import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
    // Lazy initialization to get initial value without setState in effect
    const [matches, setMatches] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia(query).matches;
        }
        return false;
    });

    useEffect(() => {
        const media = window.matchMedia(query);

        // Since we initialize the state with window.matchMedia(query).matches,
        // we don't need to synchronously call setMatches(media.matches) here.
        // If the query prop changes, we can queue the update or let the listener handle it.
        // However, if the query prop changes, the initial state is stale.
        // We can safely update it inside a setTimeout, or rely on the fact that
        // a changing query is rare and an initial state update in render is better.

        const listener = () => setMatches(media.matches);

        // Check if the current match is different from our state.
        // It's possible the state got stale if `query` prop changed.
        // We can queue an update just in case.
        setTimeout(() => setMatches(media.matches), 0);

        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [query]);

    return matches;
}
