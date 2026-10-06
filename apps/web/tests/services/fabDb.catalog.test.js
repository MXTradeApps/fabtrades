jest.mock('../../src/config/env.js', () => ({
    requireSupabaseConfig: () => ({
        url: 'https://example.supabase.co',
        key: 'anon-key',
    }),
}));

import { catalogSnapshotIsStale, fetchCatalog } from '../../src/services/fabDb.js';

const SNAPSHOT_URL = '/catalog/catalog-old.json';

const jsonResponse = (body, { ok = true, status = 200, headers = {} } = {}) => ({
    ok,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
});

const liveCard = {
    id: '1-normal',
    product_id: 1,
    set_id: 10,
    name: 'Command and Conquer',
    image_url: '',
    sub_type_name: 'Normal',
    rarity: 'Majestic',
    collector_number: 'ARC000',
    card_type: 'Instant',
    card_sub_type: '',
    card_class: 'Generic',
    talent: '',
    pitch: '1',
    cost: '0',
    power: '',
    defense: '3',
    life: '',
    intellect: '',
    set_name: 'Arcane Rising',
    tcg_low: 40,
    tcg_mid: 50,
    tcg_high: 60,
    tcg_market: 55,
    tcg_direct_low: 42,
    cm_avg: null,
    cm_low: null,
    cm_trend: null,
    cm_avg_foil: null,
    cm_low_foil: null,
    cm_trend_foil: null,
};

describe('catalogSnapshotIsStale', () => {
    test('a later pipeline timestamp is stale', () => {
        expect(catalogSnapshotIsStale(
            '2026-10-05T06:00:00.000Z',
            '2026-10-06T06:00:00.000Z',
        )).toBe(true);
    });

    test('the same instant keeps the snapshot, including a +00:00 spelling', () => {
        expect(catalogSnapshotIsStale(
            '2026-10-06T06:00:00.000Z',
            '2026-10-06T06:00:00+00:00',
        )).toBe(false);
    });

    test('an older live timestamp keeps the snapshot', () => {
        expect(catalogSnapshotIsStale(
            '2026-10-06T06:00:00.000Z',
            '2026-10-05T06:00:00.000Z',
        )).toBe(false);
    });

    test('a missing live timestamp keeps the snapshot', () => {
        expect(catalogSnapshotIsStale('2026-10-06T06:00:00.000Z', null)).toBe(false);
    });

    test('a snapshot with no timestamp is stale once the database has one', () => {
        expect(catalogSnapshotIsStale(null, '2026-10-06T06:00:00.000Z')).toBe(true);
    });
});

describe('fetchCatalog price freshness', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const snapshotBody = {
        version: 1,
        pricesUpdatedAt: '2026-10-05T06:00:00.000Z',
        sets: [],
        rows: [{ _uniqueId: '1-normal', marketPrice: 10, name: 'Command and Conquer' }],
    };

    test('keeps the snapshot when the pipeline has not run since the build', async () => {
        global.fetch.mockImplementation(async (url) => {
            if (String(url).includes('fab_card_prices')) {
                return jsonResponse([{ updated_at: '2026-10-05T06:00:00.000Z' }]);
            }
            return jsonResponse(snapshotBody);
        });

        const catalog = await fetchCatalog({ snapshotUrl: SNAPSHOT_URL });

        expect(catalog.rows[0].marketPrice).toBe(10);
        expect(global.fetch).toHaveBeenCalledTimes(2);
        const priceCheck = global.fetch.mock.calls.find(([url]) => String(url).includes('fab_card_prices'));
        expect(priceCheck[1].cache).toBe('no-store');
    });

    test('reads the database when the pipeline is newer than the snapshot', async () => {
        global.fetch.mockImplementation(async (url) => {
            const href = String(url);
            if (href === SNAPSHOT_URL) return jsonResponse(snapshotBody);
            if (href.includes('fab_card_prices')) {
                return jsonResponse([{ updated_at: '2026-10-06T06:00:00.000Z' }]);
            }
            if (href.includes('fab_cards_with_prices')) {
                return jsonResponse([liveCard], { headers: { 'content-range': '0-0/1' } });
            }
            if (href.includes('fab_sets')) {
                return jsonResponse([{
                    group_id: 10,
                    name: 'Arcane Rising',
                    set_number: 4,
                    abbreviation: 'ARC',
                    published_on: null,
                    is_supplemental: false,
                    modified_on: null,
                }]);
            }
            throw new Error(`unexpected fetch ${href}`);
        });

        const catalog = await fetchCatalog({ snapshotUrl: SNAPSHOT_URL });

        expect(catalog.pricesUpdatedAt).toBe('2026-10-06T06:00:00.000Z');
        expect(catalog.rows[0].marketPrice).toBe(55);
        expect(catalog.rows[0]._setNumber).toBe(4);
        expect(global.fetch.mock.calls.some(([url]) => String(url).includes('fab_cards_with_prices'))).toBe(true);
    });

    test('keeps the snapshot when the freshness check fails', async () => {
        global.fetch.mockImplementation(async (url) => {
            if (String(url).includes('fab_card_prices')) {
                return jsonResponse({ message: 'nope' }, { ok: false, status: 500 });
            }
            return jsonResponse(snapshotBody);
        });

        const catalog = await fetchCatalog({ snapshotUrl: SNAPSHOT_URL });

        expect(catalog.rows[0].marketPrice).toBe(10);
        expect(global.fetch.mock.calls.some(([url]) => String(url).includes('fab_cards_with_prices'))).toBe(false);
    });
});
