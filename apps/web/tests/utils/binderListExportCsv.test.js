import { buildCardListExport, buildExportItems } from '../../src/utils/binderListExport.js';
import { planCsvImport } from '../../src/utils/csvImport.js';

const printing = (id, name, extNumber, setName, subTypeName, marketPrice, extra = {}) => ({
    _uniqueId: id,
    name,
    extNumber,
    _setName: setName,
    subTypeName,
    marketPrice,
    ...extra,
});

const catalog = [
    printing('snatch-n', 'Snatch (Red)', 'WTR167', 'Welcome to Rathe', 'Normal', 0.5),
    printing('snatch-rf', 'Snatch (Red)', 'WTR167', 'Welcome to Rathe', 'Rainbow Foil', 3),
    printing('snatch-hp', 'Snatch', 'HP167', 'History Pack 1', 'Normal', 0.25, { extPitchValue: 1 }),
    printing('usurp-rf', 'Usurp the Shadow Throne', 'ROS015', 'Rosetta', 'Rainbow Foil', 4),
    printing('usurp-marvel', 'Usurp the Shadow Throne (Blue) (Marvel)', 'ROS015', 'Rosetta', 'Cold Foil', 60),
    printing('aq-n', 'Aether Quickening (Red)', 'ROS111', 'Rosetta', 'Normal', 1),
    printing('aq-ea', 'Aether Quickening (Red) (Extended Art)', 'ROS111', 'Rosetta', 'Normal', 25),
    printing('quote', 'Fyendal\'s "Spring", Tunic', 'WTR150', 'Welcome to Rathe', 'Normal', 0),
];
const byId = new Map(catalog.map((card) => [card._uniqueId, card]));
const resolveCard = (entry) => byId.get(entry.cardId);
const entry = (cardId, quantity, extra = {}) => ({ cardId, quantity, card: { name: byId.get(cardId)?.name }, ...extra });

const csvFor = (entries, options = {}) => buildCardListExport({
    items: buildExportItems({ entries, resolveCard, includeCondition: options.includeCondition }),
    format: 'csv',
    includePrices: true,
    ...options,
});

describe('binder CSV export', () => {
    test('one row per printing with pitch, code, foiling, treatment and prices', () => {
        const csv = csvFor([
            entry('snatch-rf', 2),
            entry('usurp-marvel', 1),
            entry('snatch-n', 3, { condition: 'NM' }),
            entry('snatch-n', 1, { condition: 'LP' }),
            entry('aq-ea', 1),
        ]);
        expect(csv.trim().split('\n')).toEqual([
            'Name,Pitch,Set,Code,Foiling,Treatment,Quantity,Price,Total Price',
            'Aether Quickening,Red,Rosetta,ROS111,Normal,Extended Art,1,25.00,25.00',
            'Snatch,Red,Welcome to Rathe,WTR167,Normal,,4,0.50,2.00',
            'Snatch,Red,Welcome to Rathe,WTR167,Rainbow,,2,3.00,6.00',
            'Usurp the Shadow Throne,Blue,Rosetta,ROS015,Cold,Marvel,1,60.00,60.00',
        ]);
    });

    test('pitch falls back to the catalog field; unpriced cards leave prices blank; fields are quoted', () => {
        const rows = csvFor([entry('snatch-hp', 1), entry('quote', 1)]).trim().split('\n');
        expect(rows[1]).toBe('"Fyendal\'s ""Spring"", Tunic",,Welcome to Rathe,WTR150,Normal,,1,,');
        expect(rows[2]).toBe('Snatch,Red,History Pack 1,HP167,Normal,,1,0.25,0.25');
    });

    test('a card missing from the catalog uses its saved stub', () => {
        const csv = csvFor([{
            cardId: 'gone',
            quantity: 2,
            card: { name: 'Old Promo (Yellow)', setName: 'Promos', collectorNumber: 'FAB001', subTypeName: 'Cold Foil', tcgMarket: 1.25 },
        }]);
        expect(csv.trim().split('\n')[1]).toBe('Old Promo,Yellow,Promos,FAB001,Cold,,2,1.25,2.50');
    });

    test('zero-quantity entries are skipped', () => {
        expect(buildExportItems({ entries: [entry('snatch-n', 0)], resolveCard })).toEqual([]);
    });
});

test.each([false, true])('an exported Binder imports back to the same printings (condition column: %s)', (includeCondition) => {
    const entries = [
        entry('snatch-n', 4),
        entry('snatch-rf', 2),
        entry('usurp-rf', 1),
        entry('usurp-marvel', 1),
        entry('aq-n', 3),
        entry('aq-ea', 1),
    ];
    const plan = planCsvImport({ csv: csvFor(entries, { includeCondition }), catalog });
    expect(plan.review).toEqual([]);
    expect(plan.unmatched).toEqual([]);
    expect(Object.fromEntries(plan.matched.map((m) => [m.printingId, m.quantity]))).toEqual({
        'snatch-n': 4,
        'snatch-rf': 2,
        'usurp-rf': 1,
        'usurp-marvel': 1,
        'aq-n': 3,
        'aq-ea': 1,
    });
});
