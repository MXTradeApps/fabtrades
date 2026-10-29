import { buildTradePost } from '../../src/utils/salePost.js';

const wants = [
    { name: 'Fleeing Starbreeze (Extended Art) (MST040)', finish: 'Cold Foil', quantity: 2, price: 39.99 },
    { name: 'Enlightened Strike (Red)', finish: 'Normal', quantity: 1, price: 1.2 },
];

const items = [
    { name: 'Sink Below (Red)', finish: 'Normal', condition: 'LP', quantity: 1, price: 4.5 },
    { name: 'Command and Conquer (Red)', finish: 'Rainbow Foil', quantity: 2, price: 12 },
];

describe('buildTradePost', () => {
    it('writes an unpriced WTT post with both sides', () => {
        expect(buildTradePost({ mode: 'wtt', wants, items })).toEqual([
            [
                'WTT - Flesh and Blood singles',
                '',
                'Looking for:',
                '2x CF EA Fleeing Starbreeze',
                'NF Enlightened Strike (Red)',
                '',
                'Have:',
                '2x RF Command and Conquer (Red)',
                'NF Sink Below (Red) (LP)',
                '',
                'Looking to trade, all NM unless noted. DM me!',
                'Made on fabtrades.net',
            ].join('\n'),
        ]);
    });

    it('writes a priced WTS post of only the cards you have', () => {
        expect(buildTradePost({ mode: 'wts', wants, items, percent: 90, pricedOn: 'Oct 26, 2026' })).toEqual([
            [
                'WTS - Flesh and Blood singles',
                'Prices are 90% of TCGplayer market (Oct 26, 2026)',
                '',
                '2x RF Command and Conquer (Red) $11 ea',
                'NF Sink Below (Red) (LP) $4.05',
                '',
                '3 cards · $26 total',
                'All NM unless noted. DM me!',
                'Made on fabtrades.net',
            ].join('\n'),
        ]);
    });

    it('defaults to WTT and drops an empty side', () => {
        const [post] = buildTradePost({ wants, items: [] });
        expect(post).toContain('Looking for:');
        expect(post).not.toContain('Have:');
        expect(post.endsWith('Made on fabtrades.net')).toBe(true);
    });

    it('returns nothing when there is nothing to post', () => {
        expect(buildTradePost({ mode: 'wtt', wants: [], items: [] })).toEqual([]);
        expect(buildTradePost({ mode: 'wts', wants, items: [] })).toEqual([]);
    });

    it('uses no Discord-only markdown', () => {
        buildTradePost({ mode: 'wtt', wants, items }).concat(buildTradePost({ mode: 'wts', items }))
            .forEach((post) => expect(post).not.toContain('**'));
    });

    it('splits long posts under the limit without leading blank lines', () => {
        const many = Array.from({ length: 80 }, (_, i) => ({ name: `Card number ${i}`, finish: 'Normal', quantity: 1, price: i + 1 }));
        const posts = buildTradePost({ mode: 'wtt', wants: many, items: many, limit: 500 });
        expect(posts.length).toBeGreaterThan(1);
        posts.forEach((post) => {
            expect(post.length).toBeLessThanOrEqual(500);
            expect(post.startsWith('\n')).toBe(false);
        });
    });
});
