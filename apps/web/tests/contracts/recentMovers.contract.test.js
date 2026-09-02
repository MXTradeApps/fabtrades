// Contract tests for recent movers ranking and owned Printing ids.
//
// These assert the shared fixtures in packages/contracts, which the Dart
// implementation in apps/mobile is held to as well. A failure here means either
// this file's logic drifted from mobile, or the agreed behaviour changed and both
// sides plus the fixture need updating. See packages/contracts/README.md.
import contract from '../../../../packages/contracts/recent_movers.json';
import { ownedPrintingIds, rankRecentMovers } from '../../src/utils/recentMovers.js';

describe('recent movers contract', () => {
    const today = contract.today;

    describe('rankRecentMovers', () => {
        contract.ranking_cases.forEach((c) => {
            it(c.name, () => {
                const ranked = rankRecentMovers({
                    today,
                    source: c.source,
                    snapshotsByCard: c.snapshots_by_card,
                    currentLows: c.current_lows,
                });
                expect(ranked.gainers).toEqual(c.expected.gainers);
                expect(ranked.losers).toEqual(c.expected.losers);
                for (const row of [...ranked.gainers, ...ranked.losers]) {
                    expect(row.start_low).not.toBe(0);
                    expect(row.amount_change).toBeCloseTo(row.latest_low - row.start_low);
                    expect(row.percent_change).toBeCloseTo(
                        (row.latest_low - row.start_low) / row.start_low,
                    );
                }
            });
        });
    });

    describe('ownedPrintingIds', () => {
        contract.owned_id_cases.forEach((c) => {
            it(c.name, () => {
                expect(ownedPrintingIds(c.entries)).toEqual(c.expected_ids);
            });
        });
    });

    it('never coerces a null Low to 0', () => {
        const nullCase = contract.ranking_cases.find((c) => c.name.includes('null Low'));
        expect(nullCase.snapshots_by_card['null-only'][0].tcg_low).toBeNull();
        const ranked = rankRecentMovers({
            today,
            source: nullCase.source,
            snapshotsByCard: nullCase.snapshots_by_card,
            currentLows: nullCase.current_lows,
        });
        expect(ranked.gainers.map((r) => r.card_id)).not.toContain('null-only');
        expect(ranked.gainers.some((r) => r.start_low === 0 || r.latest_low === 0)).toBe(false);
    });
});
