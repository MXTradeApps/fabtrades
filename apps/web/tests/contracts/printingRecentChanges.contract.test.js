// Contract tests for printing recent-change overlay lookup.
//
// These assert the shared fixtures in packages/contracts, which the Dart
// implementation in apps/mobile is held to as well. A failure here means either
// this file's logic drifted from mobile, or the agreed behaviour changed and both
// sides plus the fixture need updating. See packages/contracts/README.md.
import contract from '../../../../packages/contracts/printing_recent_changes.json';
import { lookupPrintingRecentChanges } from '../../src/utils/recentMovers.js';

describe('printing recent changes contract', () => {
    const today = contract.today;

    describe('lookupPrintingRecentChanges', () => {
        contract.lookup_cases.forEach((c) => {
            it(c.name, () => {
                const overlays = lookupPrintingRecentChanges({
                    today,
                    source: c.source,
                    snapshotsByCard: c.snapshots_by_card,
                    currentLows: c.current_lows,
                    cardIds: c.card_ids,
                });
                expect(overlays).toEqual(c.expected);
                for (const row of overlays) {
                    expect(row.percent_change).not.toBe(0);
                    expect(row.amount_change).toBeCloseTo(row.latest_low - row.start_low);
                    expect(row.percent_change).toBeCloseTo(
                        (row.latest_low - row.start_low) / row.start_low,
                    );
                }
            });
        });
    });

    it('includes an under-floor cheap spike', () => {
        const cheap = contract.lookup_cases.find((c) => c.name.includes('0.30'));
        const overlays = lookupPrintingRecentChanges({
            today,
            source: cheap.source,
            snapshotsByCard: cheap.snapshots_by_card,
            currentLows: cheap.current_lows,
            cardIds: cheap.card_ids,
        });
        expect(overlays).toHaveLength(1);
        expect(overlays[0].card_id).toBe('cheap-spike');
        expect(overlays[0].start_low).toBeLessThan(1);
    });

    it('omits 0%, missing window, and outliers', () => {
        const unchanged = contract.lookup_cases.find((c) => c.name.includes('2.00'));
        expect(lookupPrintingRecentChanges({
            today,
            source: unchanged.source,
            snapshotsByCard: unchanged.snapshots_by_card,
            currentLows: unchanged.current_lows,
            cardIds: unchanged.card_ids,
        })).toEqual([]);

        const window = contract.lookup_cases.find((c) => c.name.includes('2-day'));
        expect(lookupPrintingRecentChanges({
            today,
            source: window.source,
            snapshotsByCard: window.snapshots_by_card,
            currentLows: window.current_lows,
            cardIds: window.card_ids,
        }).map((r) => r.card_id)).toEqual(['in-window']);

        const outlier = contract.lookup_cases.find((c) => c.name.includes('outlier'));
        expect(lookupPrintingRecentChanges({
            today,
            source: outlier.source,
            snapshotsByCard: outlier.snapshots_by_card,
            currentLows: outlier.current_lows,
            cardIds: outlier.card_ids,
        }).map((r) => r.card_id)).toEqual(['at-percent-cap']);
    });

    it('never coerces a null Low to 0', () => {
        const nullCase = contract.lookup_cases.find((c) => c.name.includes('null Low'));
        expect(nullCase.snapshots_by_card['null-only'][0].tcg_low).toBeNull();
        const overlays = lookupPrintingRecentChanges({
            today,
            source: nullCase.source,
            snapshotsByCard: nullCase.snapshots_by_card,
            currentLows: nullCase.current_lows,
            cardIds: nullCase.card_ids,
        });
        expect(overlays.map((r) => r.card_id)).not.toContain('null-only');
        expect(overlays.some((r) => r.start_low === 0 || r.latest_low === 0)).toBe(false);
    });
});
