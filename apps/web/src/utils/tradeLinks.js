/**
 * Short trade links: `fabtrades.net/t/<code>` stands in for the long
 * `/?trade=<base64>` URL, which grows with every card in the trade.
 *
 *   POST /api/trade-links  {trade}  -> {code, url}   netlify/functions/trade-links.mjs
 *   GET  /t/<code>                  -> 302 /?trade=  netlify/functions/trade-link.mjs
 *
 * The code is derived from the trade itself, so sharing the same trade twice
 * gives the same link and a stored link never changes. The redirect lands on
 * the long URL, so the app, the edge-rendered link preview and old long links
 * all keep working unchanged. The mobile app calls the same endpoint
 * (lib/core/data/trade_link_shortener.dart).
 */

export const TRADE_LINKS_ENDPOINT = '/api/trade-links';
export const TRADE_LINK_PATH = '/t/';
// Netlify Blobs store holding code -> `trade` param.
export const TRADE_LINK_STORE = 'trade-links';

export const CODE_LENGTH = 8;
// Used only if two different trades ever hash to the same short code.
export const LONG_CODE_LENGTH = 12;

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const isTradeLinkCode = (code) =>
    typeof code === 'string' && /^[0-9A-Za-z]{8,12}$/.test(code);

const webSha256 = async (text) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));

/**
 * A base62 code taken from the SHA-256 of the `trade` param. `sha256` can be
 * swapped for node:crypto where Web Crypto is not a global (Node 18).
 */
export const tradeLinkCode = async (tradeParam, length = CODE_LENGTH, sha256 = webSha256) => {
    const digest = await sha256(tradeParam);
    let code = '';
    for (const byte of new Uint8Array(digest)) {
        code += ALPHABET[byte % ALPHABET.length];
        if (code.length === length) break;
    }
    return code;
};

/**
 * Store `trade` under its code and return the code. `store` is a Netlify Blobs
 * store (anything with async `get`/`set`).
 */
export const saveTradeLink = async (store, trade, sha256 = webSha256) => {
    let code = await tradeLinkCode(trade, CODE_LENGTH, sha256);
    const existing = await store.get(code);
    if (existing === trade) return code;
    if (existing !== null && existing !== undefined) {
        // Another trade already owns this code; fall back to a longer one.
        code = await tradeLinkCode(trade, LONG_CODE_LENGTH, sha256);
        if ((await store.get(code)) === trade) return code;
    }
    await store.set(code, trade);
    return code;
};

/**
 * Swap a long `?trade=` URL for a short one. Any failure (offline, local dev
 * without Netlify functions, a slow response) returns the long URL unchanged,
 * which works just as well, only longer.
 *
 * @param {string} longUrl
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<string>}
 */
export const shortenTradeLink = async (longUrl, { fetchImpl = fetch, timeoutMs = 4000 } = {}) => {
    if (!longUrl) return longUrl;
    try {
        const url = new URL(longUrl);
        const trade = url.searchParams.get('trade');
        if (!trade) return longUrl;
        const response = await fetchImpl(new URL(TRADE_LINKS_ENDPOINT, url.origin).toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trade }),
            signal: AbortSignal.timeout(timeoutMs)
        });
        if (!response.ok) return longUrl;
        const { url: shortUrl } = await response.json();
        return typeof shortUrl === 'string' && shortUrl.startsWith(`${url.origin}${TRADE_LINK_PATH}`)
            ? shortUrl
            : longUrl;
    } catch {
        return longUrl;
    }
};
