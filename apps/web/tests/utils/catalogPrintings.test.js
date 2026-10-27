import { linkBasePrintings } from '../../src/utils/catalogPrintings.js';

const card = (id, name) => ({ _uniqueId: id, name, productId: 715690 });

describe('linkBasePrintings', () => {
  it('drops the blank-finish row when Normal exists and remembers the link', () => {
    const { cards, aliases } = linkBasePrintings([
      card('715690-base', 'Bravery of the Blade'),
      card('715690-normal', 'Bravery of the Blade'),
      card('715690-rainbow-foil', 'Bravery of the Blade'),
    ]);
    expect(cards.map((row) => row._uniqueId)).toEqual([
      '715690-normal',
      '715690-rainbow-foil',
    ]);
    expect(aliases.get('715690-base')).toBe('715690-normal');
  });

  it('keeps a blank-finish row that has no Normal sibling', () => {
    const { cards, aliases } = linkBasePrintings([
      card('42-base', 'Only blank'),
    ]);
    expect(cards).toHaveLength(1);
    expect(aliases.size).toBe(0);
  });
});

describe('linkBasePrintings: leftover blank-finish rows', () => {
  const row = (id, extra = {}) => ({ _uniqueId: id, name: 'Usurp the Shadow Throne', ...extra });

  it('folds an unpriced blank row into the only real finish of its product', () => {
    const { cards, aliases } = linkBasePrintings([
      row('711436-base'),
      row('711436-cold-foil', { marketPrice: 248.53 }),
      row('711437-base'),
      row('711437-rainbow-foil', { marketPrice: 59.18 }),
    ]);
    expect(cards.map((c) => c._uniqueId)).toEqual(['711436-cold-foil', '711437-rainbow-foil']);
    expect(aliases.get('711436-base')).toBe('711436-cold-foil');
    expect(aliases.get('711437-base')).toBe('711437-rainbow-foil');
  });

  it('keeps a priced blank row even when the product has another finish', () => {
    const { cards, aliases } = linkBasePrintings([
      row('9-base', { marketPrice: 2 }),
      row('9-rainbow-foil', { marketPrice: 20 }),
    ]);
    expect(cards).toHaveLength(2);
    expect(aliases.size).toBe(0);
  });
});
