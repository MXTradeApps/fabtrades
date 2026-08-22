import contract from '../../../../packages/contracts/binder_move.json';
import { moveBinderCopies } from '../../src/utils/binderMove.js';

const identity = (e) => JSON.stringify({
    printingId: e.printingId || e.cardId,
    binderId: e.binderId ?? null,
    isWanted: Boolean(e.isWanted),
    quantity: e.quantity,
    condition: e.condition,
});

describe('binder move contract', () => {
    contract.cases.forEach((testCase) => {
        it(testCase.name, () => {
            const result = moveBinderCopies({
                binders: testCase.binders,
                entries: testCase.entries,
                fromBinderId: testCase.fromBinderId,
                toBinderId: testCase.toBinderId,
                printingId: testCase.printingId,
                condition: testCase.condition,
                quantity: testCase.quantity,
            });
            expect(result.ok).toBe(testCase.expected.ok);
            expect(result.reason).toBe(testCase.expected.reason);
            expect(result.distinctOwned).toBe(testCase.expected.distinctOwned);
            const actual = new Set(result.entries.map(identity));
            const expected = new Set(testCase.expected.entries.map(identity));
            expect(actual).toEqual(expected);
        });
    });
});
