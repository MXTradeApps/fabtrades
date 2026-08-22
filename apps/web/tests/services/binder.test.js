jest.mock('../../src/lib/supabase.js', () => {
    const auth = { getUser: jest.fn() };
    const supabase = { auth, from: jest.fn(), rpc: jest.fn() };
    return { supabase };
});

jest.mock('../../src/services/entitlements.js', () => ({
    fetchEntitlement: jest.fn(),
}));

import { supabase } from '../../src/lib/supabase.js';
import { fetchEntitlement } from '../../src/services/entitlements.js';
import {
    BINDER_CONDITIONS,
    binderShareUrl,
    cardStub,
    checkCanAddBinderCard,
    ensureBinderShare,
    getBinderEntries,
    getPublicBinder,
    newBinderShareToken,
    parseCardStub,
    removeEntry,
    upsertEntry,
} from '../../src/services/binder.js';

const makeChain = (result) => {
    const chain = {
        then: (resolve) => resolve(result),
    };
    const methods = [
        'insert',
        'select',
        'single',
        'maybeSingle',
        'eq',
        'in',
        'is',
        'order',
        'update',
        'delete',
        'upsert',
    ];
    for (const method of methods) {
        chain[method] = jest.fn(() => chain);
    }
    return chain;
};

const asUser = (id = 'user-1') =>
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id } } });
const asAnonymous = () =>
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } });

const webCard = {
    _uniqueId: '12345-foil',
    productId: '12345',
    name: 'Fyendal\'s Spring Tunic',
    _setName: 'Welcome to Rathe',
    subTypeName: 'Rainbow Foil',
    extRarity: 'Legendary',
    extNumber: 'WTR000',
    imageUrl: 'https://example.com/tunic.webp',
    extCardType: 'Equipment',
    extClass: 'Generic',
    extPitchValue: 0,
    marketPrice: 120.5,
    lowPrice: 99,
};

describe('cardStub / parseCardStub', () => {
    test('writes the mobile snake_case stub keys', () => {
        const stub = cardStub(webCard);
        expect(Object.keys(stub).sort()).toEqual([
            'card_class',
            'card_type',
            'cm_low',
            'cm_trend',
            'collector_number',
            'id',
            'image_url',
            'is_foil',
            'name',
            'pitch',
            'product_id',
            'rarity',
            'set_name',
            'sub_type_name',
            'tcg_low',
            'tcg_market',
        ].sort());
        expect(stub).toMatchObject({
            id: '12345-foil',
            product_id: 12345,
            name: 'Fyendal\'s Spring Tunic',
            set_name: 'Welcome to Rathe',
            sub_type_name: 'Rainbow Foil',
            is_foil: true,
            rarity: 'Legendary',
            collector_number: 'WTR000',
            image_url: 'https://example.com/tunic.webp',
            card_type: 'Equipment',
            card_class: 'Generic',
            pitch: '0',
            tcg_market: 120.5,
            tcg_low: 99,
            cm_trend: null,
            cm_low: null,
        });
    });

    test('round-trips through parseCardStub with mobile-expected keys preserved on re-stub', () => {
        const stub = cardStub(webCard);
        const parsed = parseCardStub(stub);
        expect(parsed).toMatchObject({
            id: '12345-foil',
            name: 'Fyendal\'s Spring Tunic',
            setName: 'Welcome to Rathe',
            subTypeName: 'Rainbow Foil',
            isFoil: true,
            tcgMarket: 120.5,
        });
        // Re-stubbing a stub (or parse result fed back) keeps snake_case identity keys.
        expect(cardStub(stub).id).toBe('12345-foil');
        expect(cardStub(stub).product_id).toBe(12345);
    });

    test('exposes the shared condition enum', () => {
        expect(BINDER_CONDITIONS).toEqual(['NM', 'LP', 'MP', 'HP', 'DMG']);
    });
});

describe('getBinderEntries', () => {
    test('errors when anonymous', async () => {
        asAnonymous();
        const { data, error } = await getBinderEntries();
        expect(data).toBeNull();
        expect(error.message).toMatch(/logged in/i);
    });

    test('splits binder vs wants and filters live rows only', async () => {
        asUser('user-42');
        const chain = makeChain({
            data: [
                {
                    card_id: 'a',
                    is_wanted: false,
                    quantity: 2,
                    condition: 'LP',
                    card: cardStub(webCard),
                    added_at: '2026-01-01T00:00:00.000Z',
                    updated_at: '2026-01-02T00:00:00.000Z',
                },
                {
                    card_id: 'b',
                    is_wanted: true,
                    quantity: 1,
                    condition: 'NM',
                    card: { id: 'b', name: 'Wanted', product_id: 1, set_name: 'Set', sub_type_name: null, is_foil: false, rarity: null, collector_number: null, image_url: null, card_type: null, card_class: null, pitch: null, tcg_market: 1, tcg_low: null, cm_trend: null, cm_low: null },
                    added_at: '2026-01-03T00:00:00.000Z',
                    updated_at: '2026-01-03T00:00:00.000Z',
                },
            ],
            error: null,
        });
        supabase.from.mockReturnValue(chain);

        const { data, error } = await getBinderEntries();

        expect(error).toBeNull();
        expect(supabase.from).toHaveBeenCalledWith('binder_entries');
        expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-42');
        expect(chain.is).toHaveBeenCalledWith('deleted_at', null);
        expect(data.binder).toHaveLength(1);
        expect(data.wants).toHaveLength(1);
        expect(data.binder[0].card.name).toBe('Fyendal\'s Spring Tunic');
        expect(data.wants[0].cardId).toBe('b');
    });
});

describe('upsertEntry / removeEntry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('upserts with client updated_at, cleared deleted_at, and mobile stub', async () => {
        asUser('user-7');
        const saved = {
            card_id: '12345-foil',
            is_wanted: false,
            quantity: 1,
            condition: 'NM',
            card: cardStub(webCard),
            added_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
        };
        const chain = makeChain({ data: saved, error: null });
        supabase.from.mockReturnValue(chain);

        const before = Date.now();
        const { data, error } = await upsertEntry({
            cardId: '12345-foil',
            isWanted: false,
            quantity: 1,
            condition: 'NM',
            card: webCard,
        });
        const after = Date.now();

        expect(error).toBeNull();
        expect(data.cardId).toBe('12345-foil');
        expect(chain.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'user-7',
                card_id: '12345-foil',
                is_wanted: false,
                quantity: 1,
                deleted_at: null,
                card: expect.objectContaining({
                    id: '12345-foil',
                    product_id: 12345,
                    set_name: 'Welcome to Rathe',
                }),
            }),
            { onConflict: 'user_id,client_id' },
        );
        const payload = chain.upsert.mock.calls[0][0];
        const updatedAt = Date.parse(payload.updated_at);
        expect(updatedAt).toBeGreaterThanOrEqual(before);
        expect(updatedAt).toBeLessThanOrEqual(after);
    });

    test('quantity <= 0 tombstones instead of upserting', async () => {
        asUser();
        const chain = makeChain({ data: null, error: null });
        supabase.from.mockReturnValue(chain);

        const { data, error } = await upsertEntry({
            cardId: '12345-foil',
            isWanted: true,
            quantity: 0,
            card: webCard,
        });

        expect(error).toBeNull();
        expect(data).toEqual({ success: true });
        expect(chain.update).toHaveBeenCalledWith(
            expect.objectContaining({
                deleted_at: expect.any(String),
                updated_at: expect.any(String),
            }),
        );
        expect(chain.eq).toHaveBeenCalledWith('client_id', 'want|12345-foil');
        expect(chain.upsert).not.toHaveBeenCalled();
    });

    test('removeEntry sets deleted_at and updated_at together', async () => {
        asUser('user-9');
        const chain = makeChain({ data: null, error: null });
        supabase.from.mockReturnValue(chain);

        await removeEntry('card-1', false);

        const update = chain.update.mock.calls[0][0];
        expect(update.deleted_at).toBe(update.updated_at);
        expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-9');
    });
});

describe('checkCanAddBinderCard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('allows topping up an already-listed card even at the free cap', async () => {
        asUser();
        const { allowed } = await checkCanAddBinderCard({
            isWanted: false,
            existingDistinctCount: 5,
            alreadyListed: true,
        });
        expect(allowed).toBe(true);
        expect(fetchEntitlement).not.toHaveBeenCalled();
    });

    test('refuses a new binder card at the free cap', async () => {
        asUser('user-1');
        fetchEntitlement.mockResolvedValue({
            entitlement: { isPro: false },
        });
        const { allowed, isPro } = await checkCanAddBinderCard({
            isWanted: false,
            existingDistinctCount: 50,
            alreadyListed: false,
        });
        expect(allowed).toBe(false);
        expect(isPro).toBe(false);
        expect(fetchEntitlement).toHaveBeenCalledWith('user-1');
    });

    test('allows Pro past the free cap', async () => {
        asUser('user-1');
        fetchEntitlement.mockResolvedValue({
            entitlement: { isPro: true },
        });
        const { allowed } = await checkCanAddBinderCard({
            isWanted: true,
            existingDistinctCount: 40,
        });
        expect(allowed).toBe(true);
    });
});

describe('binder share helpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('newBinderShareToken returns 32 hex chars', () => {
        const token = newBinderShareToken();
        expect(token).toMatch(/^[0-9a-f]{32}$/);
    });

    test('binderShareUrl builds /b/:token path', () => {
        expect(binderShareUrl('abc123def4567890', 'https://fabtrades.net')).toBe(
            'https://fabtrades.net/b/abc123def4567890',
        );
    });

    test('ensureBinderShare creates a row when none exists', async () => {
        asUser('user-share');
        const selectChain = makeChain({ data: null, error: null });
        const insertChain = makeChain({
            data: {
                token: 'a'.repeat(32),
                is_enabled: true,
                created_at: '2026-08-02T00:00:00.000Z',
                updated_at: '2026-08-02T00:00:00.000Z',
            },
            error: null,
        });
        supabase.from
            .mockReturnValueOnce(selectChain)
            .mockReturnValueOnce(insertChain);

        const { data, error } = await ensureBinderShare();

        expect(error).toBeNull();
        expect(supabase.from).toHaveBeenCalledWith('binder_shares');
        expect(insertChain.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'user-share',
                is_enabled: true,
                token: expect.stringMatching(/^[0-9a-f]{32}$/),
            }),
        );
        expect(data.isEnabled).toBe(true);
        expect(data.url).toContain('/b/');
    });

    test('getPublicBinder maps RPC rows and rejects short tokens', async () => {
        const short = await getPublicBinder('too-short');
        expect(short.data).toBeNull();
        expect(short.error.message).toMatch(/invalid/i);

        supabase.rpc.mockResolvedValue({
            data: {
                entries: [
                    {
                        card_id: '12345-foil',
                        quantity: 2,
                        condition: 'LP',
                        card: cardStub(webCard),
                        added_at: '2026-01-01T00:00:00.000Z',
                        updated_at: '2026-01-02T00:00:00.000Z',
                    },
                ],
            },
            error: null,
        });

        const { data, error } = await getPublicBinder('a'.repeat(32));
        expect(error).toBeNull();
        expect(supabase.rpc).toHaveBeenCalledWith('get_public_binder', {
            p_token: 'a'.repeat(32),
        });
        expect(data.entries).toHaveLength(1);
        expect(data.entries[0]).toMatchObject({
            cardId: '12345-foil',
            quantity: 2,
            condition: 'LP',
            isWanted: false,
        });
        expect(data.entries[0].card.name).toBe('Fyendal\'s Spring Tunic');
    });

    test('getPublicBinder surfaces disabled/missing shares', async () => {
        supabase.rpc.mockResolvedValue({ data: null, error: null });
        const { data, error } = await getPublicBinder('b'.repeat(32));
        expect(data).toBeNull();
        expect(error.message).toMatch(/unavailable/i);
    });
});
