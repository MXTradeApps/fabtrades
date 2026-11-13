/**
 * How the calculator fills itself on load: from a shared `?trade=` link, from
 * the locally saved draft, or from a trade reopened out of history.
 *
 * These are the entry points for anyone who receives a trade from another
 * user, so each test drives the real URL and localStorage rather than mocks.
 */
import { renderHook, act } from '@testing-library/react';
import { useTradeState } from '../../src/hooks/useTradeState.js';
import { encodeTradeToURL } from '../../src/utils/urlEncoding.js';
import { TRADE_DRAFT_KEY, saveTradeDraft } from '../../src/utils/tradeDraft.js';

const cardA = {
  name: 'Card A',
  editions: [
    { subTypeName: 'Normal', cardPrice: 10, lowPrice: 8, uniqueId: 'a-normal', imageUrl: 'a.png' },
    { subTypeName: 'Rainbow Foil', cardPrice: 25, lowPrice: 20, uniqueId: 'a-rf', imageUrl: 'a-rf.png' },
  ],
};
const cardB = {
  name: 'Card B',
  editions: [{ subTypeName: 'Normal', cardPrice: 5, lowPrice: 4, uniqueId: 'b-normal' }],
};
const cardGroups = [cardA, cardB];

const cardIdLookup = {
  'a-normal': { displayName: 'Card A' },
  'a-rf': { displayName: 'Card A' },
  'b-normal': { displayName: 'Card B' },
};

const openLink = (have, want) => {
  const url = new URL(encodeTradeToURL(have, want));
  window.history.replaceState({}, '', `/${url.search}`);
};

const openRawTradeParam = (value) => {
  window.history.replaceState({}, '', `/?trade=${encodeURIComponent(value)}`);
};

const setup = (groups = cardGroups, lookup = cardIdLookup) =>
  renderHook(({ g, l }) => useTradeState(g, l), { initialProps: { g: groups, l: lookup } });

const savedDraft = () => JSON.parse(window.localStorage.getItem(TRADE_DRAFT_KEY));

let warn;
let error;

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  window.localStorage.clear();
  // Unknown cards and corrupt links are logged on purpose; keep the run quiet.
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
});

describe('useTradeState — opening a shared trade link', () => {
  test('fills both sides from the link', () => {
    openLink(
      [{ uniqueId: 'a-rf', name: 'Card A', price: 25, quantity: 2 }],
      [{ uniqueId: 'b-normal', name: 'Card B', price: 5, quantity: 3 }],
    );

    const { result } = setup();

    expect(result.current.hasLoadedFromURL).toBe(true);
    expect(result.current.haveList).toHaveLength(1);
    expect(result.current.haveList[0]).toMatchObject({
      name: 'Card A',
      subTypeName: 'Rainbow Foil',
      uniqueId: 'a-rf',
      quantity: 2,
      price: 25,
    });
    expect(result.current.wantList).toHaveLength(1);
    expect(result.current.wantList[0]).toMatchObject({
      name: 'Card B',
      uniqueId: 'b-normal',
      quantity: 3,
    });
    expect(result.current.haveTotal).toBe(50);
    expect(result.current.wantTotal).toBe(15);
    expect(result.current.diff).toBe(35);
  });

  test('keeps the shared printing when its price has moved since the link was made', () => {
    openLink([{ uniqueId: 'a-rf', name: 'Card A', price: 21.5, quantity: 1 }], []);

    const { result } = setup();

    expect(result.current.haveList[0]).toMatchObject({ uniqueId: 'a-rf', subTypeName: 'Rainbow Foil' });
  });

  test('exposes the link metadata so the page can show where the trade came from', () => {
    openLink([{ uniqueId: 'a-normal', name: 'Card A', price: 10, quantity: 1 }], []);

    const { result } = setup();

    expect(result.current.urlTradeData).toMatchObject({ version: 1 });
    expect(result.current.urlTradeData.have).toHaveLength(1);
    expect(result.current.urlTradeData.ageInDays).toBeLessThan(1);
  });

  test('a link with only one side leaves the other side empty', () => {
    openLink([], [{ uniqueId: 'b-normal', name: 'Card B', price: 5, quantity: 1 }]);

    const { result } = setup();

    expect(result.current.haveList).toEqual([]);
    expect(result.current.wantList).toHaveLength(1);
  });

  test('drops a card that no longer exists and keeps the rest', () => {
    openLink(
      [
        { uniqueId: 'retired-printing', name: 'Zzyzx Qwerty', price: 99, quantity: 1 },
        { uniqueId: 'a-normal', name: 'Card A', price: 10, quantity: 1 },
      ],
      [],
    );

    const { result } = setup();

    expect(result.current.haveList.map((c) => c.name)).toEqual(['Card A']);
    expect(result.current.haveTotal).toBe(10);
  });

  test('falls back to the card name when the link carries no known id', () => {
    openLink([{ name: 'Card B', price: 5, quantity: 2 }], []);

    const { result } = setup(cardGroups, {});

    expect(result.current.haveList).toHaveLength(1);
    expect(result.current.haveList[0]).toMatchObject({ name: 'Card B', quantity: 2 });
  });

  test.each([
    ['not base64', '%%%not-base64%%%'],
    ['base64 of something that is not JSON', btoa('definitely not json')],
    ['a truncated payload', btoa('{"v":1,"h":[["a-normal",10,1]').slice(0, 20)],
    ['a newer payload version', btoa(JSON.stringify({ v: 2, h: [['a-normal', 10, 1]], w: [] }))],
  ])('opens an empty trade when the link is %s', (_label, param) => {
    openRawTradeParam(param);

    const { result } = setup();

    expect(result.current.haveList).toEqual([]);
    expect(result.current.wantList).toEqual([]);
    expect(result.current.hasLoadedFromURL).toBe(false);
    expect(result.current.urlTradeData).toBeNull();
  });

  test('a broken link still lets the visitor build a trade by hand', () => {
    openRawTradeParam('%%%not-base64%%%');

    const { result } = setup();
    act(() => result.current.addHaveCard('Card A'));

    expect(result.current.haveList).toHaveLength(1);
  });

  test('waits for the catalog before reading the link', () => {
    openLink([{ uniqueId: 'a-normal', name: 'Card A', price: 10, quantity: 1 }], []);

    const { result, rerender } = setup([], {});
    expect(result.current.haveList).toEqual([]);
    expect(result.current.hasLoadedFromURL).toBe(false);

    rerender({ g: cardGroups, l: cardIdLookup });

    expect(result.current.hasLoadedFromURL).toBe(true);
    expect(result.current.haveList.map((c) => c.name)).toEqual(['Card A']);
  });

  test('the linked trade becomes the saved draft so it survives navigation', () => {
    openLink([{ uniqueId: 'a-normal', name: 'Card A', price: 10, quantity: 2 }], []);

    setup();

    expect(savedDraft().have).toEqual([
      expect.objectContaining({ uniqueId: 'a-normal', name: 'Card A', quantity: 2 }),
    ]);
  });

  test('a link wins over a previously saved draft', () => {
    saveTradeDraft([{ uniqueId: 'b-normal', name: 'Card B', subTypeName: 'Normal', quantity: 4, price: 5 }], []);
    openLink([{ uniqueId: 'a-normal', name: 'Card A', price: 10, quantity: 1 }], []);

    const { result } = setup();

    expect(result.current.haveList.map((c) => c.name)).toEqual(['Card A']);
  });
});

describe('useTradeState — restoring the saved draft', () => {
  test('restores both sides on reload with the saved printing and quantity', () => {
    saveTradeDraft(
      [{ uniqueId: 'a-rf', name: 'Card A', subTypeName: 'Rainbow Foil', quantity: 3, price: 25 }],
      [{ uniqueId: 'b-normal', name: 'Card B', subTypeName: 'Normal', quantity: 1, price: 5 }],
    );

    const { result } = setup();

    expect(result.current.hasLoadedFromURL).toBe(false);
    expect(result.current.haveList[0]).toMatchObject({
      name: 'Card A',
      subTypeName: 'Rainbow Foil',
      uniqueId: 'a-rf',
      quantity: 3,
      imageUrl: 'a-rf.png',
    });
    expect(result.current.wantList[0]).toMatchObject({ name: 'Card B', quantity: 1 });
  });

  test('re-prices a restored card at the current catalog price', () => {
    saveTradeDraft([{ uniqueId: 'a-rf', name: 'Card A', subTypeName: 'Rainbow Foil', quantity: 1, price: 999 }], []);

    const { result } = setup();

    expect(result.current.haveList[0].price).toBe(25);
    expect(result.current.haveList[0].lowPrice).toBe(20);
  });

  test('finds the printing by name and finish when the saved id is gone', () => {
    saveTradeDraft([{ uniqueId: 'old-id', name: 'Card A', subTypeName: 'Rainbow Foil', quantity: 1, price: 25 }], []);

    const { result } = setup();

    expect(result.current.haveList[0]).toMatchObject({ uniqueId: 'a-rf', subTypeName: 'Rainbow Foil' });
  });

  test('falls back to the first printing when the saved finish no longer exists', () => {
    saveTradeDraft([{ uniqueId: null, name: 'Card A', subTypeName: 'Cold Foil', quantity: 1, price: 40 }], []);

    const { result } = setup();

    expect(result.current.haveList[0]).toMatchObject({ uniqueId: 'a-normal', subTypeName: 'Normal', price: 10 });
  });

  test('drops a saved card that is no longer in the catalog', () => {
    saveTradeDraft(
      [
        { uniqueId: 'gone', name: 'Removed Card', subTypeName: 'Normal', quantity: 1, price: 3 },
        { uniqueId: 'b-normal', name: 'Card B', subTypeName: 'Normal', quantity: 1, price: 5 },
      ],
      [],
    );

    const { result } = setup();

    expect(result.current.haveList.map((c) => c.name)).toEqual(['Card B']);
  });

  test.each([
    [0, 1],
    [-4, 1],
    ['abc', 1],
    [99, 6],
  ])('clamps a stored quantity of %p to %p', (stored, expected) => {
    window.localStorage.setItem(
      TRADE_DRAFT_KEY,
      JSON.stringify({ v: 1, have: [{ uniqueId: 'a-normal', name: 'Card A', quantity: stored }], want: [] }),
    );

    const { result } = setup();

    expect(result.current.haveList[0].quantity).toBe(expected);
  });

  test.each([
    ['unparseable text', '{not json'],
    ['a non-object value', '"hello"'],
    ['lists of the wrong type', JSON.stringify({ v: 1, have: 'nope', want: 42 })],
  ])('starts empty when the stored draft is %s', (_label, raw) => {
    window.localStorage.setItem(TRADE_DRAFT_KEY, raw);

    const { result } = setup();

    expect(result.current.haveList).toEqual([]);
    expect(result.current.wantList).toEqual([]);
  });

  test('keeps the draft in step with every edit', () => {
    const { result } = setup();

    act(() => result.current.addHaveCard('Card A'));
    act(() => result.current.updateHaveCardQuantity(0, 3));
    act(() => result.current.addWantCard('Card B'));

    expect(savedDraft()).toMatchObject({
      have: [expect.objectContaining({ name: 'Card A', quantity: 3 })],
      want: [expect.objectContaining({ name: 'Card B', quantity: 1 })],
    });

    act(() => result.current.removeHaveCard(0));

    expect(savedDraft().have).toEqual([]);
  });

  test('does not save anything before the catalog has loaded', () => {
    saveTradeDraft([{ uniqueId: 'a-normal', name: 'Card A', subTypeName: 'Normal', quantity: 2, price: 10 }], []);

    setup([], {});

    // The stored draft must not be wiped by the empty lists of a loading page.
    expect(savedDraft().have).toHaveLength(1);
  });
});

describe('useTradeState — prices follow the catalog', () => {
  test('refreshes prices when the catalog reloads and keeps the chosen printing', () => {
    const { result, rerender } = setup();
    act(() =>
      result.current.addHaveCard({ label: 'Card A', card: { _uniqueId: 'a-rf', subTypeName: 'Rainbow Foil' } }),
    );
    expect(result.current.haveTotal).toBe(25);

    const repriced = [
      {
        ...cardA,
        editions: [
          { ...cardA.editions[0], cardPrice: 12 },
          { ...cardA.editions[1], cardPrice: 30, lowPrice: 22 },
        ],
      },
      cardB,
    ];
    rerender({ g: repriced, l: cardIdLookup });

    expect(result.current.haveList[0]).toMatchObject({
      subTypeName: 'Rainbow Foil',
      price: 30,
      lowPrice: 22,
    });
    expect(result.current.haveTotal).toBe(30);
  });

  test('keeps a card whose name left the catalog at its last known price', () => {
    const { result, rerender } = setup();
    act(() => result.current.addHaveCard('Card B'));

    rerender({ g: [cardA], l: cardIdLookup });

    expect(result.current.haveList[0]).toMatchObject({ name: 'Card B', price: 5 });
  });
});

describe('useTradeState — clearing', () => {
  test('Clear empties both sides, the inputs, the address bar and the draft', () => {
    openLink(
      [{ uniqueId: 'a-normal', name: 'Card A', price: 10, quantity: 1 }],
      [{ uniqueId: 'b-normal', name: 'Card B', price: 5, quantity: 1 }],
    );
    const { result } = setup();
    act(() => result.current.setHaveInput('half typed'));

    act(() => result.current.clearTrade());

    expect(result.current.haveList).toEqual([]);
    expect(result.current.wantList).toEqual([]);
    expect(result.current.haveInput).toBe('');
    expect(window.location.search).toBe('');
    expect(savedDraft()).toMatchObject({ have: [], want: [] });
  });

  test('dismissing the link banner keeps the cards but forgets the link', () => {
    openLink([{ uniqueId: 'a-normal', name: 'Card A', price: 10, quantity: 1 }], []);
    const { result } = setup();

    act(() => result.current.clearURLTradeData());

    expect(window.location.search).toBe('');
    expect(result.current.urlTradeData).toBeNull();
    expect(result.current.hasLoadedFromURL).toBe(false);
    expect(result.current.haveList.map((c) => c.name)).toEqual(['Card A']);
  });
});

describe('useTradeState — reopening a trade from history', () => {
  test('restores both sides at current prices', () => {
    const { result } = setup();

    act(() =>
      result.current.loadTradeFromHistory({
        have_list: [{ name: 'Card A', subTypeName: 'Rainbow Foil', uniqueId: 'a-rf', quantity: 2, price: 1 }],
        want_list: [{ name: 'Card B', subTypeName: 'Normal', quantity: 1, price: 1 }],
      }),
    );

    expect(result.current.haveList[0]).toMatchObject({
      name: 'Card A',
      subTypeName: 'Rainbow Foil',
      uniqueId: 'a-rf',
      quantity: 2,
      price: 25,
    });
    expect(result.current.wantList[0]).toMatchObject({ name: 'Card B', price: 5 });
    expect(result.current.diff).toBe(45);
  });

  test('replaces whatever was in the calculator', () => {
    const { result } = setup();
    act(() => result.current.addHaveCard('Card B'));

    act(() =>
      result.current.loadTradeFromHistory({
        have_list: [{ name: 'Card A', quantity: 1 }],
        want_list: [],
      }),
    );

    expect(result.current.haveList.map((c) => c.name)).toEqual(['Card A']);
    expect(result.current.wantList).toEqual([]);
  });

  test('skips a card that is no longer in the catalog instead of failing', () => {
    const { result } = setup();

    act(() =>
      result.current.loadTradeFromHistory({
        have_list: [
          { name: 'Removed Card', quantity: 1 },
          { name: 'Card A', quantity: 1 },
        ],
        want_list: [{ name: 'Removed Card', quantity: 2 }],
      }),
    );

    expect(result.current.haveList.map((c) => c.name)).toEqual(['Card A']);
    expect(result.current.wantList).toEqual([]);
  });

  test('loads a trade saved by the mobile app, ignoring its cash and notes', () => {
    const { result } = setup();

    act(() =>
      result.current.loadTradeFromHistory({
        have_list: [
          {
            quantity: 2,
            price_each: 25,
            card: { id: 'a-rf', name: 'Card A', sub_type_name: 'Rainbow Foil', tcg_low: 20, image_url: 'm.png' },
          },
        ],
        want_list: [{ quantity: 1, price_each: 5, card: { id: 'b-normal', name: 'Card B' } }],
        have_cash: 10,
        want_cash: 0,
        notes: 'met at armory',
        currency_symbol: '$',
      }),
    );

    expect(result.current.haveList).toHaveLength(1);
    expect(result.current.haveList[0]).toMatchObject({
      name: 'Card A',
      subTypeName: 'Rainbow Foil',
      uniqueId: 'a-rf',
      quantity: 2,
      price: 25,
    });
    expect(result.current.wantList[0]).toMatchObject({ name: 'Card B', quantity: 1 });
  });

  test('tolerates a trade with missing sides', () => {
    const { result } = setup();

    act(() => result.current.loadTradeFromHistory({ have_list: null }));

    expect(result.current.haveList).toEqual([]);
    expect(result.current.wantList).toEqual([]);
  });

  test('does nothing when no trade is given', () => {
    const { result } = setup();
    act(() => result.current.addHaveCard('Card A'));

    act(() => result.current.loadTradeFromHistory(null));

    expect(result.current.haveList).toHaveLength(1);
  });

  test('clears a shared link from the address bar', () => {
    openLink([{ uniqueId: 'b-normal', name: 'Card B', price: 5, quantity: 1 }], []);
    const { result } = setup();

    act(() => result.current.loadTradeFromHistory({ have_list: [{ name: 'Card A' }], want_list: [] }));

    expect(window.location.search).toBe('');
    expect(result.current.urlTradeData).toBeNull();
    expect(result.current.haveList.map((c) => c.name)).toEqual(['Card A']);
  });
});
