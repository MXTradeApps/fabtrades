// Analytics for the web app, sent to two places:
//
// - Google Analytics, whose tag is loaded by index.html.
// - PostHog, the same project the mobile app reports to, started by
//   `initPostHog` from main.jsx. It records each page view together with the
//   campaign tags on the link that brought the visitor in (utm_source,
//   utm_medium, utm_campaign, ...), which is how a visit is traced back to a
//   YouTube Short or any other tagged link.
//
// Beyond page views, only a few actions are reported: the ones that say whether
// a visit turned into use.

import posthog from 'posthog-js';

let posthogStarted = false;

/**
 * Start PostHog. Does nothing without a key (local dev, tests), and never
 * throws: analytics must not be able to break the app.
 *
 * Must run before the app renders, while the address bar still holds the link
 * the visitor arrived on. Several pages tidy their query string once mounted,
 * which would drop the campaign tags before the first page view was recorded.
 *
 * @param {{ key?: string|null, host?: string|null, appEnv?: string }} config
 */
export const initPostHog = ({ key, host, appEnv } = {}) => {
    if (posthogStarted || !key || typeof window === 'undefined') return;
    try {
        posthog.init(key, {
            api_host: host || 'https://us.i.posthog.com',
            // Page views on client-side route changes as well as the first load.
            defaults: '2025-05-24',
            // Same as the app: anonymous visitors are counted without a person
            // profile being created for each one.
            person_profiles: 'identified_only',
            // Page views and the named events below are all that is wanted.
            // No click autocapture, no session replay, no surveys.
            autocapture: false,
            disable_session_recording: true,
            disable_surveys: true,
        });
        // `app_env` matches the app's property so staging traffic filters out
        // the same way; `platform` tells web events apart from app events.
        posthog.register({
            platform: 'web',
            app_env: appEnv || 'production',
            landing_page: landingPath(),
        });
        posthogStarted = true;
    } catch {
        // Ignored on purpose; see above.
    }
};

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
    if (typeof window === 'undefined') return;
    // Each destination is tried on its own, so one being blocked does not
    // silence the other.
    try {
        if (typeof window.gtag === 'function') {
            window.gtag('event', name, { landing_page: landingPath(), ...params });
        }
    } catch {
        // Ignored on purpose; see above.
    }
    try {
        // `landing_page` is already registered on every PostHog event.
        if (posthogStarted) posthog.capture(name, params);
    } catch {
        // Ignored on purpose; see above.
    }
};

/** A tap on an App Store / Google Play link. */
export const trackAppStoreClick = (store, placement) =>
    trackEvent('app_store_click', { store, placement });
