jest.mock('../../src/config/env.js', () => ({
    requireSupabaseConfig: () => ({
        url: 'https://example.supabase.co',
        key: 'anon-key',
    }),
}));

import { printingRecentChanges } from '../../src/services/fabDb.js';

describe('fabDb.printingRecentChanges', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('POSTs p_source and p_card_ids', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => [],
        });

        await printingRecentChanges('tcgplayer', ['aaa-normal', 'bbb-foil']);

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, init] = global.fetch.mock.calls[0];
        expect(url).toBe('https://example.supabase.co/rest/v1/rpc/fab_printing_recent_changes');
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toEqual({
            p_source: 'tcgplayer',
            p_card_ids: ['aaa-normal', 'bbb-foil'],
        });
        expect(init.headers.apikey).toBe('anon-key');
        expect(init.headers.Authorization).toBe('Bearer anon-key');
        expect(init.headers['Content-Type']).toBe('application/json');
    });

    test('POSTs an empty p_card_ids array instead of omitting the field', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => [],
        });

        await printingRecentChanges('cardmarket', []);

        const [, init] = global.fetch.mock.calls[0];
        expect(JSON.parse(init.body)).toEqual({
            p_source: 'cardmarket',
            p_card_ids: [],
        });
    });

    test('throws on a non-OK response instead of inventing rows', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ message: 'boom' }),
        });

        await expect(printingRecentChanges('tcgplayer', ['aaa-normal'])).rejects.toThrow(
            /FAB database request failed \(500\).*fab_printing_recent_changes/,
        );
    });

    test('rejects a null ids list instead of catalog-scanning', async () => {
        await expect(printingRecentChanges('tcgplayer', null)).rejects.toThrow(
            /p_card_ids must not be null/,
        );
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
