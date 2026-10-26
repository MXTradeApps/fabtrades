import { buildSalePost, buildTradePost } from '../../src/utils/salePost.js';

const wants = [
    { name: 'Fleeing Starbreeze (Extended Art) (MST040)', finish: 'Cold Foil', quantity: 2, price: 39.99 },
    { name: 'Enlightened Strike (Red)', finish: 'Normal', quantity: 1, price: 1.2 },
];

const items = [
    { name: 'Sink Below (Red)', finish: 'Normal', condition: 'LP', quantity: 1, price: 4.5 },
    { name: 'Command and Conquer (Red)', finish: 'Rainbow Foil', quantity: 2, price: 12 },
];

describe('buildTradePost', () => {
    it('writes Looking for and a priced Have list for Discord', () => {
        expect(buildTradePost({ mode: 'wtt-wts', platform: 'discord', wants, items, pricedOn: 'Oct 26, 2026' })).toEqual([
            [
                '**WTT/WTS** · prices are TCGplayer market (Oct 26, 2026)',
                '',
                '**Looking for**',
                '2x CF EA Fleeing Starbreeze',
                'NF Enlightened Strike (Red)',
                '',
                '**Have**',
                '2x RF Command and Conquer (Red) $12 ea',
                'NF Sink Below (Red) (LP) $4.50',
                '',
                'Happy to trade or sell, all NM unless noted. DM me!',
                'Made on fabtrades.net',
            ].join('\n'),
        ]);
    });

    it('leaves prices out in WTT mode', () => {
        const [post] = buildTradePost({ mode: 'wtt', platform: 'discord', wants, items });
        expect(post.startsWith('**WTT**\n')).toBe(true);
        expect(post).not.toMatch(/\$/);
        expect(post).toContain('Looking to trade, all NM unless noted. DM me!');
    });

    it('drops an empty side', () => {
        const [post] = buildTradePost({ mode: 'wtt-wts', platform: 'discord', wants, items: [] });
        expect(post).toContain('**Looking for**');
        expect(post).not.toContain('**Have**');
        expect(post.split('\n')[0]).toBe('**WTT/WTS**');
    });

    it('returns nothing for an empty trade', () => {
        expect(buildTradePost({ mode: 'wtt', platform: 'discord', wants: [], items: [] })).toEqual([]);
    });

    it('is the plain sale post in WTS mode', () => {
        const options = { platform: 'discord', items, percent: 90, pricedOn: 'Oct 26, 2026' };
        expect(buildTradePost({ ...options, mode: 'wts', wants })).toEqual(buildSalePost(options));
    });

    it('writes one Facebook message with both sections', () => {
        const posts = buildTradePost({ mode: 'wtt-wts', platform: 'facebook', wants, items, link: 'https://fabtrades.net/b/abc' });
        expect(posts).toHaveLength(1);
        expect(posts[0].split('\n')).toEqual([
            'WTT/WTS - Flesh and Blood singles',
            'Happy to trade or sell. Prices are TCGplayer market. All NM unless noted. Comment or message me!',
            '',
            'Looking for:',
            '2x Fleeing Starbreeze (EA, Cold Foil)',
            'Enlightened Strike (Red)',
            '',
            'Have:',
            '2x Command and Conquer (Red) (Rainbow Foil) - $12 each',
            'Sink Below (Red) (LP) - $4.50',
            '',
            'Full list: https://fabtrades.net/b/abc',
        ]);
    });

    it('splits long Discord posts under the limit without leading blank lines', () => {
        const many = Array.from({ length: 80 }, (_, i) => ({ name: `Card number ${i}`, finish: 'Normal', quantity: 1, price: i + 1 }));
        const posts = buildTradePost({ mode: 'wtt-wts', platform: 'discord', wants: many, items: many, limit: 500 });
        expect(posts.length).toBeGreaterThan(1);
        posts.forEach((post) => {
            expect(post.length).toBeLessThanOrEqual(500);
            expect(post.startsWith('\n')).toBe(false);
        });
    });
});
