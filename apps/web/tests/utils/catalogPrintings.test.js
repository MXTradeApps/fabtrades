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
