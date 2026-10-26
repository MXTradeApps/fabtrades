import { findStaleTwins } from '../../../../services/price-pipeline/src/stale.js';

function card(id, overrides = {}) {
  return {
    id,
    set_id: 24762,
    name: 'Deadly Spinneret (Red)',
    sub_type_name: 'Normal',
    collector_number: 'IAR243',
    is_sealed: false,
    ...overrides,
  };
}

describe('findStaleTwins', () => {
  const fresh = [
    card('722951-normal'),
    card('714480-rainbow-foil', { sub_type_name: 'Rainbow Foil' }),
  ];

  it('pairs a product TCGplayer moved to a new id with the new row', () => {
    const existing = [...fresh, card('714480-normal')];
    expect(findStaleTwins(existing, fresh)).toEqual([
      { stale: '714480-normal', twin: '722951-normal' },
    ]);
  });

  it('pairs an official-only fill-in once TCGplayer lists the printing', () => {
    const existing = [
      ...fresh,
      card('lss-IAR243-RF', { sub_type_name: 'Rainbow Foil', collector_number: 'IAR243-RF' }),
    ];
    expect(findStaleTwins(existing, fresh)).toEqual([
      { stale: 'lss-IAR243-RF', twin: '714480-rainbow-foil' },
    ]);
  });

  it('leaves rows this run produced, even when they share a printing', () => {
    const both = [...fresh, card('730000-normal')];
    expect(findStaleTwins(both, both)).toEqual([]);
  });

  it('keeps stale rows that have no current twin', () => {
    const existing = [...fresh, card('600000-cold-foil', { sub_type_name: 'Cold Foil' })];
    expect(findStaleTwins(existing, fresh)).toEqual([]);
  });

  it('does not pair across finishes, sets, or sealed products', () => {
    const existing = [
      ...fresh,
      card('1-cold-foil', { sub_type_name: 'Cold Foil' }),
      card('2-normal', { set_id: 1 }),
      card('3-normal', { is_sealed: true }),
    ];
    expect(findStaleTwins(existing, fresh)).toEqual([]);
  });

  it('prefers a priced TCGplayer twin over an official-only one', () => {
    const current = [card('lss-IAR243'), card('722951-normal')];
    const existing = [...current, card('714480-normal')];
    expect(findStaleTwins(existing, current)).toEqual([
      { stale: '714480-normal', twin: '722951-normal' },
    ]);
  });
});
