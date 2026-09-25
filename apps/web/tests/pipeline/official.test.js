import {
  applyOfficialCards,
  buildUnmatchedOfficialCards,
  mergeSubtype,
  officialCollectorNumber,
  officialDisplayName,
  splitPrintId,
} from '../../../../services/price-pipeline/src/official.js';

function official(overrides) {
  return {
    print_language: 'en',
    print_id: 'ARC123',
    set_code: 'ARC',
    product_name: 'Arcane Rising',
    rarity: 'rare',
    face_1_finish_type: 'regular',
    face_1_true_name: 'Absorb in Aether',
    face_1_name: 'Absorb in Aether',
    face_1_true_color: 'red',
    face_1_true_pitch: '1',
    face_1_true_cost: '0',
    face_1_true_power: '3',
    face_1_true_defense: '2',
    face_1_true_life: '',
    face_1_true_intellect: '',
    face_1_types: 'Action',
    face_1_subtypes: '',
    face_1_classes: 'Wizard',
    face_1_talents: '',
    face_1_thumbnail_large: 'https://example.test/arc123.webp',
    ...overrides,
  };
}

function card(overrides) {
  return {
    id: '101-normal',
    product_id: 101,
    set_id: 2725,
    name: 'Absorb in Aether (Red)',
    clean_name: 'Absorb in Aether',
    image_url: 'https://tcg.test/101.jpg',
    sub_type_name: '1st Edition Normal',
    is_foil: false,
    rarity: 'R',
    collector_number: 'ARC123',
    is_sealed: false,
    card_type: 'Instant',
    card_sub_type: null,
    card_class: '',
    talent: null,
    pitch: '1',
    cost: '1',
    power: '0',
    defense: '0',
    life: null,
    intellect: null,
    ...overrides,
  };
}

describe('splitPrintId', () => {
  it('keeps edition prefixes and strips finish and art suffixes', () => {
    expect(splitPrintId('U-ARC123-RF')).toEqual({ base: 'U-ARC123', art: null });
    expect(splitPrintId('MST095-MV')).toEqual({ base: 'MST095', art: 'MV' });
    expect(splitPrintId('ARC123')).toEqual({ base: 'ARC123', art: null });
  });
});

describe('official display and collector number', () => {
  const printing = {
    printId: 'MST095-MV',
    base: 'MST095',
    art: 'MV',
    trueName: 'A Drop in the Ocean',
    printedName: 'A Drop in the Ocean',
    color: 'blue',
  };

  it('adds pitch and art parentheticals the catalog already understands', () => {
    expect(officialDisplayName(printing)).toBe('A Drop in the Ocean (Blue) (Marvel)');
  });

  it('keeps a collector number that is the printed code of this official printing', () => {
    expect(officialCollectorNumber('ARC123', { printId: 'U-ARC123', base: 'U-ARC123' })).toBe('ARC123');
    expect(officialCollectorNumber('FAB428', { printId: 'FAB428-RF', base: 'FAB428' })).toBe('FAB428');
  });

  it('replaces a collector number the official list disagrees with', () => {
    expect(officialCollectorNumber('FAB999', { printId: 'FAB428', base: 'FAB428' })).toBe('FAB428');
  });
});

describe('mergeSubtype', () => {
  it('keeps the edition words and corrects the foil', () => {
    expect(mergeSubtype('1st Edition Cold Foil', 'gold-foil')).toBe('1st Edition Gold Foil');
    expect(mergeSubtype('Unlimited Edition Normal', 'regular')).toBe('Unlimited Edition Normal');
    expect(mergeSubtype('Rainbow Foil', 'rainbow-foil')).toBe('Rainbow Foil');
  });
});

describe('applyOfficialCards', () => {
  const rows = [
    official(),
    official({
      print_id: 'U-ARC123',
      product_name: 'Arcane Rising - Unlimited',
      face_1_finish_type: 'regular',
      rarity: 'special',
    }),
    official({
      print_id: 'ARC123-RF',
      face_1_finish_type: 'rainbow-foil',
      rarity: 'rare',
    }),
    official({
      print_id: 'UPR042-CF',
      set_code: 'UPR',
      product_name: 'Uprising',
      rarity: 'common',
      face_1_finish_type: 'cold-foil',
      face_1_true_name: 'Aether Ashwing',
      face_1_name: 'Aether Ashwing',
      face_1_true_color: '',
      face_1_true_pitch: '',
    }),
    official({
      print_id: 'UPR042-MV',
      set_code: 'UPR',
      product_name: 'Uprising',
      rarity: 'marvel',
      face_1_finish_type: 'cold-foil',
      face_1_true_name: 'Aether Ashwing',
      face_1_name: 'Aether Ashwing',
      face_1_true_color: '',
      face_1_true_pitch: '',
    }),
    official({
      print_id: 'FAB001-GF',
      set_code: 'FAB',
      product_name: 'Premier Organized Play',
      rarity: 'promo',
      face_1_finish_type: 'gold-foil',
      face_1_true_name: "Fyendal's Spring Tunic",
      face_1_name: "Fyendal's Spring Tunic",
      face_1_true_color: '',
      face_1_true_pitch: '',
      face_1_types: 'Equipment',
      face_1_classes: '',
    }),
    official({ print_language: 'de', print_id: 'DE_ARC123', face_1_true_name: 'German' }),
  ];

  it('maps unlimited and first edition onto different official printings and keeps their ids', () => {
    const first = card();
    const unlimited = card({
      id: '202-normal',
      product_id: 202,
      sub_type_name: 'Unlimited Edition Normal',
    });
    const rainbow = card({
      id: '303-rainbow-foil',
      product_id: 303,
      sub_type_name: '1st Edition Rainbow Foil',
      is_foil: true,
    });
    const { stats } = applyOfficialCards(
      [first, unlimited, rainbow],
      rows,
      new Map([[2725, { abbreviation: 'ARC' }]]),
    );

    expect(first.id).toBe('101-normal');
    expect(unlimited.id).toBe('202-normal');
    expect(rainbow.id).toBe('303-rainbow-foil');
    expect(first.name).toBe('Absorb in Aether (Red)');
    expect(first.rarity).toBe('Rare');
    expect(first.card_type).toBe('Action');
    expect(first.card_class).toBe('Wizard');
    expect(first.cost).toBe('0');
    expect(first.collector_number).toBe('ARC123');
    expect(first.image_url).toBe('https://tcg.test/101.jpg');
    expect(unlimited.sub_type_name).toBe('Unlimited Edition Normal');
    expect(unlimited.rarity).toBe('Special');
    expect(unlimited.collector_number).toBe('ARC123');
    expect(rainbow.sub_type_name).toBe('1st Edition Rainbow Foil');
    expect(rainbow.is_foil).toBe(true);
    expect(stats.matched).toBe(3);
    expect(stats.official).toBe(6);
  });

  it('uses the code printed in the name when TCGplayer’s collector number disagrees', () => {
    const promo = card({
      id: '9-cold-foil',
      name: 'Leaven Sheath - FAB428',
      collector_number: 'FAB999',
      sub_type_name: 'Normal',
      pitch: null,
      set_id: 2732,
    });
    const list = [
      official({
        print_id: 'FAB428',
        set_code: 'FAB',
        face_1_true_name: 'Leaven Sheath',
        face_1_name: 'Leaven Sheath',
        face_1_true_color: '',
        face_1_true_pitch: '',
        rarity: 'promo',
      }),
    ];
    applyOfficialCards([promo], list, new Map());
    expect(promo.collector_number).toBe('FAB428');
    expect(promo.name).toBe('Leaven Sheath');
    expect(promo.rarity).toBe('Promo');
  });

  it('distinguishes a marvel from the cold foil that shares its number', () => {
    const cold = card({
      id: '1-cold-foil',
      name: 'Aether Ashwing',
      collector_number: 'UPR042',
      sub_type_name: 'Cold Foil',
      is_foil: true,
      pitch: null,
      set_id: 3056,
    });
    const marvel = card({
      id: '2-cold-foil',
      name: 'Aether Ashwing (Marvel)',
      collector_number: 'UPR042',
      sub_type_name: 'Cold Foil',
      is_foil: true,
      pitch: null,
      rarity: 'Marvel',
      set_id: 3056,
    });
    applyOfficialCards([cold, marvel], rows, new Map([[3056, { abbreviation: 'UPR' }]]));
    expect(cold.name).toBe('Aether Ashwing');
    expect(cold.rarity).toBe('Common');
    expect(marvel.name).toBe('Aether Ashwing (Marvel)');
    expect(marvel.rarity).toBe('Marvel');
  });

  it('treats the only official printing as authoritative when the foil label disagrees', () => {
    const tunic = card({
      id: '3-cold-foil',
      name: "Fyendal's Spring Tunic (Golden) - FAB001",
      collector_number: 'FAB001',
      sub_type_name: '1st Edition Cold Foil',
      is_foil: true,
      pitch: null,
      set_id: 2732,
    });
    applyOfficialCards([tunic], rows, new Map());
    expect(tunic.sub_type_name).toBe('1st Edition Gold Foil');
    expect(tunic.is_foil).toBe(true);
    expect(tunic.collector_number).toBe('FAB001');
    expect(tunic.card_type).toBe('Equipment');
  });

  it('maps both faces of a double-faced printing and keeps the combined name', () => {
    const token = card({
      id: 'ash',
      name: 'Aether Ashwing // Ash',
      collector_number: 'UPR042//UPR043',
      sub_type_name: 'Normal',
      pitch: null,
      set_id: 3056,
      card_type: null,
    });
    const cold = card({
      id: 'ash-cf',
      name: 'Ash (Cold Foil) // Aether Ashwing (Cold Foil)',
      collector_number: 'UPR043',
      sub_type_name: 'Cold Foil',
      is_foil: true,
      pitch: null,
      set_id: 3056,
    });
    const list = [
      official({
        print_id: 'UPR042',
        set_code: 'UPR',
        product_name: 'Uprising',
        rarity: 'token',
        face_1_true_name: 'Aether Ashwing',
        face_1_name: 'Aether Ashwing',
        face_1_true_color: '',
        face_1_true_pitch: '',
        face_1_types: 'Token',
      }),
      official({
        print_id: 'UPR043',
        set_code: 'UPR',
        product_name: 'Uprising',
        rarity: 'token',
        face_1_true_name: 'Ash',
        face_1_name: 'Ash',
        face_1_true_color: '',
        face_1_true_pitch: '',
        face_1_types: 'Token',
      }),
      official({
        print_id: 'UPR042-CF',
        set_code: 'UPR',
        product_name: 'Uprising',
        rarity: 'common',
        face_1_finish_type: 'cold-foil',
        face_1_true_name: 'Aether Ashwing',
        face_1_name: 'Aether Ashwing',
        face_1_true_color: '',
        face_1_true_pitch: '',
      }),
      official({
        print_id: 'UPR043-CF',
        set_code: 'UPR',
        product_name: 'Uprising',
        rarity: 'common',
        face_1_finish_type: 'cold-foil',
        face_1_true_name: 'Ash',
        face_1_name: 'Ash',
        face_1_true_color: '',
        face_1_true_pitch: '',
      }),
    ];
    const { claimed } = applyOfficialCards([token, cold], list, new Map([[3056, { abbreviation: 'UPR' }]]));
    expect(token.name).toBe('Aether Ashwing // Ash');
    expect(token.collector_number).toBe('UPR042//UPR043');
    expect(token.card_type).toBe('Token');
    expect(cold.name).toBe('Ash (Cold Foil) // Aether Ashwing (Cold Foil)');
    expect([...claimed.keys()].sort()).toEqual(['UPR042', 'UPR042-CF', 'UPR043', 'UPR043-CF']);
  });

  it('does not rewrite sealed products', () => {
    const box = card({
      id: '5-normal',
      name: 'Arcane Rising Booster Box',
      collector_number: null,
      is_sealed: true,
      card_type: null,
    });
    const { stats } = applyOfficialCards([box], rows, new Map());
    expect(box.name).toBe('Arcane Rising Booster Box');
    expect(stats.matched).toBe(0);
  });
});

describe('buildUnmatchedOfficialCards', () => {
  it('adds an official printing that did not map, under the one set we know', () => {
    const rows = [official({ print_id: 'NEW001', set_code: 'NEW', product_name: 'Brand New' })];
    const { cards, skipped } = buildUnmatchedOfficialCards(
      rows,
      new Map(),
      [{ groupId: 42, abbreviation: 'NEW', name: 'Brand New' }],
      '2026-09-23T00:00:00.000Z',
    );
    expect(skipped).toBe(0);
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe('lss-NEW001');
    expect(cards[0].set_id).toBe(42);
    expect(cards[0].product_id).toBeLessThan(0);
    expect(cards[0].collector_number).toBe('NEW001');
    expect(cards[0].name).toBe('Absorb in Aether (Red)');
    expect(cards[0].is_sealed).toBe(false);
  });

  it('skips a printing whose set code matches more than one known set', () => {
    const rows = [official({ print_id: 'GEM001', set_code: 'GEM', product_name: 'GEM Pack' })];
    const { cards, skipped } = buildUnmatchedOfficialCards(
      rows,
      new Map(),
      [
        { groupId: 1, abbreviation: 'GEM', name: 'GEM Pack 1' },
        { groupId: 2, abbreviation: 'GEM', name: 'GEM Pack 2' },
      ],
      '2026-09-23T00:00:00.000Z',
    );
    expect(cards).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('gives both finishes of one official card the same synthetic product id', () => {
    const rows = [
      official({ print_id: 'R-WTR006', set_code: 'WTR', product_name: 'Welcome to Rathe' }),
      official({
        print_id: 'R-WTR006-RF',
        set_code: 'WTR',
        product_name: 'Welcome to Rathe',
        face_1_finish_type: 'rainbow-foil',
      }),
    ];
    const { cards } = buildUnmatchedOfficialCards(
      rows,
      new Map(),
      [{ groupId: 2726, abbreviation: 'WTR', name: 'Welcome to Rathe' }],
      '2026-09-23T00:00:00.000Z',
    );
    expect(cards).toHaveLength(2);
    expect(cards[0].product_id).toBe(cards[1].product_id);
    expect(cards[0].product_id).toBeLessThan(0);
    expect(cards[0].id).not.toBe(cards[1].id);
  });

  it('does not add a printing already mapped to a priced card', () => {
    const rows = [official()];
    const { cards } = buildUnmatchedOfficialCards(rows, new Map([['ARC123', '101-normal']]), [], '2026-09-23T00:00:00.000Z');
    expect(cards).toHaveLength(0);
  });
});
