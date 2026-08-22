// Contract tests for the free-tier caps.
//
// These assert the shared fixtures in packages/contracts, which the Dart
// implementation in apps/mobile is held to as well. The caps have to match
// exactly: mobile enforces the trade window by tombstoning rows, so a web app
// that kept more would watch mobile delete trades it had saved.
import contract from '../../../../packages/contracts/free_limits.json';
import {
    FreeLimits,
    canAddDistinctCard,
    canCreateBinder,
    cardsFor,
    tradesOverFreeLimit,
} from '../../src/utils/freeLimits.js';

describe('free limits contract', () => {
    it('agrees with the shared caps', () => {
        expect(FreeLimits).toEqual(contract.limits);
    });

    contract.cases
        .filter((testCase) => testCase.limit === 'savedTrades')
        .forEach((testCase) => {
            it(testCase.name, () => {
                // Saving is never refused, only trimmed. Anything else would lose the
                // trade the customer just built.
                expect(testCase.allowed).toBe(true);
                expect(tradesOverFreeLimit(testCase.existing + 1)).toBe(testCase.trimmed);
            });
        });

    contract.cases
        .filter((testCase) =>
            (testCase.limit === 'binderCards' || testCase.limit === 'wantListCards') &&
            testCase.action !== 'move',
        )
        .forEach((testCase) => {
            it(testCase.name, () => {
                const isWanted = testCase.limit === 'wantListCards';
                expect(canAddDistinctCard(testCase.existing, { isWanted, isPro: false })).toBe(
                    testCase.allowed,
                );
            });
        });

    contract.cases
        .filter((testCase) => testCase.limit === 'binderCards' && testCase.action === 'move')
        .forEach((testCase) => {
            it(testCase.name, () => {
                expect(testCase.allowed).toBe(true);
                // A move does not raise distinct owned count, so the cap is not consulted.
                expect(canAddDistinctCard(testCase.existing, { isWanted: false, isPro: false })).toBe(false);
            });
        });

    contract.cases
        .filter((testCase) => testCase.limit === 'binders')
        .forEach((testCase) => {
            it(testCase.name, () => {
                expect(
                    canCreateBinder(testCase.existing, { isPro: Boolean(testCase.isPro) }),
                ).toBe(testCase.allowed);
            });
        });

    it('maps cardsFor to the binder vs want caps', () => {
        expect(cardsFor({ isWanted: false })).toBe(FreeLimits.binderCards);
        expect(cardsFor({ isWanted: true })).toBe(FreeLimits.wantListCards);
    });

    it('never blocks Pro binder or want-list adds', () => {
        expect(canAddDistinctCard(100, { isWanted: false, isPro: true })).toBe(true);
        expect(canAddDistinctCard(100, { isWanted: true, isPro: true })).toBe(true);
    });

    it('trims nothing for an account inside the window', () => {
        expect(tradesOverFreeLimit(0)).toBe(0);
        expect(tradesOverFreeLimit(FreeLimits.savedTrades)).toBe(0);
    });
});
