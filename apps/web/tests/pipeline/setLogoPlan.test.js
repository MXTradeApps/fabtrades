import {
  isInheritedLogo,
  isOwnLogo,
  parentSetName,
  planSetLogos,
} from '../../../../services/price-pipeline/src/setLogoPlan.js';

const BUCKET = 'https://x.supabase.co/storage/v1/object/public/set-logos';

describe('parentSetName', () => {
  test.each([
    ['Blitz Deck: Monarch - Prism', 'Monarch'],
    ['Blitz Deck: The Hunted - Arakni, Web of Deceit', 'The Hunted'],
    ['Blitz Deck: Part the Mistveil - Zen', 'Part the Mistveil'],
    ['Historic Pack 1 Blitz Deck: Kano', 'History Pack Vol.1'],
    ['Hero Deck: Bravo', 'Welcome to Rathe'],
    ['Usurp the Shadow Throne Pre-release Cards', 'Usurp the Shadow Throne'],
    ['Outbreak Pre-Release Kit', 'Outbreak'],
    ['Compendium of Rathe - Antiquity Pack', 'Compendium of Rathe'],
    ['Silver Age: Outbreak', 'Silver Age Chapter 1'],
    ['Smash Palace: Chorus of Steel', 'Smash Palace'],
  ])('%s borrows from %s', (name, parent) => {
    expect(parentSetName(name)).toBe(parent);
  });

  test.each(['Monarch', 'Silver Age Chapter 1', 'Smash Palace', 'Armory Deck: Min', '', null])(
    '%s stands alone',
    (name) => {
      expect(parentSetName(name)).toBeNull();
    }
  );
});

describe('logo ownership', () => {
  test('tells a set\'s own copy from a borrowed one', () => {
    expect(isOwnLogo(`${BUCKET}/2775-abc.png`, 2775)).toBe(true);
    expect(isInheritedLogo(`${BUCKET}/2775-abc.png`, 2775)).toBe(false);
    expect(isOwnLogo(`${BUCKET}/2775-abc.png`, 2818)).toBe(false);
    expect(isInheritedLogo(`${BUCKET}/2775-abc.png`, 2818)).toBe(true);
    // 27750 must not be mistaken for 2775.
    expect(isOwnLogo(`${BUCKET}/27750-abc.png`, 2775)).toBe(false);
  });

  test('a URL outside the bucket is neither', () => {
    expect(isOwnLogo('https://cdn.fabtcg.com/a.png', 1)).toBe(false);
    expect(isInheritedLogo('https://cdn.fabtcg.com/a.png', 1)).toBe(false);
    expect(isInheritedLogo(null, 1)).toBe(false);
  });
});

describe('planSetLogos', () => {
  const sources = { 2775: { url: 'https://cdn.fabtcg.com/monarch.png' } };

  test('copies a listed source and lets its decks borrow it', () => {
    const plan = planSetLogos(
      [
        { group_id: 2775, name: 'Monarch', logo_url: null },
        { group_id: 2818, name: 'Blitz Deck: Monarch - Prism', logo_url: null },
        { group_id: 2732, name: 'Flesh and Blood: Promo Cards', logo_url: null },
      ],
      sources
    );
    expect(plan.downloads).toEqual([{ groupId: 2775, url: 'https://cdn.fabtcg.com/monarch.png' }]);
    expect(plan.inherits).toEqual([{ groupId: 2818, parentGroupId: 2775 }]);
  });

  test('leaves a stored copy and a hand-set URL alone', () => {
    const plan = planSetLogos(
      [
        { group_id: 2775, name: 'Monarch', logo_url: `${BUCKET}/2775-abc.png` },
        { group_id: 2818, name: 'Blitz Deck: Monarch - Prism', logo_url: 'https://elsewhere.example/prism.png' },
      ],
      { ...sources, 2818: { url: 'https://cdn.fabtcg.com/prism.png' } }
    );
    expect(plan).toEqual({ downloads: [], inherits: [] });
  });

  test('a set that gains its own source replaces the borrowed logo', () => {
    const plan = planSetLogos(
      [
        { group_id: 24415, name: 'Smash Palace', logo_url: `${BUCKET}/24415-abc.png` },
        { group_id: 24773, name: 'Smash Palace: Chorus of Steel', logo_url: `${BUCKET}/24415-abc.png` },
      ],
      { 24773: { url: 'https://cdn.fabtcg.com/chorus.png' } }
    );
    expect(plan.downloads).toEqual([{ groupId: 24773, url: 'https://cdn.fabtcg.com/chorus.png' }]);
    expect(plan.inherits).toEqual([]);
  });

  test('a borrowed logo is not re-borrowed, and an unknown parent is skipped', () => {
    const plan = planSetLogos([
      { group_id: 2818, name: 'Blitz Deck: Monarch - Prism', logo_url: `${BUCKET}/2775-abc.png` },
      { group_id: 3059, name: 'Blitz Deck: Uprising - Fai', logo_url: null },
    ]);
    expect(plan).toEqual({ downloads: [], inherits: [] });
  });
});
