import {
    reconcileBinderAfterTrade,
    tradeLinesFromList,
} from '../../src/utils/confirmTrade.js';

const binder = (cardId, quantity, { wanted = false, condition = 'NM' } = {}) => ({
    cardId,
    quantity,
    isWanted: wanted,
    condition,
    card: { id: cardId, name: cardId },
    addedAt: '2026-07-01T00:00:00.000Z',
});

describe('reconcileBinderAfterTrade', () => {
    const now = '2026-07-01T00:00:00.000Z';

    test('decrements given cards and clamps at zero', () => {
        const next = reconcileBinderAfterTrade({
            entries: [binder('a', 1)],
            haveItems: [{ cardId: 'a', quantity: 3 }],
            wantItems: [],
            removeGivenFromBinder: true,
            addReceivedToBinder: false,
            now,
        });
        expect(next).toEqual([]);
    });

    test('adds received cards to binder with NM merge', () => {
        const next = reconcileBinderAfterTrade({
            entries: [binder('b', 1, { condition: 'LP' })],
            haveItems: [],
            wantItems: [{ cardId: 'b', quantity: 2, card: { _uniqueId: 'b', name: 'B' } }],
            removeGivenFromBinder: false,
            addReceivedToBinder: true,
            now,
        });
        expect(next).toHaveLength(2);
        const lp = next.find((e) => e.condition === 'LP');
        const nm = next.find((e) => e.condition === 'NM');
        expect(lp.quantity).toBe(1);
        expect(nm.quantity).toBe(2);
        expect(nm.binderId).toBe('system:trade');
    });

    test('creates new NM binder row for received cards', () => {
        const next = reconcileBinderAfterTrade({
            entries: [],
            haveItems: [],
            wantItems: [{ cardId: 'c', quantity: 1, card: { _uniqueId: 'c', name: 'C' } }],
            removeGivenFromBinder: false,
            addReceivedToBinder: true,
            now,
        });
        expect(next).toHaveLength(1);
        expect(next[0]).toMatchObject({
            cardId: 'c',
            quantity: 1,
            condition: 'NM',
            isWanted: false,
        });
    });

    test('clears received cards from want list even when add is off', () => {
        const next = reconcileBinderAfterTrade({
            entries: [binder('c', 2, { wanted: true })],
            haveItems: [],
            wantItems: [{ cardId: 'c', quantity: 1 }],
            removeGivenFromBinder: false,
            addReceivedToBinder: false,
            now,
        });
        expect(next).toHaveLength(1);
        expect(next[0].quantity).toBe(1);
        expect(next[0].isWanted).toBe(true);
    });

    test('skips binder mutations when both checkboxes are off but still clears wants', () => {
        const start = [binder('g', 5), binder('r', 1, { wanted: true })];
        const next = reconcileBinderAfterTrade({
            entries: start,
            haveItems: [{ cardId: 'g', quantity: 1 }],
            wantItems: [{ cardId: 'r', quantity: 1 }],
            removeGivenFromBinder: false,
            addReceivedToBinder: false,
            now,
        });
        expect(next.find((e) => e.cardId === 'g').quantity).toBe(5);
        expect(next.find((e) => e.cardId === 'r')).toBeUndefined();
    });
});

describe('tradeLinesFromList', () => {
    test('maps uniqueId and quantity', () => {
        expect(
            tradeLinesFromList([
                { uniqueId: 'a-normal', name: 'A', quantity: 2, price: 10 },
                { name: 'No id', quantity: 1 },
            ]),
        ).toEqual([
            {
                cardId: 'a-normal',
                quantity: 2,
                card: expect.objectContaining({
                    _uniqueId: 'a-normal',
                    name: 'A',
                    marketPrice: 10,
                }),
            },
        ]);
    });
});
