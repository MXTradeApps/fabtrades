jest.mock('../../src/lib/supabase.js', () => {
    const auth = { getUser: jest.fn(), getSession: jest.fn() };
    const supabase = { auth, from: jest.fn() };
    return { supabase };
});

jest.mock('../../src/services/binder.js', () => ({
    getBinderEntries: jest.fn(),
    upsertEntry: jest.fn(),
    removeEntry: jest.fn(),
}));

jest.mock('../../src/services/tradeHistory.js', () => ({
    saveTradeToHistory: jest.fn(),
}));

import { confirmTrade } from '../../src/services/confirmTrade.js';
import {
    getBinderEntries,
    removeEntry,
    upsertEntry,
} from '../../src/services/binder.js';
import { saveTradeToHistory } from '../../src/services/tradeHistory.js';

describe('confirmTrade', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        saveTradeToHistory.mockResolvedValue({
            data: { id: 'trade-1' },
            error: null,
            trimmed: 0,
        });
        upsertEntry.mockResolvedValue({ data: {}, error: null });
        removeEntry.mockResolvedValue({ data: {}, error: null });
    });

    test('saves unnamed history and reconciles binder', async () => {
        getBinderEntries.mockResolvedValue({
            data: {
                all: [
                    {
                        cardId: 'give-1',
                        isWanted: false,
                        quantity: 2,
                        condition: 'NM',
                        stub: { id: 'give-1', name: 'Give' },
                        addedAt: '2026-01-01T00:00:00.000Z',
                    },
                    {
                        cardId: 'recv-1',
                        isWanted: true,
                        quantity: 1,
                        condition: 'NM',
                        stub: { id: 'recv-1', name: 'Recv' },
                        addedAt: '2026-01-01T00:00:00.000Z',
                    },
                ],
            },
            error: null,
        });

        const result = await confirmTrade({
            haveList: [{ uniqueId: 'give-1', name: 'Give', quantity: 1, price: 5 }],
            wantList: [{ uniqueId: 'recv-1', name: 'Recv', quantity: 1, price: 8 }],
            totals: { haveTotal: 5, wantTotal: 8, diff: -3 },
            removeGivenFromBinder: true,
            addReceivedToBinder: true,
        });

        expect(result.error).toBeNull();
        expect(result.binderReconciled).toBe(true);
        expect(saveTradeToHistory).toHaveBeenCalledWith(
            null,
            expect.any(Array),
            expect.any(Array),
            expect.any(Object),
            { unnamed: true },
        );

        expect(upsertEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                cardId: 'give-1',
                isWanted: false,
                quantity: 1,
            }),
        );
        expect(upsertEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                cardId: 'recv-1',
                isWanted: false,
                quantity: 1,
                condition: 'NM',
            }),
        );
        expect(removeEntry).toHaveBeenCalledWith('recv-1', true);
    });

    test('rejects an empty trade', async () => {
        const result = await confirmTrade({
            haveList: [],
            wantList: [],
            totals: { haveTotal: 0, wantTotal: 0, diff: 0 },
        });
        expect(result.error.message).toMatch(/before confirming/i);
        expect(saveTradeToHistory).not.toHaveBeenCalled();
    });

    test('returns saved history when binder load fails (partial success)', async () => {
        getBinderEntries.mockResolvedValue({
            data: null,
            error: { message: 'network down' },
        });

        const result = await confirmTrade({
            haveList: [{ uniqueId: 'give-1', name: 'Give', quantity: 1, price: 5 }],
            wantList: [],
            totals: { haveTotal: 5, wantTotal: 0, diff: 5 },
            removeGivenFromBinder: true,
        });

        expect(result.data).toEqual({ id: 'trade-1' });
        expect(result.error.message).toBe('network down');
        expect(upsertEntry).not.toHaveBeenCalled();
        expect(removeEntry).not.toHaveBeenCalled();
    });

    test('applies binder ops sequentially and stops on first failure', async () => {
        getBinderEntries.mockResolvedValue({
            data: {
                all: [
                    {
                        cardId: 'give-1',
                        isWanted: false,
                        quantity: 1,
                        condition: 'NM',
                        stub: { id: 'give-1', name: 'Give' },
                        addedAt: '2026-01-01T00:00:00.000Z',
                    },
                    {
                        cardId: 'recv-1',
                        isWanted: true,
                        quantity: 1,
                        condition: 'NM',
                        stub: { id: 'recv-1', name: 'Recv' },
                        addedAt: '2026-01-01T00:00:00.000Z',
                    },
                ],
            },
            error: null,
        });

        // First upsert (give qty → 0 removed via remove, or give qty change) —
        // for give qty 1 removed entirely: removeEntry for give-1, upsert recv to binder, remove want.
        // Order in applyBinderDiff: upserts first, then removes.
        // After reconcile with removeGiven + addReceived:
        // - give-1 gone from binder → remove
        // - recv-1 binder row upserted, want tombstoned
        upsertEntry.mockResolvedValueOnce({
            data: null,
            error: { message: 'upsert failed' },
        });

        const result = await confirmTrade({
            haveList: [{ uniqueId: 'give-1', name: 'Give', quantity: 1, price: 5 }],
            wantList: [{ uniqueId: 'recv-1', name: 'Recv', quantity: 1, price: 8 }],
            totals: { haveTotal: 5, wantTotal: 8, diff: -3 },
            removeGivenFromBinder: true,
            addReceivedToBinder: true,
        });

        expect(result.data).toEqual({ id: 'trade-1' });
        expect(result.error.message).toMatch(/upsert failed|binder could not be fully updated/i);
        // Stopped after first failing op — later removes must not run.
        expect(upsertEntry).toHaveBeenCalledTimes(1);
        expect(removeEntry).not.toHaveBeenCalled();
    });
});
