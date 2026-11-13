import {
    buildHomeBodyHtml,
    buildHomeJsonLd,
    buildSetJsonLd,
    buildSitemapXml,
    buildTrendsContent,
    homeSetGuides,
    HOME_SET_GUIDE_COUNT,
} from '../../src/utils/seoContent.js';

const SITE = 'https://fabtrades.net';

const sets = Array.from({ length: 9 }, (_, i) => ({ name: `Set ${i + 1}`, slug: `set-${i + 1}` }));

describe('buildSetJsonLd', () => {
    const cards = [
        { name: 'Command and Conquer', subTypeName: 'Normal', marketPrice: 60 },
        { name: 'Command and Conquer', subTypeName: 'Rainbow Foil', marketPrice: 200 },
    ];
    const jsonLd = buildSetJsonLd({
        set: { name: 'Arcane Rising', slug: 'arcane-rising' },
        cards,
        siteUrl: SITE,
        pricesUpdatedAt: '2026-11-13T13:56:09.449+00:00',
    });
    const byType = (type) => jsonLd['@graph'].find((node) => node['@type'] === type);

    it('lists cards by name without claiming to sell them', () => {
        const list = byType('ItemList');
        expect(list.numberOfItems).toBe(2);
        expect(list.itemListElement).toEqual([
            { '@type': 'ListItem', position: 1, name: 'Command and Conquer' },
            { '@type': 'ListItem', position: 2, name: 'Command and Conquer (Rainbow Foil)' },
        ]);
        const text = JSON.stringify(jsonLd);
        expect(text).not.toContain('Offer');
        expect(text).not.toContain('InStock');
        expect(text).not.toContain('"Product"');
    });

    it('dates the page by the last price update', () => {
        expect(byType('WebPage')).toMatchObject({
            url: `${SITE}/sets/arcane-rising`,
            dateModified: '2026-11-13T13:56:09.449Z',
        });
    });

    it('omits the date when prices have no timestamp', () => {
        const undated = buildSetJsonLd({
            set: { name: 'Arcane Rising', slug: 'arcane-rising' },
            cards,
            siteUrl: SITE,
            pricesUpdatedAt: null,
        });
        expect(undated['@graph'].find((n) => n['@type'] === 'WebPage')).not.toHaveProperty('dateModified');
    });

    it('caps the list at 100 cards but reports the full count', () => {
        const many = Array.from({ length: 150 }, (_, i) => ({ name: `Card ${i}`, subTypeName: 'Normal' }));
        const list = buildSetJsonLd({
            set: { name: 'Big', slug: 'big' }, cards: many, siteUrl: SITE,
        })['@graph'].find((n) => n['@type'] === 'ItemList');
        expect(list.numberOfItems).toBe(150);
        expect(list.itemListElement).toHaveLength(100);
    });
});

describe('home page', () => {
    it('links to the first set guides in browse order', () => {
        expect(homeSetGuides(sets).map((s) => s.slug)).toEqual(
            sets.slice(0, HOME_SET_GUIDE_COUNT).map((s) => s.slug)
        );
    });

    it('skips sets without a slug', () => {
        expect(homeSetGuides([{ name: 'No slug', slug: '' }, sets[0]])).toEqual([sets[0]]);
    });

    it('prerenders one heading and links to guides, all sets and trending', () => {
        const html = buildHomeBodyHtml(sets);
        expect(html.match(/<h1>/g)).toHaveLength(1);
        expect(html).toContain('<a href="/sets/set-1">Set 1 price guide</a>');
        expect(html).not.toContain('/sets/set-7');
        expect(html).toContain('<a href="/sets">');
        expect(html).toContain('<a href="/trends">');
    });

    it('escapes set names', () => {
        const html = buildHomeBodyHtml([{ name: 'Rock & <Roll>', slug: 'rock-roll' }]);
        expect(html).toContain('Rock &amp; &lt;Roll&gt; price guide');
    });

    it('describes the site as a free web application', () => {
        expect(buildHomeJsonLd(SITE)).toMatchObject({
            '@type': 'WebApplication',
            url: `${SITE}/`,
            offers: { price: '0' },
        });
    });
});

describe('buildTrendsContent', () => {
    const movers = [
        {
            direction: 'gainer', name: 'Zero to Sixty (Red)', set_name: 'Arcane Rising',
            finish: '1st Edition Rainbow Foil', start_price: '3.75', latest_price: '15.58',
            percent_change: '3.1546666666666667',
        },
        {
            direction: 'loser', name: 'Spinal Crush (Red)', set_name: 'Welcome to Rathe',
            finish: 'Normal', start_price: '26', latest_price: '1.85',
            percent_change: '-0.92884615384615384615',
        },
    ];
    const page = buildTrendsContent({ movers, siteUrl: SITE, pricesUpdatedAt: '2026-11-13T13:56:09Z' });

    it('shows rising and falling cards with their prices and change', () => {
        expect(page.bodyHtml).toContain('<h2>Rising</h2>');
        expect(page.bodyHtml).toContain('Zero to Sixty (Red) <em>(1st Edition Rainbow Foil)</em>');
        expect(page.bodyHtml).toContain('$3.75');
        expect(page.bodyHtml).toContain('$15.58');
        expect(page.bodyHtml).toContain('+315%');
        expect(page.bodyHtml).toContain('<h2>Falling</h2>');
        expect(page.bodyHtml).toContain('-93%');
        expect(page.bodyHtml).not.toContain('<em>(Normal)</em>');
    });

    it('states when prices were updated', () => {
        expect(page.bodyHtml).toContain('Prices updated Nov 13, 2026.');
        expect(page.jsonLd).toMatchObject({ url: `${SITE}/trends`, dateModified: '2026-11-13T13:56:09.000Z' });
    });

    it('leaves out a direction with no cards', () => {
        const risingOnly = buildTrendsContent({ movers: movers.slice(0, 1), siteUrl: SITE });
        expect(risingOnly.bodyHtml).toContain('<h2>Rising</h2>');
        expect(risingOnly.bodyHtml).not.toContain('<h2>Falling</h2>');
    });
});

describe('buildSitemapXml', () => {
    const urls = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    it('lists the home page, set guides and trending', () => {
        const xml = buildSitemapXml({ siteUrl: SITE, sets: sets.slice(0, 2), lastmod: '2026-11-13', includeTrends: true });
        expect(urls(xml)).toEqual(expect.arrayContaining([
            `${SITE}/`, `${SITE}/sets`, `${SITE}/trends`, `${SITE}/sets/set-1`, `${SITE}/sets/set-2`,
        ]));
        expect(xml).toContain('<lastmod>2026-11-13</lastmod>');
    });

    it('leaves trending out when the page was not built', () => {
        const xml = buildSitemapXml({ siteUrl: SITE, sets: [], lastmod: '2026-11-13' });
        expect(urls(xml)).not.toContain(`${SITE}/trends`);
    });
});
