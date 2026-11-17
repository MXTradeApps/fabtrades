/**
 * Every environment value the web app reads, in one place.
 *
 * This module has two consumers with different notions of "environment":
 * the browser bundle, where Vite has replaced `import.meta.env` with the
 * `VITE_`-prefixed values it baked in at build time, and Node, where
 * `scripts/generateSeoPages.js` prerenders pages using the same Supabase
 * queries. So both are consulted, Vite first.
 *
 * Nothing is defaulted. The old hardcoded project reference meant a staging
 * deploy that forgot its variables would quietly read and write production — the
 * one failure worth being loud about, since it puts sandbox purchases and test
 * data in real customers' accounts.
 *
 * Reads are deferred rather than captured at import, so a Node script can populate
 * `process.env` in its own body and still be seen.
 *
 * See docs/ENVIRONMENTS.md.
 */

// `import.meta.env` is a Vite construct and simply absent under Node.
const viteEnv = import.meta.env ?? {};

const read = (key) => {
    const nodeEnv = typeof process === 'undefined' ? {} : (process.env ?? {});
    const value = viteEnv[key] ?? nodeEnv[key];
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

/** The Supabase project and its publishable key, or null when unconfigured. */
export const supabaseCredentials = () => {
    const url = read('VITE_SUPABASE_URL');
    const key = read('VITE_SUPABASE_ANON_KEY');
    return url && key ? { url, key } : null;
};

/** `production` or `staging`. Names the environment; the URL decides where data goes. */
export const appEnv = () => read('VITE_APP_ENV') ?? 'production';

/**
 * The PostHog project key and host, or null when analytics is not configured
 * (local dev by default). The key is a public, write-only project token — the
 * same one the mobile app ships with.
 */
export const posthogConfig = () => {
    const key = read('VITE_POSTHOG_KEY');
    return key ? { key, host: read('VITE_POSTHOG_HOST') ?? 'https://us.i.posthog.com' } : null;
};

export const isProduction = () => appEnv() === 'production';

/**
 * The Supabase credentials, or a thrown error naming what is missing.
 *
 * Card and price data is the app, so there is no degraded mode worth having here.
 * Auth is different: `lib/supabase.js` disables sign-in and carries on, because a
 * signed-out FAB Trades is still a working trade calculator.
 */
export function requireSupabaseConfig() {
    const credentials = supabaseCredentials();
    if (credentials) return credentials;

    const missing = [
        read('VITE_SUPABASE_URL') ? null : 'VITE_SUPABASE_URL',
        read('VITE_SUPABASE_ANON_KEY') ? null : 'VITE_SUPABASE_ANON_KEY'
    ].filter(Boolean);
    throw new Error(
        `Missing ${missing.join(' and ')}. Copy apps/web/.env.example to ` +
        'apps/web/.env for local work, or set them per deploy context in ' +
        'netlify.toml. See docs/ENVIRONMENTS.md.'
    );
}
