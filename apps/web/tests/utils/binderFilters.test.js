import {
    EMPTY_BINDER_FILTERS,
    activeFilterCount,
    cardMatchesSearch,
    pitchOf,
    buildBinderFilterOptions,
    foilingOf,
    matchesBinderFilters,
    filtersFromParams,
    paramsWithFilters,
    toggleBinderFilter,
} from '../../src/utils/binderFilters.js';

const card = (overrides) => ({
    rarity: 'Common',
    finish: 'Normal',
    setName: 'Super Slam',
    collectorNumber: 'SUP001',
    ...overrides,
});

describe('foilingOf', () => {
    test.each([
        ['Rainbow Foil', 'rainbow'],
        ['Cold Foil', 'cold'],
        ['Gold Cold Foil', 'gold'],
        ['Foil', 'foil'],
        ['Normal', 'nonfoil'],
        ['', 'nonfoil'],
        [undefined, 'nonfoil'],
    ])('%s → %s', (finish, expected) => {
        expect(foilingOf(finish)).toBe(expected);
    });
});

describe('buildBinderFilterOptions', () => {
    const entries = [
        { id: 1, quantity: 2, card: card({ rarity: 'Common' }) },
        { id: 2, quantity: 1, card: card({ rarity: 'Fabled', finish: 'Cold Foil' }) },
        { id: 3, quantity: 1, card: card({ rarity: 'Majestic', finish: 'Rainbow Foil', setName: 'High Seas', collectorNumber: 'SEA010' }) },
        { id: 4, quantity: 1, card: card({ rarity: 'Pirate Booty', setName: 'Unlisted Set', collectorNumber: 'XYZ001' }) },
        { id: 5, quantity: 1, card: card({ rarity: 'None' }) },
    ];
    const resolveCard = (entry) => entry.card;
    const sets = [
        { groupId: 1, name: 'Super Slam', abbreviation: 'SUP', publishedOn: '2025-01-01' },
        { groupId: 2, name: 'High Seas', abbreviation: '', publishedOn: '2025-06-01' },
    ];

    test('orders rarities highest first and counts copies', () => {
        const { rarities } = buildBinderFilterOptions(entries, resolveCard, { sets });
        expect(rarities.map((r) => [r.id, r.count])).toEqual([
            ['Fabled', 1],
            ['Majestic', 1],
            ['Common', 2],
            ['Pirate Booty', 1],
        ]);
    });

    test('lists only foilings present, in fixed order', () => {
        const { foilings } = buildBinderFilterOptions(entries, resolveCard, { sets });
        expect(foilings.map((f) => f.id)).toEqual(['rainbow', 'cold', 'nonfoil']);
    });

    test('sets carry a code from metadata or the collector number, newest first, undated last', () => {
        const { sets: options } = buildBinderFilterOptions(entries, resolveCard, { sets });
        expect(options.map((s) => [s.name, s.code, s.groupId])).toEqual([
            ['High Seas', 'SEA', 2],
            ['Super Slam', 'SUP', 1],
            ['Unlisted Set', 'XYZ', null],
        ]);
    });
});

describe('matchesBinderFilters', () => {
    test('empty filters match everything', () => {
        expect(matchesBinderFilters(card(), EMPTY_BINDER_FILTERS)).toBe(true);
    });

    test('values within a group are OR, groups are AND', () => {
        const filters = {
            ...EMPTY_BINDER_FILTERS,
            rarities: ['Fabled', 'Marvel'],
            foilings: ['cold'],
        };
        expect(matchesBinderFilters(card({ rarity: 'Marvel', finish: 'Cold Foil' }), filters)).toBe(true);
        expect(matchesBinderFilters(card({ rarity: 'Marvel', finish: 'Normal' }), filters)).toBe(false);
        expect(matchesBinderFilters(card({ rarity: 'Common', finish: 'Cold Foil' }), filters)).toBe(false);
    });

    test('filters by set name', () => {
        const filters = { ...EMPTY_BINDER_FILTERS, sets: ['High Seas'] };
        expect(matchesBinderFilters(card({ setName: 'High Seas' }), filters)).toBe(true);
        expect(matchesBinderFilters(card(), filters)).toBe(false);
    });
});

describe('toggleBinderFilter / activeFilterCount', () => {
    test('adds then removes a value', () => {
        const once = toggleBinderFilter(EMPTY_BINDER_FILTERS, 'rarities', 'Fabled');
        expect(once.rarities).toEqual(['Fabled']);
        expect(activeFilterCount(once)).toBe(1);
        const twice = toggleBinderFilter(once, 'rarities', 'Fabled');
        expect(twice.rarities).toEqual([]);
        expect(activeFilterCount(twice)).toBe(0);
    });
});

describe('URL params', () => {
    test('round-trips filters and keeps other keys', () => {
        const filters = { rarities: ['Fabled', 'Marvel'], foilings: ['cold'], pitches: ['1', '3'], sets: ['High Seas, Vol 1'] };
        const params = paramsWithFilters(new URLSearchParams('b=binder-1&rarity=Common'), filters);
        expect(params.get('b')).toBe('binder-1');
        expect(filtersFromParams(params)).toEqual(filters);
    });

    test('drops unknown foilings and duplicates', () => {
        const params = new URLSearchParams('foil=cold&foil=sparkly&foil=cold');
        expect(filtersFromParams(params)).toEqual({ rarities: [], foilings: ['cold'], pitches: [], sets: [] });
    });
});

describe('set logos by name', () => {
    test('fills code and logo when the catalog has no row for the set', () => {
        const { sets } = buildBinderFilterOptions(
            [{ card: card({ setName: 'Monarch', collectorNumber: '' }) }],
            (entry) => entry.card,
            { logosByName: { Monarch: { logoUrl: 'https://example.com/mon.png', abbreviation: 'MON' } } },
        );
        expect(sets[0]).toMatchObject({ code: 'MON', logoUrl: 'https://example.com/mon.png', groupId: null });
    });
});

describe('faceted counts', () => {
    const entries = [
        { quantity: 2, card: card({ rarity: 'Majestic', setName: 'Outsiders', pitch: '1' }) },
        { quantity: 1, card: card({ rarity: 'Majestic', setName: 'Dynasty', pitch: '3' }) },
        { quantity: 1, card: card({ rarity: 'Common', setName: 'Dynasty', name: 'Snatch', pitch: '1' }) },
    ];
    const resolveCard = (entry) => entry.card;

    test('a group counts against the other groups, not itself', () => {
        const filters = { ...EMPTY_BINDER_FILTERS, sets: ['Outsiders'] };
        const options = buildBinderFilterOptions(entries, resolveCard, { filters });
        expect(options.rarities.map((o) => [o.id, o.count])).toEqual([['Majestic', 2], ['Common', 0]]);
        // Sets ignore their own pick so other sets still show what they'd add.
        expect(options.sets.map((o) => [o.id, o.count])).toEqual([['Dynasty', 2], ['Outsiders', 2]]);
        expect(options.pitches.map((o) => [o.id, o.count])).toEqual([['1', 2], ['3', 0]]);
    });

    test('search narrows the counts but keeps every option listed', () => {
        const options = buildBinderFilterOptions(entries, resolveCard, {
            matchesSearch: (entry, c) => cardMatchesSearch(c, 'snatch'),
        });
        expect(options.rarities.map((o) => [o.id, o.count])).toEqual([['Majestic', 0], ['Common', 1]]);
    });
});

describe('pitch', () => {
    test('pitchOf accepts numbers and strings, ignores the rest', () => {
        expect(pitchOf(2)).toBe('2');
        expect(pitchOf('3')).toBe('3');
        expect(pitchOf(0)).toBe('');
        expect(pitchOf(null)).toBe('');
    });

    test('filters by pitch', () => {
        const filters = { ...EMPTY_BINDER_FILTERS, pitches: ['3'] };
        expect(matchesBinderFilters(card({ pitch: 3 }), filters)).toBe(true);
        expect(matchesBinderFilters(card({ pitch: 1 }), filters)).toBe(false);
        expect(matchesBinderFilters(card({ pitch: null }), filters)).toBe(false);
    });
});

describe('set order', () => {
    test('sorts by release date across product lines', () => {
        const entries = ['Armory Deck: Ira', 'Rosetta', 'No Date Set'].map((setName) => ({ card: card({ setName }) }));
        const { sets } = buildBinderFilterOptions(entries, (e) => e.card, {
            sets: [
                { groupId: 1, name: 'Rosetta', publishedOn: '2024-09-01' },
                { groupId: 2, name: 'Armory Deck: Ira', publishedOn: '2025-02-01' },
            ],
        });
        expect(sets.map((s) => s.name)).toEqual(['Armory Deck: Ira', 'Rosetta', 'No Date Set']);
    });
});
