import {
    PRICE_HISTORY_WINDOW,
    changeLabel,
    emptyHistoryCopy,
    priceHistorySeries,
} from '../../src/utils/priceHistorySeries.js';

const now = '2026-08-16';

const snaps = [
    { captured_on: '2026-06-01', tcg_low: 1.0, cm_low: null },
    { captured_on: '2026-08-01', tcg_low: 2.0, cm_low: 1.5 },
    { captured_on: '2026-08-16', tcg_low: 4.0, cm_low: 2.0 },
];

describe('priceHistorySeries chrome and labels', () => {
    test('span control is Pro + hasOlder + chartable', () => {
        const free = priceHistorySeries({
            snapshots: snaps,
            source: 'tcgplayer',
            now,
        });
        expect(free.showSpanControl).toBe(false);
        expect(free.chartable).toBe(true);
        expect(free.hasOlder).toBe(true);

        const pro = priceHistorySeries({
            snapshots: snaps,
            source: 'tcgplayer',
            isPro: true,
            now,
        });
        expect(pro.showSpanControl).toBe(true);
    });

    test('no span control when the window is not chartable', () => {
        const series = priceHistorySeries({
            snapshots: [
                { captured_on: '2026-06-01', tcg_low: 1.0 },
                { captured_on: '2026-08-16', tcg_low: 2.0 },
            ],
            source: 'tcgplayer',
            isPro: true,
            now,
        });
        expect(series.chartable).toBe(false);
        expect(series.showSpanControl).toBe(false);
        expect(changeLabel(series, 'tcgplayer')).toBeNull();
    });

    test('changeLabel uses the visible-window delta and marketplace currency', () => {
        const up = priceHistorySeries({
            snapshots: snaps,
            source: 'tcgplayer',
            now,
        });
        expect(changeLabel(up, 'tcgplayer')).toBe('Low up $2.00');

        const down = priceHistorySeries({
            snapshots: [
                { captured_on: '2026-08-01', tcg_low: 4.0 },
                { captured_on: '2026-08-16', tcg_low: 3.0 },
            ],
            source: 'tcgplayer',
            now,
        });
        expect(changeLabel(down, 'tcgplayer')).toBe('Low down $1.00');

        const flat = priceHistorySeries({
            snapshots: [
                { captured_on: '2026-08-01', tcg_low: 2.0 },
                { captured_on: '2026-08-16', tcg_low: 2.0 },
            ],
            source: 'tcgplayer',
            now,
        });
        expect(changeLabel(flat, 'tcgplayer')).toBe('Low unchanged');

        const euro = priceHistorySeries({
            snapshots: snaps,
            source: 'cardmarket',
            now,
        });
        expect(changeLabel(euro, 'cardmarket')).toBe('Low up €0.50');
    });

    test('empty copy names the marketplace when the other series would chart', () => {
        const tcgOnly = [
            { captured_on: '2026-08-01', tcg_low: 1.0, cm_low: null },
            { captured_on: '2026-08-16', tcg_low: 2.0, cm_low: null },
        ];
        expect(emptyHistoryCopy(tcgOnly, 'cardmarket')).toBe(
            "History isn't available for CardMarket yet",
        );
        expect(emptyHistoryCopy([{ captured_on: '2026-08-16', tcg_low: 1.0 }], 'tcgplayer'))
            .toBe('History not available yet');
    });

    test('full window recomputes the change over older Lows', () => {
        const clipped = priceHistorySeries({
            snapshots: snaps,
            source: 'tcgplayer',
            now,
        });
        expect(clipped.delta).toBe(2);
        const full = priceHistorySeries({
            snapshots: snaps,
            source: 'tcgplayer',
            isPro: true,
            window: PRICE_HISTORY_WINDOW.full,
            now,
        });
        expect(full.delta).toBe(3);
        expect(changeLabel(full, 'tcgplayer')).toBe('Low up $3.00');
    });
});
