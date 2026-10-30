import { TextDecoder } from 'node:util';
import {
    decodeTradeParam,
    fetchPrintings,
    injectTradeMeta,
    summarizeTrade,
    tradeImageUrl,
    readableCardName,
    tradeMeta
} from '../../src/utils/tradePreview.js';

// jsdom lacks these; Netlify's runtimes (Deno, Node) have them.
globalThis.TextDecoder ??= TextDecoder;
AbortSignal.timeout ??= () => undefined;

const encode = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64');

const printings = new Map([
    ['tunic-cf', { name: "Fyendal's Spring Tunic", imageUrl: 'https://img/tunic.jpg', subTypeName: '1st Edition Cold Foil' }],
    ['mask-rf', { name: 'Mask of Momentum', imageUrl: 'https://img/mask.jpg', subTypeName: 'Rainbow Foil' }],
    ['bolt-nf', { name: 'Fleeing Starbreeze (Extended Art) (MST040)', imageUrl: '', subTypeName: 'Normal' }]
]);

describe('decodeTradeParam', () => {
    it('reads the {v,t,h,w} payload web and mobile links carry', () => {
        const trade = decodeTradeParam(encode({ v: 1, t: 100, h: [['tunic-cf', 40.5, 2]], w: [['mask-rf', 12]] }));
        expect(trade).toEqual({
            have: [{ id: 'tunic-cf', price: 40.5, quantity: 2 }],
            want: [{ id: 'mask-rf', price: 12, quantity: 1 }],
            timestamp: 6000000
        });
    });

    it('accepts percent-encoded params and spaces where + was', () => {
        const raw = encode({ v: 1, h: [['é?>>', 1, 1]], w: [] });
        expect(raw).toMatch(/\+/);
        expect(decodeTradeParam(encodeURIComponent(raw))?.have[0].id).toBe('é?>>');
        expect(decodeTradeParam(raw.replace(/\+/g, ' '))?.have[0].id).toBe('é?>>');
    });

    it('rejects garbage, empty trades and unknown versions', () => {
        expect(decodeTradeParam(null)).toBeNull();
        expect(decodeTradeParam('not base64!!')).toBeNull();
        expect(decodeTradeParam(encode({ v: 1, h: [], w: [] }))).toBeNull();
        expect(decodeTradeParam(encode({ v: 2, h: [['a', 1, 1]] }))).toBeNull();
    });

    it('bounds sizes and clamps bad numbers', () => {
        const many = Array.from({ length: 200 }, (_, i) => [`c${i}`, -5, 'x']);
        const trade = decodeTradeParam(encode({ v: 1, h: many }));
        expect(trade.have).toHaveLength(60);
        expect(trade.have[0]).toEqual({ id: 'c0', price: 0, quantity: 1 });
    });
});

describe('summarizeTrade + tradeMeta', () => {
    it('names cards with Discord shorthand, most valuable first', () => {
        const summary = summarizeTrade(
            decodeTradeParam(encode({ v: 1, h: [['bolt-nf', 2, 3], ['tunic-cf', 400, 1]], w: [['mask-rf', 390, 1]] })),
            printings
        );
        expect(summary.have.cards.map((c) => c.name)).toEqual(["Fyendal's Spring Tunic", 'Fleeing Starbreeze']);
        expect(summary.have.cards[1]).toMatchObject({ tag: 'EA', quantity: 3, total: 6 });
        expect(summary.have.total).toBe(406);
        expect(summary.diff).toBe(16);

        const meta = tradeMeta(summary);
        expect(meta.title).toBe("Trade offer: 4 cards for Mask of Momentum");
        expect(meta.description).toBe(
            "Have ($406): Fyendal's Spring Tunic (Cold Foil) and 3× Fleeing Starbreeze (Extended Art)\n" +
            'Want ($390): Mask of Momentum (Rainbow Foil)\n' +
            'The Have side is worth $16 more at TCGplayer prices.'
        );
    });

    it('spells out finishes and art, folding them into the pitch color', () => {
        expect(readableCardName({ name: 'In the Palm of Your Hand (Red)', tag: 'CF', quantity: 2 }))
            .toBe('2× In the Palm of Your Hand (Red, Cold Foil)');
        expect(readableCardName({ name: 'Bolt', tag: 'RF EA', quantity: 1 })).toBe('Bolt (Rainbow Foil, Extended Art)');
        expect(readableCardName({ name: 'Bolt', tag: '', quantity: 1 })).toBe('Bolt');
    });

    it('lists the three most valuable cards and counts the rest', () => {
        const have = Array.from({ length: 6 }, (_, i) => [`c${i}`, 10 - i, i === 5 ? 2 : 1]);
        const meta = tradeMeta(summarizeTrade(decodeTradeParam(encode({ v: 1, h: have, w: [] }))));
        expect(meta.title).toBe('For trade: 7 cards');
        expect(meta.description).toBe('Have ($50): c0, 2× c5, c1 and 3 more cards\nPrices from TCGplayer.');
    });

    it('handles one-sided trades and unknown ids', () => {
        const wantOnly = tradeMeta(summarizeTrade(decodeTradeParam(encode({ v: 1, w: [['legacy name', 5, 1]] }))));
        expect(wantOnly.title).toBe('Looking for: legacy name');

        const even = tradeMeta(summarizeTrade(
            decodeTradeParam(encode({ v: 1, h: [['tunic-cf', 10, 1]], w: [['mask-rf', 10.2, 1]] })),
            printings
        ));
        expect(even.description).toContain('An even trade at TCGplayer prices.');
    });
});

describe('fetchPrintings', () => {
    it('asks the catalog for the unique ids and maps rows', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => [{ id: 'tunic-cf', name: 'Tunic', image_url: 'u', sub_type_name: 'Cold Foil' }]
        });
        const map = await fetchPrintings(['tunic-cf', 'tunic-cf', 'mask"rf'], { url: 'https://db', key: 'k', fetchImpl });
        const [requested] = fetchImpl.mock.calls[0];
        expect(decodeURIComponent(requested)).toContain('id=in.("tunic-cf","maskrf")');
        expect(map.get('tunic-cf')).toEqual({ name: 'Tunic', imageUrl: 'u', subTypeName: 'Cold Foil' });
    });

    it('returns an empty map when the catalog is unreachable', async () => {
        const fetchImpl = jest.fn().mockRejectedValue(new Error('down'));
        expect((await fetchPrintings(['a'], { fetchImpl })).size).toBe(0);
    });
});

describe('injectTradeMeta', () => {
    const shell = `<html><head>
    <meta name="description" content="generic" />
    <meta name="robots" content="index, follow" />
    <meta property="og:site_name" content="FAB Trades" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="generic" />
    <meta property="og:description" content="generic" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="generic" />
    <meta name="twitter:description" content="generic" />
    <title>generic</title>
  </head><body></body></html>`;

    it('replaces the generic tags and escapes trade text', () => {
        const html = injectTradeMeta(shell, {
            title: 'A "quoted" <card>',
            description: 'desc & more',
            imageUrl: tradeImageUrl('https://fabtrades.net', 'ab+c/='),
            pageUrl: 'https://fabtrades.net/?trade=x'
        });
        expect(html).not.toContain('generic');
        expect(html).toContain('<meta property="og:site_name" content="FAB Trades" />');
        expect(html).toContain('<meta property="og:title" content="A &quot;quoted&quot; &lt;card&gt;" />');
        expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
        expect(html).toContain('<meta name="robots" content="noindex, follow" />');
        expect(html).toContain('content="https://fabtrades.net/og/trade.png?trade=ab%2Bc%2F%3D"');
        expect(html.match(/<title>/g)).toHaveLength(1);
    });
});
