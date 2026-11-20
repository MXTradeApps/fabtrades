import { mergeSetLogos } from '../../src/utils/setLogos.js';

jest.mock('../../src/services/fabDb.js', () => ({ fetchSetLogos: jest.fn() }));

const bundled = {
    2775: { name: 'Monarch', abbreviation: 'MON', logoUrl: 'https://cdn.example/monarch.png' },
    2885: { name: 'Tales of Aria', abbreviation: 'ELE', logoUrl: 'https://cdn.example/toa.png' },
    9000: { name: 'No Logo Yet', abbreviation: 'NLY' }
};

describe('mergeSetLogos', () => {
    test('with no database rows it is exactly the bundled list', () => {
        const { map, byName } = mergeSetLogos(bundled, []);
        expect(map).toEqual({
            2775: 'https://cdn.example/monarch.png',
            2885: 'https://cdn.example/toa.png'
        });
        expect(byName.Monarch).toEqual({ logoUrl: 'https://cdn.example/monarch.png', abbreviation: 'MON' });
        expect(byName['No Logo Yet']).toEqual({ logoUrl: null, abbreviation: 'NLY' });
    });

    test('a database logo wins and keeps the bundled abbreviation', () => {
        const { map, byName } = mergeSetLogos(bundled, [
            { groupId: 2775, name: 'Monarch', logoUrl: 'https://db.example/2775.png' }
        ]);
        expect(map['2775']).toBe('https://db.example/2775.png');
        expect(map['2885']).toBe('https://cdn.example/toa.png');
        expect(byName.Monarch).toEqual({ logoUrl: 'https://db.example/2775.png', abbreviation: 'MON' });
    });

    test('the database adds sets the bundled list never had', () => {
        const { map, byName } = mergeSetLogos(bundled, [
            { groupId: 2818, name: 'Blitz Deck: Monarch - Prism', logoUrl: 'https://db.example/2775.png' }
        ]);
        expect(map['2818']).toBe('https://db.example/2775.png');
        expect(byName['Blitz Deck: Monarch - Prism']).toEqual({
            logoUrl: 'https://db.example/2775.png',
            abbreviation: ''
        });
    });

    test('rows without a logo or id are ignored', () => {
        const { map } = mergeSetLogos(bundled, [
            { groupId: 2775, name: 'Monarch', logoUrl: null },
            { groupId: null, name: 'Broken', logoUrl: 'https://db.example/x.png' },
            null
        ]);
        expect(map['2775']).toBe('https://cdn.example/monarch.png');
        expect(Object.keys(map)).toHaveLength(2);
    });

    test('tolerates missing inputs', () => {
        expect(mergeSetLogos(undefined, undefined)).toEqual({ map: {}, byName: {} });
        expect(mergeSetLogos({ 1: 'https://cdn.example/flat.png' }, null).map).toEqual({
            1: 'https://cdn.example/flat.png'
        });
    });
});

describe('loadSetLogoMap', () => {
    const load = async ({ bundledResponse, stored }) => {
        jest.resetModules();
        const fabDb = require('../../src/services/fabDb.js');
        if (stored instanceof Error) fabDb.fetchSetLogos.mockRejectedValue(stored);
        else fabDb.fetchSetLogos.mockResolvedValue(stored);
        global.fetch = jest.fn().mockResolvedValue(bundledResponse);
        const mod = require('../../src/utils/setLogos.js');
        return { map: await mod.loadSetLogoMap(), mod };
    };
    const ok = { ok: true, json: async () => ({ logos: bundled }) };

    beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    test('falls back to the bundled list when the database request fails', async () => {
        const { map } = await load({ bundledResponse: ok, stored: new Error('column does not exist') });
        expect(map).toEqual({
            2775: 'https://cdn.example/monarch.png',
            2885: 'https://cdn.example/toa.png'
        });
    });

    test('still serves database logos when the bundled file is missing', async () => {
        const { map, mod } = await load({
            bundledResponse: { ok: false },
            stored: [{ groupId: 2775, name: 'Monarch', logoUrl: 'https://db.example/2775.png' }]
        });
        expect(map).toEqual({ 2775: 'https://db.example/2775.png' });
        expect(mod.getSetLogosByName().Monarch.logoUrl).toBe('https://db.example/2775.png');
    });

    test('prefers the database when both answer', async () => {
        const { map } = await load({
            bundledResponse: ok,
            stored: [{ groupId: 2885, name: 'Tales of Aria', logoUrl: 'https://db.example/2885.png' }]
        });
        expect(map['2885']).toBe('https://db.example/2885.png');
        expect(map['2775']).toBe('https://cdn.example/monarch.png');
    });
});
