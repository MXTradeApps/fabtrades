// Contract tests for Low-series price-history math.
//
// These assert the shared fixtures in packages/contracts, which the Dart
// implementation in apps/mobile is held to as well. Overlay chrome (web span
// control, mobile Pro CTA) is out of scope. See packages/contracts/README.md.
import contract from '../../../../packages/contracts/price_history_series.json';
import {
    priceHistorySeries,
    windowStartFor,
    formatDateOnly,
} from '../../src/utils/priceHistorySeries.js';

describe('price history series contract', () => {
    test('window start is today minus 29 calendar days', () => {
        expect(formatDateOnly(windowStartFor(contract.now))).toBe(contract.windowStart);
    });

    contract.cases.forEach((testCase) => {
        it(testCase.name, () => {
            const series = priceHistorySeries({
                snapshots: testCase.snapshots,
                source: testCase.source,
                window: testCase.window,
                now: contract.now,
            });
            expect(series.points).toEqual(testCase.expected.points);
            expect(series.hasOlder).toBe(testCase.expected.hasOlder);
            expect(series.chartable).toBe(testCase.expected.chartable);
            if (testCase.expected.delta === null) {
                expect(series.delta).toBeNull();
            } else {
                expect(series.delta).toBeCloseTo(testCase.expected.delta);
            }
        });
    });

    it('never coerces a null Low to 0', () => {
        const gap = contract.cases.find((c) => c.name.includes('null Low'));
        expect(gap.snapshots.some((s) => s.tcg_low === null)).toBe(true);
        const series = priceHistorySeries({
            snapshots: gap.snapshots,
            source: gap.source,
            window: gap.window,
            now: contract.now,
        });
        expect(series.points.some((p) => p.low === 0)).toBe(false);
    });
});
