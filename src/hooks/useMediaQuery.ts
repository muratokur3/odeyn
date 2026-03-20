/* eslint-disable react-hooks/set-state-in-effect */
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
        // Update only if different (though event will handle it)

        setMatches(media.matches);

        const listener = () =>
        setMatches(media.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [query]); // Removed matches from dependencies

    return matches;
}
