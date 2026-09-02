jest.mock('../../src/config/env.js', () => ({
    requireSupabaseConfig: () => ({
        url: 'https://example.supabase.co',
        key: 'anon-key',
    }),
}));

import { recentMovers } from '../../src/services/fabDb.js';

describe('fabDb.recentMovers', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('POSTs p_source and omits p_card_ids for catalog-wide', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => [],
        });

        await recentMovers('tcgplayer');

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, init] = global.fetch.mock.calls[0];
        expect(url).toBe('https://example.supabase.co/rest/v1/rpc/fab_recent_movers');
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toEqual({ p_source: 'tcgplayer' });
        expect(init.headers.apikey).toBe('anon-key');
        expect(init.headers.Authorization).toBe('Bearer anon-key');
        expect(init.headers['Content-Type']).toBe('application/json');
    });

    test('POSTs p_card_ids when ranking owned Printings', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => [],
        });

        await recentMovers('cardmarket', ['aaa-normal', 'bbb-foil']);

        const [, init] = global.fetch.mock.calls[0];
        expect(JSON.parse(init.body)).toEqual({
            p_source: 'cardmarket',
            p_card_ids: ['aaa-normal', 'bbb-foil'],
        });
    });

    test('throws on a non-OK response instead of inventing rows', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ message: 'boom' }),
        });

        await expect(recentMovers('tcgplayer')).rejects.toThrow(
            /FAB database request failed \(500\).*fab_recent_movers/,
        );
    });
});
