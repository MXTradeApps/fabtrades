// What the prerendered pages say, kept apart from scripts/generateSeoPages.js
// (which reads files and the database) so it can be unit tested. The home page
// links are also rendered by the app itself, so the crawlable HTML and the
// page a visitor sees agree. Dependency-free: safe for Node scripts.

export const escapeHtml = (str = '') =>
    String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export const escapeAttr = (str = '') => escapeHtml(str).replace(/\n/g, ' ');

const toIsoDate = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const formatDay = (iso) => {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
    });
};

const printingName = (card) =>
    card.subTypeName && card.subTypeName.toLowerCase() !== 'normal'
        ? `${card.name} (${card.subTypeName})`
        : card.name;

// ---------------------------------------------------------------------------
// Set price guides
// ---------------------------------------------------------------------------

/**
 * Structured data for one set price guide: breadcrumbs, the page with the date
 * its prices were last refreshed, and the cards as a plain list.
 *
 * The cards are deliberately not `Product`s with an `Offer`. Google only shows
 * price results for a page about a single product, and FAB Trades does not sell
 * cards, so an "in stock" offer on a list page claimed something untrue.
 *
 * @param {{ set: {name: string, slug: string}, cards: Object[], siteUrl: string, pricesUpdatedAt?: string|null }} input
 */
export const buildSetJsonLd = ({ set, cards, siteUrl, pricesUpdatedAt }) => {
    const url = `${siteUrl}/sets/${set.slug}`;
    const dateModified = toIsoDate(pricesUpdatedAt);
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Sets', item: `${siteUrl}/sets` },
                    { '@type': 'ListItem', position: 2, name: set.name, item: url }
                ]
            },
            {
                '@type': 'WebPage',
                '@id': url,
                url,
                name: `${set.name} Card Price Guide`,
                ...(dateModified ? { dateModified } : {})
            },
            {
                '@type': 'ItemList',
                name: `${set.name} Card Price Guide`,
                numberOfItems: cards.length,
                itemListElement: cards.slice(0, 100).map((card, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    name: printingName(card)
                }))
            }
        ]
    };
};

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

export const HOME_HEADING = 'Flesh and Blood Trade Calculator & Price Guide';

export const HOME_INTRO =
    'Add the cards each side is trading and FAB Trades totals both sides with ' +
    'up-to-date TCGplayer prices, so you can see at a glance whether a Flesh and ' +
    'Blood trade is fair. Every set has a full card price guide.';

/** How many set guides the home page links to directly. */
export const HOME_SET_GUIDE_COUNT = 6;

/**
 * The set guides the home page links to: the newest main sets, which is where
 * the browse list starts.
 *
 * @param {{name: string, slug: string}[]} sets In browse order.
 */
export const homeSetGuides = (sets = []) =>
    sets.filter((s) => s?.slug).slice(0, HOME_SET_GUIDE_COUNT);

/** Crawlable body of the home page (the app replaces it once it mounts). */
export const buildHomeBodyHtml = (sets) => {
    const links = homeSetGuides(sets)
        .map((s) => `<li><a href="/sets/${escapeAttr(s.slug)}">${escapeHtml(s.name)} price guide</a></li>`)
        .join('\n        ');
    return `
    <h1>${escapeHtml(HOME_HEADING)}</h1>
    <p>${escapeHtml(HOME_INTRO)}</p>
    <h2>Card price guides</h2>
    <ul>
        ${links}
        <li><a href="/sets">All Flesh and Blood set price guides</a></li>
        <li><a href="/trends">Trending cards: this week's biggest price moves</a></li>
    </ul>`;
};

export const buildHomeJsonLd = (siteUrl) => ({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'FAB Trades',
    url: `${siteUrl}/`,
    description: HOME_INTRO,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
});

// ---------------------------------------------------------------------------
// Trending
// ---------------------------------------------------------------------------

export const TRENDS_TITLE = 'Trending Flesh and Blood Cards: Biggest Price Moves This Week';

export const TRENDS_DESCRIPTION =
    'Flesh and Blood cards rising and falling in price this week and this month, ' +
    'from TCGplayer and CardMarket Lows.';

const money = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : '—';
};

const percent = (v) => {
    const n = Number(v) * 100;
    if (!Number.isFinite(n)) return '';
    return `${n > 0 ? '+' : ''}${n.toFixed(0)}%`;
};

const moverRows = (rows) =>
    rows
        .map((r) => `<tr>
        <td>${escapeHtml(r.name)}${r.finish && r.finish.toLowerCase() !== 'normal' ? ` <em>(${escapeHtml(r.finish)})</em>` : ''}</td>
        <td>${escapeHtml(r.set_name || '')}</td>
        <td class="num">${money(r.start_price)}</td>
        <td class="num">${money(r.latest_price)}</td>
        <td class="num">${escapeHtml(percent(r.percent_change))}</td>
      </tr>`)
        .join('\n');

const moverTable = (heading, note, rows) =>
    rows.length === 0
        ? ''
        : `
    <h2>${escapeHtml(heading)}</h2>
    <p class="meta">${escapeHtml(note)}</p>
    <table>
      <thead><tr><th>Card</th><th>Set</th><th>A week ago</th><th>Now</th><th>Change</th></tr></thead>
      <tbody>
${moverRows(rows)}
      </tbody>
    </table>`;

/**
 * Crawlable Trending page from the same `fab_trending_movers` rows the app
 * shows by default (TCGplayer, 7 days, ranked by percent).
 *
 * @param {{ movers: Object[], siteUrl: string, pricesUpdatedAt?: string|null }} input
 */
export const buildTrendsContent = ({ movers = [], siteUrl, pricesUpdatedAt }) => {
    const rising = movers.filter((r) => r.direction === 'gainer');
    const falling = movers.filter((r) => r.direction === 'loser');
    const updated = formatDay(pricesUpdatedAt);
    const dateModified = toIsoDate(pricesUpdatedAt);

    const bodyHtml = `
    <h1>Trending Flesh and Blood Cards</h1>
    <p class="meta">The biggest price moves of the last 7 days on TCGplayer.${updated ? ` Prices updated ${escapeHtml(updated)}.` : ''}</p>${
        moverTable('Rising', 'Ranked by TCGplayer Low, the cheapest listed copy.', rising)
    }${
        moverTable('Falling', 'Ranked by TCGplayer Market price.', falling)
    }
    <p><a href="/sets">Flesh and Blood card price guides by set</a></p>`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: TRENDS_TITLE,
        url: `${siteUrl}/trends`,
        description: TRENDS_DESCRIPTION,
        ...(dateModified ? { dateModified } : {})
    };

    return { title: `${TRENDS_TITLE} | FAB Trades`, description: TRENDS_DESCRIPTION, bodyHtml, jsonLd };
};

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

/**
 * @param {{ siteUrl: string, sets: {slug: string}[], lastmod: string, includeTrends?: boolean }} input
 */
export const buildSitemapXml = ({ siteUrl, sets, lastmod, includeTrends = false }) => {
    const urls = [
        { loc: `${siteUrl}/`, priority: '1.0' },
        { loc: `${siteUrl}/sets`, priority: '0.9' },
        ...(includeTrends ? [{ loc: `${siteUrl}/trends`, priority: '0.8' }] : []),
        { loc: `${siteUrl}/support`, priority: '0.4' },
        { loc: `${siteUrl}/privacy`, priority: '0.3' },
        { loc: `${siteUrl}/terms`, priority: '0.3' },
        ...sets.map((s) => ({ loc: `${siteUrl}/sets/${s.slug}`, priority: '0.8' }))
    ];
    const body = urls
        .map(
            (u) =>
                `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
        )
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
};
