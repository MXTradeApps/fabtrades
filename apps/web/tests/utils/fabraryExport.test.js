import {
    buildFabraryExportRows,
    fabraryIdentifier,
    fabraryRowsForCard,
    toFabraryCsv,
    FABRARY_EXPORT_HEADERS,
} from '../../src/utils/fabraryExport.js';
import { parseFabraryCsv } from '../../src/utils/fabraryCsv.js';
import { matchFabraryRow } from '../../src/utils/fabraryMatch.js';

const card = (overrides) => ({
    name: 'Sink Below (Red)',
    _setName: 'Welcome to Rathe',
    subTypeName: 'Normal',
    extNumber: 'WTR101',
    extPitchValue: 1,
    ...overrides,
});

describe('fabraryIdentifier', () => {
    it('slugs the name and appends the pitch color', () => {
        expect(fabraryIdentifier("Fyendal's Spring Tunic", '')).toBe('fyendals-spring-tunic');
        expect(fabraryIdentifier('10,000 Year Reunion', 'Red')).toBe('10000-year-reunion-red');
        expect(fabraryIdentifier('Arakni, 5L!p3d 7hRu 7h3 cR4X', '')).toBe('arakni-5lp3d-7hru-7h3-cr4x');
    });
});

describe('fabraryRowsForCard', () => {
    it('maps pitch, edition, foiling and treatment to Fabrary labels', () => {
        expect(fabraryRowsForCard(card({
            name: 'Command and Conquer (Red) (Extended Art)',
            subTypeName: '1st Edition Cold Foil',
            extNumber: 'WTR000',
        }))).toEqual([{
            Identifier: 'command-and-conquer-red',
            Name: 'Command and Conquer',
            Pitch: 'Red',
            Set: 'Welcome to Rathe',
            'Set number': 'WTR000',
            Edition: 'First',
            Foiling: 'Cold',
            Treatment: 'Extended Art',
        }]);
    });

    it('reads Golden / Marvel qualifiers and strips a trailing set code', () => {
        const [row] = fabraryRowsForCard(card({
            name: "Fyendal's Spring Tunic (Golden) - FAB001",
            subTypeName: '',
            extNumber: 'FAB001',
            extPitchValue: null,
        }));
        expect(row).toMatchObject({ Name: "Fyendal's Spring Tunic", Foiling: 'Gold', Pitch: '' });
        expect(fabraryRowsForCard(card({ name: 'Pleiades (Marvel)', extPitchValue: null }))[0].Treatment)
            .toBe('Full Art');
    });

    it('splits bundled products into one row per card', () => {
        const rows = fabraryRowsForCard(card({
            name: 'Anothos // Bravo',
            extNumber: 'WTR040 // WTR039',
            extPitchValue: null,
        }));
        expect(rows.map((r) => [r.Name, r['Set number']])).toEqual([
            ['Anothos', 'WTR040'],
            ['Bravo', 'WTR039'],
        ]);
    });

    it('keeps a double-faced card with one number as its front face', () => {
        const rows = fabraryRowsForCard(card({
            name: 'A Drop in the Ocean // Inner Chi (Marvel)',
            extNumber: 'MST095',
            extPitchValue: 3,
            subTypeName: 'Cold Foil',
        }));
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ Name: 'A Drop in the Ocean', Pitch: 'Blue', Treatment: 'Full Art' });
    });
});

describe('buildFabraryExportRows', () => {
    it('sums Have across Binders, counts Trade Binder as extras, Want List as wants', () => {
        const sink = card();
        const rows = buildFabraryExportRows({
            owned: [
                { cardId: 'a', binderId: 'system:collection', quantity: 2, condition: 'NM', card: sink },
                { cardId: 'a', binderId: 'system:collection', quantity: 1, condition: 'LP', card: sink },
                { cardId: 'a', binderId: 'system:trade', quantity: 3, card: sink },
                { cardId: 'a', binderId: 'custom-1', quantity: 1, card: sink },
            ],
            wants: [{ cardId: 'b', quantity: 4, card: card({ name: 'Sink Below (Blue)', extPitchValue: 3 }) }],
        });
        expect(rows).toHaveLength(2);
        const red = rows.find((r) => r.Pitch === 'Red');
        const blue = rows.find((r) => r.Pitch === 'Blue');
        expect(red).toMatchObject({ Have: '7', 'Extra for trade': '3', 'Want in trade': '' });
        expect(blue).toMatchObject({ Have: '', 'Extra for trade': '', 'Want in trade': '4' });
    });

    it('prefers the live catalog card over the stored stub', () => {
        const rows = buildFabraryExportRows({
            owned: [{ cardId: 'x', binderId: 'system:collection', quantity: 1, card: { name: 'Stale' } }],
            resolveCard: () => card(),
        });
        expect(rows[0].Name).toBe('Sink Below');
    });
});

describe('toFabraryCsv', () => {
    it('writes Fabrary headers and quotes fields with commas', () => {
        const rows = buildFabraryExportRows({
            owned: [{
                binderId: 'system:collection',
                quantity: 1,
                card: card({ name: '10,000 Year Reunion (Red)', _setName: 'The Hunted', extNumber: 'THC001' }),
            }],
        });
        const csv = toFabraryCsv(rows);
        expect(csv.split('\n')[0]).toBe(FABRARY_EXPORT_HEADERS.join(','));
        expect(csv).toContain('"10,000 Year Reunion"');
    });

    it('round-trips through the Fabrary importer to the same printings', () => {
        const catalog = [
            card({ id: 'wtr101-normal' }),
            card({ id: 'wtr101-rainbow', subTypeName: 'Rainbow Foil' }),
            card({ id: 'wtr101-blue', name: 'Sink Below (Blue)', extPitchValue: 3 }),
            card({ id: 'cnc-ea', name: 'Command and Conquer (Red) (Extended Art)', extNumber: 'WTR000' }),
            card({ id: 'cnc', name: 'Command and Conquer (Red)', extNumber: 'WTR000' }),
            card({ id: 'bull-1st', name: 'Wounded Bull', subTypeName: '1st Edition Normal', extNumber: 'WTR001', extPitchValue: null }),
            card({ id: 'bull-unl', name: 'Wounded Bull', subTypeName: 'Unlimited Edition Normal', extNumber: 'WTR001', extPitchValue: null }),
        ];
        const owned = catalog.map((c) => ({ cardId: c.id, binderId: 'system:collection', quantity: 1, card: c }));
        const parsed = parseFabraryCsv(toFabraryCsv(buildFabraryExportRows({ owned })));
        expect(parsed.ok).toBe(true);
        const matched = parsed.rows.map((row) => matchFabraryRow(row, catalog).printingId).sort();
        expect(matched).toEqual(catalog.map((c) => c.id).sort());
    });
});
