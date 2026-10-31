import {
    buildCardListExport,
    buildExportItems,
    cardListExportFilename,
} from '../../src/utils/binderListExport.js';

const entries = [
    {
        cardId: 'wtr-cnc-rf',
        quantity: 2,
        condition: 'NM',
        card: { name: 'Command and Conquer', collectorNumber: 'WTR159', subTypeName: 'Rainbow Foil', tcgMarket: 25, tcgLow: 20 },
    },
    {
        cardId: 'wtr-cnc-rf',
        quantity: 1,
        condition: 'LP',
        card: { name: 'Command and Conquer', collectorNumber: 'WTR159', subTypeName: 'Rainbow Foil', tcgMarket: 25, tcgLow: 20 },
    },
    {
        cardId: 'sink-red',
        quantity: 1,
        condition: 'NM',
        card: { name: 'Sink Below (Red)', collectorNumber: 'MON291', subTypeName: 'Normal', tcgMarket: 0.5, tcgLow: 0.25 },
    },
];

describe('binder card list export', () => {
    it('merges conditions and writes plain text with prices', () => {
        const items = buildExportItems({ entries });
        expect(buildCardListExport({ items, title: 'Trade Binder', includePrices: true })).toBe(
            'Trade Binder\n\n'
            + '3x Command and Conquer - $25.00 each - WTR159 (Rainbow Foil)\n'
            + '1x Sink Below (Red) - $0.50 - MON291\n\n'
            + 'Total: 4 cards - $75.50',
        );
    });

    it('keeps conditions apart and bolds names for Discord', () => {
        const items = buildExportItems({ entries, includeCondition: true });
        const text = buildCardListExport({
            items, format: 'discord', sort: 'priceAsc', includePrices: true, priceSource: 'low', includeCondition: true,
        });
        expect(text.split('\n')).toEqual([
            '**1x Sink Below (Red)** - $0.25 - MON291 (NM)',
            '**2x Command and Conquer** - $20.00 each - WTR159 (Rainbow Foil, NM)',
            '**1x Command and Conquer** - $20.00 - WTR159 (Rainbow Foil, LP)',
            '',
            '**Total: 4 cards - $60.25**',
        ]);
    });

    it('writes an importable CSV', () => {
        const items = buildExportItems({ entries, includeCondition: true });
        expect(buildCardListExport({ items, format: 'csv', includeCondition: true })).toBe(
            'Name,Pitch,Set,Code,Foiling,Treatment,Condition,Quantity\n'
            + 'Command and Conquer,,,WTR159,Rainbow,,NM,2\n'
            + 'Command and Conquer,,,WTR159,Rainbow,,LP,1\n'
            + 'Sink Below,Red,,MON291,Normal,,NM,1\n',
        );
    });

    it('says how many cards the total leaves out', () => {
        const items = buildExportItems({
            entries: [...entries, { cardId: 'x', quantity: 2, card: { name: 'Promo', collectorNumber: 'P1' } }],
        });
        expect(buildCardListExport({ items, includePrices: true }).split('\n').pop())
            .toBe('Total: 6 cards - $75.50 (2 cards have no price)');
    });

    it('names the file by format', () => {
        const date = new Date(2026, 9, 31);
        expect(cardListExportFilename('Trade Binder', 'text', date)).toBe('trade-binder-2026-10-31.txt');
        expect(cardListExportFilename('Trade Binder', 'csv', date)).toBe('trade-binder-2026-10-31.csv');
    });
});
