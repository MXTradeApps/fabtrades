import {
    BINDER_EXPORT_HEADERS,
    binderExportFilename,
    buildBinderExportRows,
    toBinderCsv,
} from '../../src/utils/binderCsvExport.js';
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

describe('buildBinderExportRows', () => {
    test('one row per printing with pitch, code, foiling, treatment and prices', () => {
        const rows = buildBinderExportRows({
            entries: [
                entry('snatch-rf', 2),
                entry('usurp-marvel', 1),
                entry('snatch-n', 3, { condition: 'NM' }),
                entry('snatch-n', 1, { condition: 'LP' }),
                entry('aq-ea', 1),
            ],
            resolveCard,
        });
        expect(rows).toEqual([
            { Name: 'Aether Quickening', Pitch: 'Red', Set: 'Rosetta', Code: 'ROS111', Foiling: 'Normal', Treatment: 'Extended Art', Quantity: '1', Price: '25.00', 'Total Price': '25.00' },
            { Name: 'Snatch', Pitch: 'Red', Set: 'Welcome to Rathe', Code: 'WTR167', Foiling: 'Normal', Treatment: '', Quantity: '4', Price: '0.50', 'Total Price': '2.00' },
            { Name: 'Snatch', Pitch: 'Red', Set: 'Welcome to Rathe', Code: 'WTR167', Foiling: 'Rainbow', Treatment: '', Quantity: '2', Price: '3.00', 'Total Price': '6.00' },
            { Name: 'Usurp the Shadow Throne', Pitch: 'Blue', Set: 'Rosetta', Code: 'ROS015', Foiling: 'Cold', Treatment: 'Marvel', Quantity: '1', Price: '60.00', 'Total Price': '60.00' },
        ]);
    });

    test('pitch falls back to the catalog field; unpriced cards leave prices blank', () => {
        const rows = buildBinderExportRows({ entries: [entry('snatch-hp', 1), entry('quote', 2)], resolveCard });
        expect(rows[0]).toMatchObject({ Name: 'Fyendal\'s "Spring", Tunic', Price: '', 'Total Price': '' });
        expect(rows[1]).toMatchObject({ Name: 'Snatch', Pitch: 'Red', Code: 'HP167' });
    });

    test('a card missing from the catalog uses its saved stub', () => {
        const rows = buildBinderExportRows({
            entries: [{
                cardId: 'gone',
                quantity: 2,
                card: { name: 'Old Promo (Yellow)', setName: 'Promos', collectorNumber: 'FAB001', subTypeName: 'Cold Foil', tcgMarket: 1.25 },
            }],
            resolveCard,
        });
        expect(rows).toEqual([
            { Name: 'Old Promo', Pitch: 'Yellow', Set: 'Promos', Code: 'FAB001', Foiling: 'Cold', Treatment: '', Quantity: '2', Price: '1.25', 'Total Price': '2.50' },
        ]);
    });

    test('zero-quantity entries are skipped', () => {
        expect(buildBinderExportRows({ entries: [entry('snatch-n', 0)], resolveCard })).toEqual([]);
    });
});

test('toBinderCsv writes the header row and quotes fields', () => {
    const csv = toBinderCsv(buildBinderExportRows({ entries: [entry('quote', 1)], resolveCard }));
    const [header, row] = csv.trim().split('\n');
    expect(header).toBe('Name,Pitch,Set,Code,Foiling,Treatment,Quantity,Price,Total Price');
    expect(header.split(',')).toEqual(BINDER_EXPORT_HEADERS);
    expect(row).toBe('"Fyendal\'s ""Spring"", Tunic",,Welcome to Rathe,WTR150,Normal,,1,,');
});

test('binderExportFilename slugs the Binder name and dates the file', () => {
    expect(binderExportFilename('Trade Binder', new Date(2026, 9, 7))).toBe('trade-binder-2026-10-07.csv');
    expect(binderExportFilename('', new Date(2026, 0, 1))).toBe('binder-2026-01-01.csv');
});

test('an exported Binder imports back to the same printings', () => {
    const entries = [
        entry('snatch-n', 4),
        entry('snatch-rf', 2),
        entry('usurp-rf', 1),
        entry('usurp-marvel', 1),
        entry('aq-n', 3),
        entry('aq-ea', 1),
    ];
    const csv = toBinderCsv(buildBinderExportRows({ entries, resolveCard }));
    const plan = planCsvImport({ csv, catalog });
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
