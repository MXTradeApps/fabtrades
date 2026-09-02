import { copiesByPrintingId, ownedPrintingIds, rankRecentMovers, startLowWindow, lookupPrintingRecentChanges } from '../../src/utils/recentMovers.js';

describe('recentMovers helpers', () => {
    test('startLowWindow is today minus 5 through today minus 3', () => {
        expect(startLowWindow('2026-08-26')).toEqual({
            from: '2026-08-21',
            to: '2026-08-23',
        });
    });

    test('distinguishes start Low from latest Low from derived percent', () => {
        const { gainers } = rankRecentMovers({
            today: '2026-08-26',
            source: 'tcgplayer',
            snapshotsByCard: {
                'card-a': [{ captured_on: '2026-08-23', tcg_low: 2, cm_low: 9 }],
            },
            currentLows: {
                'card-a': { tcg_low: 5, cm_low: 9, is_sealed: false },
            },
        });
        expect(gainers).toHaveLength(1);
        expect(gainers[0].start_low).toBe(2);
        expect(gainers[0].latest_low).toBe(5);
        expect(gainers[0].percent_change).toBe(1.5);
        expect(gainers[0].amount_change).toBe(3);
    });

    test('does not invent a Low for a missing start day', () => {
        const ranked = rankRecentMovers({
            today: '2026-08-26',
            source: 'tcgplayer',
            snapshotsByCard: {
                gap: [{ captured_on: '2026-08-24', tcg_low: 2 }],
            },
            currentLows: {
                gap: { tcg_low: 4, cm_low: null, is_sealed: false },
            },
        });
        expect(ranked.gainers).toEqual([]);
        expect(ranked.losers).toEqual([]);
    });

    test('omits implausible Lows and 1000%+ spikes', () => {
        const { gainers } = rankRecentMovers({
            today: '2026-08-26',
            source: 'tcgplayer',
            snapshotsByCard: {
                bogus: [{ captured_on: '2026-08-23', tcg_low: 2 }],
                spike: [{ captured_on: '2026-08-23', tcg_low: 1 }],
                ok: [{ captured_on: '2026-08-23', tcg_low: 2 }],
            },
            currentLows: {
                bogus: { tcg_low: 150000, cm_low: null, is_sealed: false },
                spike: { tcg_low: 50, cm_low: null, is_sealed: false },
                ok: { tcg_low: 4, cm_low: null, is_sealed: false },
            },
        });
        expect(gainers.map((row) => row.card_id)).toEqual(['ok']);
    });

    test('rejects an invalid source instead of defaulting to TCGplayer', () => {
        expect(() => rankRecentMovers({
            today: '2026-08-26',
            source: 'blend',
            snapshotsByCard: {},
            currentLows: {},
        })).toThrow(/tcgplayer or cardmarket/);
    });

    test('copiesByPrintingId sums two condition rows for one Printing', () => {
        expect(copiesByPrintingId([
            { cardId: 'print-1', isWanted: false, quantity: 2, condition: 'NM' },
            { cardId: 'print-1', isWanted: false, quantity: 3, condition: 'LP' },
        ])).toEqual({ 'print-1': 5 });
    });

    test('copiesByPrintingId omits Want List and qty 0', () => {
        expect(copiesByPrintingId([
            { cardId: 'print-1', isWanted: true, quantity: 2 },
            { cardId: 'print-2', isWanted: false, quantity: 0 },
        ])).toEqual({});
    });

    test('ownedPrintingIds unique-collapses Binder duplicates', () => {
        expect(ownedPrintingIds([
            { cardId: 'print-1', isWanted: false, quantity: 1, binderId: 'system:trade' },
            { cardId: 'print-1', isWanted: false, quantity: 2, binderId: 'system:collection' },
        ])).toEqual(['print-1']);
    });
});

describe('lookupPrintingRecentChanges helpers', () => {
    test('includes under-floor 0.30 to 0.60 and names start vs latest', () => {
        const overlays = lookupPrintingRecentChanges({
            today: '2026-08-26',
            source: 'tcgplayer',
            snapshotsByCard: {
                'cheap-spike': [{ captured_on: '2026-08-23', tcg_low: 0.3 }],
            },
            currentLows: {
                'cheap-spike': { tcg_low: 0.6, cm_low: null, is_sealed: false },
            },
            cardIds: ['cheap-spike'],
        });
        expect(overlays).toHaveLength(1);
        expect(overlays[0].start_low).toBe(0.3);
        expect(overlays[0].latest_low).toBe(0.6);
        expect(overlays[0].percent_change).toBe(1);
        expect(overlays[0].amount_change).toBe(0.3);
    });

    test('does not apply the ranked floor or top-10 cut', () => {
        const overlays = lookupPrintingRecentChanges({
            today: '2026-08-26',
            source: 'tcgplayer',
            snapshotsByCard: {
                cheap: [{ captured_on: '2026-08-23', tcg_low: 0.5 }],
            },
            currentLows: {
                cheap: { tcg_low: 0.8, cm_low: null, is_sealed: false },
            },
            cardIds: ['cheap'],
        });
        expect(overlays.map((row) => row.card_id)).toEqual(['cheap']);
    });

    test('rankRecentMovers still excludes under-floor cards', () => {
        const ranked = rankRecentMovers({
            today: '2026-08-26',
            source: 'tcgplayer',
            snapshotsByCard: {
                cheap: [{ captured_on: '2026-08-23', tcg_low: 0.3 }],
            },
            currentLows: {
                cheap: { tcg_low: 0.6, cm_low: null, is_sealed: false },
            },
        });
        expect(ranked.gainers).toEqual([]);
        expect(ranked.losers).toEqual([]);
    });
});
