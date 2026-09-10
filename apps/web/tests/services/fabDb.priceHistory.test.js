jest.mock('../../src/config/env.js', () => ({
    requireSupabaseConfig: () => ({
        url: 'https://example.supabase.co',
        key: 'anon-key',
    }),
}));

import { priceHistory } from '../../src/services/fabDb.js';

describe('fabDb.priceHistory', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('GETs this Printing’s snapshots oldest-first', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => [],
        });

        await priceHistory('123-Normal');

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, init] = global.fetch.mock.calls[0];
        expect(url).toBe(
            'https://example.supabase.co/rest/v1/fab_price_history'
                + '?select=card_id,captured_on,tcg_low,tcg_market,cm_low,cm_trend'
                + '&card_id=eq.123-Normal&order=captured_on.asc',
        );
        expect(init.method).toBe('GET');
        expect(init.headers.apikey).toBe('anon-key');
        expect(init.headers.Authorization).toBe('Bearer anon-key');
        expect(init.body).toBeUndefined();
    });

    test('encodes a Printing id with spaces', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => [],
        });

        await priceHistory('123-Rainbow Foil');

        const [url] = global.fetch.mock.calls[0];
        expect(url).toContain('card_id=eq.123-Rainbow%20Foil');
    });

    test('forwards an AbortSignal so a Version switch can drop a stale read', async () => {
        const signal = new AbortController().signal;
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => [],
        });

        await priceHistory('123-Normal', { signal });

        expect(global.fetch.mock.calls[0][1].signal).toBe(signal);
    });

    test('empty list is success, not an invented series', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => [],
        });
        await expect(priceHistory('unknown-id')).resolves.toEqual([]);
    });

    test('throws on a non-OK response instead of inventing rows', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ message: 'boom' }),
        });

        await expect(priceHistory('123-Normal')).rejects.toThrow(
            /FAB database request failed \(500\).*fab_price_history/,
        );
    });
});
