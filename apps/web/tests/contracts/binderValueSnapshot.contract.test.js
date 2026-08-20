// Contract tests for Binder-value snapshot math.
//
// These assert the shared fixtures in packages/contracts, which the Dart
// implementation in apps/mobile is held to as well. Overlay chrome is out of
// scope. See packages/contracts/README.md.
import contract from '../../../../packages/contracts/binder_value_snapshot.json';
import { buildBinderValueSnapshot } from '../../src/utils/binderValueSnapshot.js';

const expectMoney = (got, want, digits) => {
    expect(got.pricedCopies).toBe(want.pricedCopies);
    expect(got.unpricedCopies).toBe(want.unpricedCopies);
    if (want.amount === null) {
        expect(got.amount).toBeNull();
    } else {
        expect(got.amount).toBeCloseTo(want.amount, digits);
    }
};

describe('binder value snapshot contract', () => {
    const digits = 9;

    contract.cases.forEach((testCase) => {
        it(testCase.name, () => {
            const snap = buildBinderValueSnapshot(testCase.entries, {
                source: testCase.source,
                headline: testCase.headline,
            });
            const expected = testCase.expected;

            expect(snap.copies).toBe(expected.copies);
            expect(snap.distinctPrintings).toBe(expected.distinctPrintings);
            expect(snap.foilCopies).toBe(expected.foilCopies);
            expect(snap.regularCopies).toBe(expected.regularCopies);
            expect(snap.tcgUnpricedCopies).toBe(expected.tcgUnpricedCopies);
            expect(snap.cmUnpricedCopies).toBe(expected.cmUnpricedCopies);
            expectMoney(snap.tcgMarket, expected.tcgMarket, digits);
            expectMoney(snap.tcgLow, expected.tcgLow, digits);
            expectMoney(snap.cmTrend, expected.cmTrend, digits);
            expectMoney(snap.cmLow, expected.cmLow, digits);

            expect(snap.topPrintings).toHaveLength(expected.topPrintings.length);
            expected.topPrintings.forEach((want, i) => {
                const got = snap.topPrintings[i];
                expect(got.printingId).toBe(want.printingId);
                expect(got.name).toBe(want.name);
                expect(got.finish).toBe(want.finish);
                expect(got.quantity).toBe(want.quantity);
                expect(got.contribution).toBeCloseTo(want.contribution, digits);
            });
        });
    });
});
