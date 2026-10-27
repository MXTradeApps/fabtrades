import {
    baseCardName,
    canonicalCardName,
    cardKey,
    cardPitchValue,
    cardTreatments,
} from '../../src/utils/cardIdentity.js';

describe('cardIdentity', () => {
    test.each([
        ['Usurp the Shadow Throne', 'Usurp the Shadow Throne'],
        ['Usurp the Shadow Throne (Blue) (Marvel)', 'Usurp the Shadow Throne'],
        ['Anothos (Golden) - FAB061', 'Anothos'],
        ['Spears of Surreality (Blue) (Marvel) - TNP018', 'Spears of Surreality'],
        ['Rampant Growth // Life - LGS341', 'Rampant Growth // Life'],
    ])('baseCardName(%s)', (name, base) => {
        expect(baseCardName(name)).toBe(base);
    });

    test('pitch comes from the name, else the pitch field', () => {
        expect(cardPitchValue({ name: 'Heat Seeker (Red)' })).toBe(1);
        expect(cardPitchValue({ name: 'Heat Seeker', extPitchValue: 1 })).toBe(1);
        expect(cardPitchValue({ name: 'Usurp the Shadow Throne', pitch: '3' })).toBe(3);
        expect(cardPitchValue({ name: 'Anothos', extPitchValue: 0 })).toBe(0);
    });

    test('every Usurp version shares one key; other colors do not', () => {
        const versions = [
            { name: 'Usurp the Shadow Throne', extPitchValue: 3 },
            { name: 'Usurp the Shadow Throne (Blue)', extPitchValue: 3 },
            { name: 'Usurp the Shadow Throne (Marvel)', extPitchValue: 3 },
            { name: 'Usurp the Shadow Throne (Blue) (Marvel)', extPitchValue: 3 },
        ];
        expect(new Set(versions.map(cardKey))).toEqual(new Set(['usurp the shadow throne|3']));
        expect(cardKey({ name: 'Snatch (Red)' })).not.toBe(cardKey({ name: 'Snatch (Blue)' }));
    });

    test('canonical name puts color first, then treatments, and drops the printed code', () => {
        expect(canonicalCardName({ name: 'Usurp the Shadow Throne (Marvel)', extPitchValue: 3 }))
            .toBe('Usurp the Shadow Throne (Blue) (Marvel)');
        expect(canonicalCardName({ name: 'Usurp the Shadow Throne', extPitchValue: 3 }))
            .toBe('Usurp the Shadow Throne (Blue)');
        expect(canonicalCardName({ name: 'Anothos (Golden) - FAB061' })).toBe('Anothos (Golden)');
        expect(cardTreatments({ name: 'Test of Iron Grip (Red) (Extended Art)' })).toEqual(['Extended Art']);
    });
});
