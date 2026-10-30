import { TextDecoder, TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import {
    isTradeLinkCode,
    saveTradeLink,
    shortenTradeLink,
    tradeLinkCode,
    withTradeAddress
} from '../../src/utils/tradeLinks.js';

// jsdom lacks these; Netlify's runtimes and browsers have them.
globalThis.TextEncoder ??= TextEncoder;
globalThis.TextDecoder ??= TextDecoder;
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
AbortSignal.timeout ??= () => undefined;

const fakeStore = (initial = {}) => {
    const data = new Map(Object.entries(initial));
    return {
        data,
        get: async (key) => (data.has(key) ? data.get(key) : null),
        set: async (key, value) => {
            data.set(key, value);
        }
    };
};

describe('tradeLinkCode', () => {
    it('is a stable 8-character base62 code per trade', async () => {
        const a = await tradeLinkCode('eyJ2IjoxfQ==');
        expect(a).toMatch(/^[0-9A-Za-z]{8}$/);
        expect(await tradeLinkCode('eyJ2IjoxfQ==')).toBe(a);
        expect(await tradeLinkCode('eyJ2IjoyfQ==')).not.toBe(a);
        expect(await tradeLinkCode('x', 12)).toHaveLength(12);
    });

    it('validates codes', () => {
        expect(isTradeLinkCode('aB3dE5gH')).toBe(true);
        expect(isTradeLinkCode('short')).toBe(false);
        expect(isTradeLinkCode('../../etc')).toBe(false);
        expect(isTradeLinkCode(undefined)).toBe(false);
    });
});

describe('saveTradeLink', () => {
    it('stores a trade once and reuses its code', async () => {
        const store = fakeStore();
        const code = await saveTradeLink(store, 'trade-a');
        expect(store.data.get(code)).toBe('trade-a');
        expect(await saveTradeLink(store, 'trade-a')).toBe(code);
        expect(store.data.size).toBe(1);
    });

    it('takes a longer code when another trade owns the short one', async () => {
        const short = await tradeLinkCode('trade-a');
        const store = fakeStore({ [short]: 'someone else' });
        const code = await saveTradeLink(store, 'trade-a');
        expect(code).toHaveLength(12);
        expect(store.data.get(code)).toBe('trade-a');
        expect(store.data.get(short)).toBe('someone else');
    });
});

describe('shortenTradeLink', () => {
    const longUrl = 'https://fabtrades.net/?trade=abc%2B%3D';

    it('posts the trade param and returns the short URL', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ url: 'https://fabtrades.net/t/aB3dE5gH' })
        });
        expect(await shortenTradeLink(longUrl, { fetchImpl })).toBe('https://fabtrades.net/t/aB3dE5gH');
        const [endpoint, init] = fetchImpl.mock.calls[0];
        expect(endpoint).toBe('https://fabtrades.net/api/trade-links');
        expect(JSON.parse(init.body)).toEqual({ trade: 'abc+=' });
    });

    it('falls back to the long URL on any failure', async () => {
        const down = jest.fn().mockRejectedValue(new Error('offline'));
        const bad = jest.fn().mockResolvedValue({ ok: false });
        const foreign = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ url: 'https://evil.example/t/x' }) });
        expect(await shortenTradeLink(longUrl, { fetchImpl: down })).toBe(longUrl);
        expect(await shortenTradeLink(longUrl, { fetchImpl: bad })).toBe(longUrl);
        expect(await shortenTradeLink(longUrl, { fetchImpl: foreign })).toBe(longUrl);
        expect(await shortenTradeLink('', { fetchImpl: down })).toBe('');
    });
});

describe('withTradeAddress', () => {
    const shell = '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <script type="module" src="/assets/app.js"></script>\n  </head>\n</html>';

    it('moves the address to the long trade URL before the app bundle runs', () => {
        const html = withTradeAddress(shell, 'eyJ2IjoxfQ==');
        const script = html.indexOf("<script>history.replaceState(null, '', \"/?trade=eyJ2IjoxfQ%3D%3D\" + location.hash);</script>");
        expect(script).toBeGreaterThan(html.indexOf('<head>'));
        expect(script).toBeLessThan(html.indexOf('/assets/app.js'));
    });

    it('cannot be used to close the script tag', () => {
        const html = withTradeAddress(shell, '</script><script>alert(1)</script>');
        expect(html).not.toContain('</script><script>alert');
        expect(html.match(/<\/script>/g)).toHaveLength(2);
    });
});
