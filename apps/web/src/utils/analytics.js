// Google Analytics events for the web app. The tag itself is loaded by
// index.html; this only reports a few actions that say whether a visit turned
// into use, so search traffic can be judged by more than page views.

const LANDING_KEY = 'fabtrades-landing-path';

/**
 * The first page of this visit (per tab), e.g. "/sets/crucible-of-war". Lets a
 * later action be traced back to the page that brought the visitor in.
 */
export const landingPath = () => {
    try {
        const saved = window.sessionStorage.getItem(LANDING_KEY);
        if (saved) return saved;
        const path = window.location.pathname || '/';
        window.sessionStorage.setItem(LANDING_KEY, path);
        return path;
    } catch {
        return typeof window !== 'undefined' ? window.location.pathname || '/' : '/';
    }
};

/**
 * Report an event. Never throws: analytics being blocked or absent (ad
 * blockers, tests, local dev) must not affect the app.
 *
 * @param {string} name
 * @param {Object} [params]
 */
export const trackEvent = (name, params = {}) => {
    try {
        if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
        window.gtag('event', name, { landing_page: landingPath(), ...params });
    } catch {
        // Ignored on purpose; see above.
    }
};

/** A tap on an App Store / Google Play link. */
export const trackAppStoreClick = (store, placement) =>
    trackEvent('app_store_click', { store, placement });
