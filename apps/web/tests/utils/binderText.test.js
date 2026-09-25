import { formatBinderAsText } from '../../src/utils/binderText.js';

describe('formatBinderAsText', () => {
    test('empty binder is just the name', () => {
        expect(formatBinderAsText({ name: 'Trade Binder', entries: [] })).toBe(
            'Trade Binder',
        );
    });

    test('formats quantity, name, collector, finish, condition, and set', () => {
        const text = formatBinderAsText({
            name: 'Trade Binder',
            entries: [
                {
                    quantity: 4,
                    name: 'Lightning Press',
                    collectorNumber: 'SUP001',
                    finish: 'Rainbow Foil',
                    condition: 'LP',
                    setName: 'Super Slam',
                },
                {
                    quantity: 2,
                    name: 'Bravo',
                    collectorNumber: 'WTR001',
                    finish: 'Normal',
                    condition: 'NM',
                    setName: 'Welcome to Rathe',
                },
            ],
        });
        expect(text).toBe(
            'Trade Binder\n'
            + '\n'
            + '2x Bravo · WTR001 · NM · Welcome to Rathe\n'
            + '4x Lightning Press · SUP001 · Rainbow Foil · LP · Super Slam',
        );
    });
});
