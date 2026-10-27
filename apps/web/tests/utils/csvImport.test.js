import {
    buildImportIndex,
    matchImportRow,
    parseFoiling,
    parseNameField,
    planCsvImport,
    resolveImportAdds,
} from '../../src/utils/csvImport.js';

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
    printing('snatch-wtr-n', 'Snatch (Red)', 'WTR167', 'Welcome to Rathe', 'Normal', 0.5, { extPitchValue: 1 }),
    printing('snatch-wtr-rf', 'Snatch (Red)', 'WTR167', 'Welcome to Rathe', 'Rainbow Foil', 3),
    printing('snatch-hp-n', 'Snatch (Red)', 'HP167', 'History Pack 1', 'Normal', 0.25),
    printing('snatch-blue', 'Snatch (Blue)', 'WTR169', 'Welcome to Rathe', 'Normal', 0.2),
    printing('strike-n', 'Enlightened Strike', 'WTR159', 'Welcome to Rathe', 'Normal', 2),
    printing('strike-cf', 'Enlightened Strike', 'WTR159', 'Welcome to Rathe', 'Cold Foil', 90),
    printing('strike-hp', 'Enlightened Strike', 'HP159', 'History Pack 1', 'Normal', 12),
    printing('aq-ros', 'Aether Quickening (Red)', 'ROS111', 'Rosetta', 'Normal', 1),
    printing('aq-ros-ea', 'Aether Quickening (Red) (Extended Art)', 'ROS111', 'Rosetta', 'Rainbow Foil', 25),
    printing('promo-a', 'New Promo', 'FAB901', 'Promos', 'Normal', 0),
    printing('promo-b', 'New Promo', 'FAB902', 'Promos 2', 'Normal', 0),
    printing('cheap-a', 'Sigil of Solace (Blue)', 'ARC173', 'Arcane Rising', 'Normal', 0.1),
    printing('cheap-b', 'Sigil of Solace (Blue)', 'OUT999', 'Outsiders', 'Normal', 4.9),
];

const index = buildImportIndex(catalog);
const match = (row) => matchImportRow(row, index);

describe('parseNameField', () => {
    test.each([
        ['Snatch WTR167', { code: 'WTR167', name: 'Snatch', pitch: '' }],
        ['WTR167 Snatch (Red)', { code: 'WTR167', name: 'Snatch', pitch: 'red' }],
        ['Snatch (WTR167)', { code: 'WTR167', name: 'Snatch', pitch: '' }],
        ['Snatch - Red', { code: '', name: 'Snatch', pitch: 'red' }],
        ['Aether Quickening (Red) (Extended Art)', { code: '', name: 'Aether Quickening', pitch: 'red', treatment: 'extended art' }],
    ])('%s', (raw, expected) => {
        expect(parseNameField(raw)).toMatchObject(expected);
    });
});

test('parseFoiling understands common spellings', () => {
    expect(parseFoiling('')).toBe('');
    expect(parseFoiling('Non-foil')).toBe('normal');
    expect(parseFoiling('RF')).toBe('rainbow');
    expect(parseFoiling('Cold Foil')).toBe('cold');
    expect(parseFoiling('Foil')).toBe('foil');
});

describe('matchImportRow', () => {
    test('card code narrows to that printing; blank foiling prefers non-foil', () => {
        expect(match({ name: 'Snatch WTR167' })).toEqual({ status: 'matched', printingId: 'snatch-wtr-n' });
    });

    test('foiling picks the finish', () => {
        expect(match({ name: 'Snatch WTR167', foiling: 'Rainbow' })).toEqual({ status: 'matched', printingId: 'snatch-wtr-rf' });
    });

    test('name only, printings within $5 → cheapest', () => {
        expect(match({ name: 'Snatch (Red)' })).toEqual({ status: 'matched', printingId: 'snatch-hp-n' });
    });

    test('$5.00 spread exactly still auto-picks', () => {
        expect(match({ name: 'Sigil of Solace' })).toEqual({ status: 'matched', printingId: 'cheap-a' });
    });

    test('spread over $5 → review with every candidate', () => {
        const result = match({ name: 'Enlightened Strike' });
        expect(result.status).toBe('review');
        expect(result.reason).toBe('price_spread');
        expect(result.candidates.sort()).toEqual(['strike-hp', 'strike-n']);
    });

    test('set narrows the pool', () => {
        expect(match({ name: 'Enlightened Strike', set: 'WTR' })).toEqual({ status: 'matched', printingId: 'strike-n' });
        expect(match({ name: 'Enlightened Strike', set: 'History Pack 1' })).toEqual({ status: 'matched', printingId: 'strike-hp' });
    });

    test('typos still match', () => {
        expect(match({ name: 'Snach (Red)' })).toEqual({ status: 'matched', printingId: 'snatch-hp-n' });
        expect(match({ name: 'Enlightend Strike', set: 'WTR' })).toEqual({ status: 'matched', printingId: 'strike-n' });
    });

    test('pitch in the name picks the right card', () => {
        expect(match({ name: 'Snatch (Blue)' })).toEqual({ status: 'matched', printingId: 'snatch-blue' });
    });

    test('no treatment in the name keeps treated versions; blank Foiling still prefers non-foil', () => {
        expect(match({ name: 'Aether Quickening', foiling: 'Rainbow' })).toEqual({ status: 'matched', printingId: 'aq-ros-ea' });
        expect(match({ name: 'ROS111 Aether Quickening' })).toEqual({ status: 'matched', printingId: 'aq-ros' });
        expect(match({ name: 'Aether Quickening (Extended Art)' })).toEqual({ status: 'matched', printingId: 'aq-ros-ea' });
    });

    describe('a card whose only versions are foil or treated (Usurp the Shadow Throne)', () => {
        const usurp = buildImportIndex([
            printing('usurp-rf', 'Usurp the Shadow Throne (Blue)', 'IAR110', 'Usurp the Shadow Throne', 'Rainbow Foil', 59.18, { extPitchValue: 3 }),
            printing('usurp-mv-cf', 'Usurp the Shadow Throne (Blue) (Marvel)', 'IAR110', 'Usurp the Shadow Throne', 'Cold Foil', 248.53, { extPitchValue: 3 }),
            printing('gloom-n', 'Sinspeaker Gloomblade (Red)', 'IAR112', 'Usurp the Shadow Throne', 'Normal', 1, { extPitchValue: 1 }),
            printing('gloom-mv', 'Sinspeaker Gloomblade (Red) (Marvel)', 'IAR112', 'Usurp the Shadow Throne', 'Normal', 3, { extPitchValue: 1 }),
        ]);

        test('versions over $5 apart go to review', () => {
            expect(matchImportRow({ name: 'Usurp the Shadow Throne' }, usurp)).toEqual({
                status: 'review',
                reason: 'price_spread',
                candidates: ['usurp-mv-cf', 'usurp-rf'],
            });
        });

        test('versions within $5 still auto-pick the cheapest', () => {
            expect(matchImportRow({ name: 'Sinspeaker Gloomblade' }, usurp)).toEqual({ status: 'matched', printingId: 'gloom-n' });
        });

        test('naming the treatment picks it', () => {
            expect(matchImportRow({ name: 'Usurp the Shadow Throne (Marvel)' }, usurp)).toEqual({ status: 'matched', printingId: 'usurp-mv-cf' });
        });
    });

    test('several unpriced candidates → review', () => {
        expect(match({ name: 'New Promo' })).toMatchObject({ status: 'review', reason: 'unpriced' });
    });

    test('a set that fits nothing sends the row to review instead of guessing', () => {
        expect(match({ name: 'Enlightened Strike', set: 'Monarch' })).toMatchObject({ status: 'review', reason: 'set' });
    });

    test('a code whose card does not match the name → review', () => {
        expect(match({ name: 'Enlightened Strike WTR167' })).toMatchObject({ status: 'review', reason: 'name_code_mismatch' });
    });

    test('unknown card → unmatched', () => {
        expect(match({ name: 'Totally Made Up Card' })).toEqual({ status: 'unmatched' });
    });
});

describe('planCsvImport', () => {
    test('generic CSV: headers are case-insensitive, blank quantity is 1, duplicate rows sum', () => {
        const csv = 'card name,SET,Finish,Qty\nSnatch WTR167,,,2\nSnatch WTR167,,,\nEnlightened Strike,,,1\nNope Card,,,4\nSnatch WTR167,,,0\n';
        const plan = planCsvImport({ csv, catalog });
        expect(plan).toMatchObject({ ok: true, kind: 'generic', rowCount: 4 });
        expect(plan.review).toHaveLength(1);
        expect(plan.review[0]).toMatchObject({ key: 'row-4', quantity: 1 });
        expect(plan.unmatched).toEqual([expect.objectContaining({ name: 'Nope Card' })]);
        expect(resolveImportAdds(plan)).toEqual([{ printingId: 'snatch-wtr-n', quantity: 3 }]);
        expect(resolveImportAdds(plan, { 'row-4': 'strike-hp' })).toEqual([
            { printingId: 'snatch-wtr-n', quantity: 3 },
            { printingId: 'strike-hp', quantity: 1 },
        ]);
        // A pick that isn't one of the candidates is ignored.
        expect(resolveImportAdds(plan, { 'row-4': 'snatch-blue' })).toHaveLength(1);
    });

    test('quoted names with commas parse', () => {
        const local = [printing('puffin', 'Puffin, Hightail (Marvel)', 'SEA001', 'High Seas', 'Cold Foil', 110)];
        const plan = planCsvImport({ csv: 'Name,Quantity\n"Puffin, Hightail",1\n', catalog: local });
        expect(plan.matched).toEqual([{ printingId: 'puffin', quantity: 1 }]);
    });

    test('refuses a file without a Name column', () => {
        expect(planCsvImport({ csv: 'foo,bar\n1,2\n', catalog })).toMatchObject({ ok: false, refuseReason: 'no_name' });
    });

    test('refuses a file with no rows', () => {
        expect(planCsvImport({ csv: 'Name,Quantity\n', catalog })).toMatchObject({ ok: false, refuseReason: 'no_rows' });
    });

    test('refuses when nothing matches', () => {
        expect(planCsvImport({ csv: 'Name\nNope\n', catalog })).toMatchObject({ ok: false, refuseReason: 'no_matched' });
    });

    test('Fabrary export: only Have is imported', () => {
        const headers = 'Identifier,Name,Pitch,Set,Set number,Edition,Foiling,Treatment,Have,Want in trade,Want to buy,Extra for trade,Extra to sell';
        const csv = `${headers}\n1,Snatch,Red,Welcome to Rathe,WTR167,,,,2,9,,8,\n2,Snatch,Blue,Welcome to Rathe,WTR169,,,,,4,,,\n3,Junk,,Nowhere,ZZZ999,,,,1,,,,\n`;
        const plan = planCsvImport({ csv, catalog });
        expect(plan).toMatchObject({ ok: true, kind: 'fabrary', rowCount: 2 });
        expect(plan.matched).toEqual([{ printingId: 'snatch-wtr-n', quantity: 2 }]);
        expect(plan.unmatched).toEqual([expect.objectContaining({ name: 'Junk', set: 'ZZZ999' })]);
    });
});

describe('Code, Pitch and Treatment columns', () => {
    test('a Code column works like a code in the name', () => {
        expect(match({ name: 'Snatch', code: 'HP167' })).toEqual({ status: 'matched', printingId: 'snatch-hp-n' });
    });

    test('a Pitch column narrows like (Blue) in the name', () => {
        expect(match({ name: 'Snatch', pitch: 'Blue' })).toEqual({ status: 'matched', printingId: 'snatch-blue' });
    });

    test('a Treatment column picks the treated version', () => {
        expect(match({ name: 'Aether Quickening', treatment: 'Extended Art' }))
            .toEqual({ status: 'matched', printingId: 'aq-ros-ea' });
    });

    test('a blank Treatment cell prefers untreated; no Treatment column keeps both', () => {
        const both = buildImportIndex([
            printing('ss-n', 'Scar for a Scar (Red)', 'WTR191', 'Welcome to Rathe', 'Normal', 1),
            printing('ss-ea', 'Scar for a Scar (Red) (Extended Art)', 'WTR191', 'Welcome to Rathe', 'Normal', 30),
        ]);
        expect(matchImportRow({ name: 'Scar for a Scar', treatment: '' }, both))
            .toEqual({ status: 'matched', printingId: 'ss-n' });
        expect(matchImportRow({ name: 'Scar for a Scar' }, both))
            .toMatchObject({ status: 'review', reason: 'price_spread' });
    });

    test('planCsvImport reads the binder export headers', () => {
        const csv = 'Name,Pitch,Set,Code,Foiling,Treatment,Quantity,Price,Total Price\n'
            + 'Snatch,Red,History Pack 1,HP167,Normal,,2,0.25,0.50\n'
            + 'Aether Quickening,Red,Rosetta,ROS111,Rainbow,Extended Art,1,25.00,25.00\n';
        const plan = planCsvImport({ csv, catalog });
        expect(plan).toMatchObject({ ok: true, kind: 'generic', rowCount: 2, review: [], unmatched: [] });
        expect(plan.matched).toEqual([
            { printingId: 'snatch-hp-n', quantity: 2 },
            { printingId: 'aq-ros-ea', quantity: 1 },
        ]);
    });
});
