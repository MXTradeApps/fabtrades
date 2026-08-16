import { printingsForCard, resolvePrinting } from '../../src/utils/printingsForCard.js';
import {
    catalogFixture,
    pricedPrinting,
    foilSibling,
    reprintSibling,
    unpricedPrinting,
    otherCard,
} from '../fixtures/printings.js';

describe('printingsForCard', () => {
    test('returns only siblings of the opened Printing, including reprints', () => {
        const siblings = printingsForCard(catalogFixture, pricedPrinting);
        const ids = siblings.map((p) => p._uniqueId).sort();
        expect(ids).toEqual(
            [pricedPrinting._uniqueId, foilSibling._uniqueId, reprintSibling._uniqueId].sort(),
        );
        expect(siblings.find((p) => p._uniqueId === unpricedPrinting._uniqueId)).toBeUndefined();
        expect(siblings.find((p) => p._uniqueId === otherCard._uniqueId)).toBeUndefined();
    });

    test('switching the input Printing changes the sibling set', () => {
        expect(printingsForCard(catalogFixture, unpricedPrinting)).toEqual([unpricedPrinting]);
        expect(printingsForCard(catalogFixture, otherCard)).toEqual([otherCard]);
    });

    test('returns an empty list when there is no catalog name', () => {
        expect(printingsForCard(catalogFixture, {})).toEqual([]);
        expect(printingsForCard(null, pricedPrinting)).toEqual([]);
    });
});

describe('resolvePrinting', () => {
    const lookup = {
        [pricedPrinting._uniqueId]: pricedPrinting,
    };

    test('resolves via uniqueId lookup', () => {
        expect(resolvePrinting({ uniqueId: pricedPrinting._uniqueId, name: 'x' }, lookup))
            .toBe(pricedPrinting);
    });

    test('returns null when there is no Printing identity', () => {
        expect(resolvePrinting({ name: 'Decorative' }, lookup)).toBeNull();
    });
});
