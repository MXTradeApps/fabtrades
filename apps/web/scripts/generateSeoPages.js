/**
 * Build-time SEO generator for FAB Trades.
 *
 * Vite outputs a single client-rendered index.html, which means every route
 * ships the same empty shell + generic <title>. Search engines therefore see
 * no unique content for the per-set price guides. This script runs AFTER
 * `vite build` and, using the same Supabase card database the app loads at
 * runtime, pre-renders a real, crawlable HTML document for:
 *
 *   - each set price guide      -> dist/sets/<slug>/index.html
 *   - the "browse sets" page    -> dist/sets/index.html
 *   - the Trending page         -> dist/trends/index.html
 *   - the home page             -> dist/index.html (intro + links to guides)
 *
 * Each generated page includes a unique <title>, meta description, canonical
 * URL, Open Graph/Twitter tags, JSON-LD structured data, and the full price
 * table as static HTML. The regular Vite bundle is still loaded, so the
 * interactive SPA takes over on the client (see #seo-prerender removal in
 * src/main.jsx).
 *
 * It also emits sitemap.xml and robots.txt.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnv } from 'vite';
import { buildSetSlugMap } from '../src/utils/setSlug.js';
import { resolveSetAbbreviation } from '../src/utils/setAbbreviation.js';
import { compareSetsByBrowseOrder } from '../src/utils/setSort.js';
import {
    fetchCatalogRows,
    fetchSetGroups,
    fetchPricesUpdatedAt,
    trendingMovers
} from '../src/services/fabDb.js';
import {
    escapeHtml,
    escapeAttr,
    buildSetJsonLd,
    buildHomeBodyHtml,
    buildHomeJsonLd,
    buildTrendsContent,
    buildSitemapXml
} from '../src/utils/seoContent.js';
import {
    privacySections,
    PRIVACY_EFFECTIVE_DATE
} from '../src/content/privacyPolicy.js';
import {
    termsSections,
    TERMS_EFFECTIVE_DATE
} from '../src/content/termsOfUse.js';
import { SUPPORT_CONTACT_EMAIL } from '../src/content/support.js';

// Written by scripts/generateCatalog.js earlier in the build.
const SNAPSHOT_METADATA_FILE = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '.catalog-snapshot.json'
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// `vite build` reads .env itself; this script is plain Node and does not, so the
// same file is loaded here. On Netlify there is no .env and the variables are
// already in the environment, which is why existing values win.
Object.assign(process.env, {
    ...loadEnv('production', ROOT, 'VITE_'),
    ...process.env
});

// Netlify exposes the primary site URL as `URL` during builds; allow an
// explicit override via SITE_URL. Trailing slash is stripped for consistency.
const SITE_URL = (
    process.env.SITE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    'https://fabtrades.netlify.app'
).replace(/\/+$/, '');

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

const formatMoney = (v) => {
    const n = num(v);
    return n > 0 ? `$${n.toFixed(2)}` : '—';
};

const formatDate = (iso) => {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Mirror of isActualCard in useCardData/useSets so the generated set contents
// match exactly what the app shows.
const isActualCard = (row) => {
    const cardType = (row.extCardType || '').trim();
    const cardNumber = (row.extNumber || '').trim();
    const rarity = (row.extRarity || '').trim();
    const cardClass = (row.extClass || '').trim();
    if (cardType !== '') return true;
    if (cardNumber !== '' && (rarity !== '' || cardClass !== '')) return true;
    return false;
};

// Mirror of buildFabImageUrl in useCardData.
const FAB_CDN_BASE = 'https://d2wlb52bya4y8z.cloudfront.net/media/cards/large';
const getPrimaryExtNumber = (extNumber) => {
    if (!extNumber) return '';
    const cleaned = String(extNumber).split(/\s*\/\/\s*|\s*\/\s*/)[0];
    return cleaned ? cleaned.trim() : '';
};
const buildImageUrl = (row) => {
    const code = getPrimaryExtNumber(row.extNumber);
    if (code) {
        const sub = (row.subTypeName || '').toLowerCase();
        let suffix = '';
        if (sub.includes('cold foil')) suffix = '-CF';
        else if (sub.includes('rainbow foil')) suffix = '-RF';
        return `${FAB_CDN_BASE}/${code}${suffix}.webp`;
    }
    return row.imageUrl || '';
};

// ---------------------------------------------------------------------------
// Data loading + shaping (mirrors src/hooks/useSets.js)
// ---------------------------------------------------------------------------

/**
 * The same catalog the app will load, preferring the snapshot generateCatalog.js
 * already downloaded earlier in the build. Reading it off disk avoids pulling
 * ~17k rows over the network twice per build, and guarantees these prerendered
 * pages show exactly what the app shows.
 */
const loadData = async () => {
    try {
        const { file } = JSON.parse(await readFile(SNAPSHOT_METADATA_FILE, 'utf8'));
        const snapshot = JSON.parse(await readFile(path.join(DIST, file), 'utf8'));
        console.log(`[seo] Using catalog snapshot ${file} (${snapshot.rows.length} printings).`);
        return {
            groups: snapshot.sets,
            rows: snapshot.rows,
            metadata: { generatedAt: snapshot.pricesUpdatedAt }
        };
    } catch {
        console.log('[seo] No catalog snapshot; reading the database directly.');
    }

    const [groups, rows, pricesUpdatedAt] = await Promise.all([
        fetchSetGroups(),
        fetchCatalogRows(),
        fetchPricesUpdatedAt()
    ]);
    return { groups, rows, metadata: { generatedAt: pricesUpdatedAt } };
};

const buildSets = ({ groups, rows }) => {
    const cardsByGroup = new Map();
    for (const row of rows) {
        if (!isActualCard(row)) continue;
        const key = String(row.groupId || '');
        if (!key) continue;
        if (!cardsByGroup.has(key)) cardsByGroup.set(key, []);
        cardsByGroup.get(key).push(row);
    }

    const eligible = groups
        .map((g) => {
            const key = String(g.groupId);
            const cards = cardsByGroup.get(key) || [];
            if (cards.length === 0) return null;
            let topMarketPrice = 0;
            for (const c of cards) {
                const mp = num(c.marketPrice);
                if (mp > topMarketPrice) topMarketPrice = mp;
            }
            return {
                groupId: g.groupId,
                name: g.name || `Set ${g.groupId}`,
                abbreviation: resolveSetAbbreviation(
                    g.abbreviation,
                    cards.map((c) => c.extNumber)
                ),
                publishedOn: g.publishedOn || null,
                isSupplemental: !!g.isSupplemental,
                cards,
                cardCount: cards.length,
                topMarketPrice
            };
        })
        .filter(Boolean)
        .sort(compareSetsByBrowseOrder);

    const slugMap = buildSetSlugMap(eligible);
    for (const s of eligible) s.slug = slugMap.get(String(s.groupId)) || String(s.groupId);
    return eligible;
};

// ---------------------------------------------------------------------------
// HTML template plumbing
// ---------------------------------------------------------------------------

/**
 * Take the built dist/index.html shell and swap in page-specific <head> tags,
 * a JSON-LD block, and pre-rendered body content (inside #seo-prerender, which
 * the app removes after mount).
 */
const renderPage = (template, { title, description, canonicalPath, image, jsonLd, bodyHtml }) => {
    const canonical = `${SITE_URL}${canonicalPath}`;
    let html = template;

    html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeHtml(title)}</title>`);
    html = html.replace(
        /(<meta name="description" content=")[^"]*(")/,
        (_, open, close) => `${open}${escapeAttr(description)}${close}`
    );
    html = html.replace(
        /(<meta property="og:title" content=")[^"]*(")/,
        (_, open, close) => `${open}${escapeAttr(title)}${close}`
    );
    html = html.replace(
        /(<meta property="og:description" content=")[^"]*(")/,
        (_, open, close) => `${open}${escapeAttr(description)}${close}`
    );
    html = html.replace(
        /(<meta name="twitter:title" content=")[^"]*(")/,
        (_, open, close) => `${open}${escapeAttr(title)}${close}`
    );
    html = html.replace(
        /(<meta name="twitter:description" content=")[^"]*(")/,
        (_, open, close) => `${open}${escapeAttr(description)}${close}`
    );

    // Extra head tags (canonical, og:url, image, structured data) injected
    // before </head>. Injected here (rather than in the source shell) so Vite
    // never tries to resolve the href as a build asset.
    const headExtras = [
        `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
        `<meta property="og:url" content="${escapeAttr(canonical)}" />`,
        image ? `<meta property="og:image" content="${escapeAttr(image)}" />` : '',
        image ? `<meta name="twitter:image" content="${escapeAttr(image)}" />` : '',
        jsonLd
            ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
            : ''
    ]
        .filter(Boolean)
        .join('\n    ');

    if (image) {
        html = html.replace(
            /(<meta name="twitter:card" content=")[^"]*(")/,
            (_, open, close) => `${open}summary_large_image${close}`
        );
    }

    html = html.replace('</head>', () => `    ${headExtras}\n  </head>`);

    // Inject the crawlable content immediately after the SPA mount node. The
    // replacement is a function on purpose: in a replacement *string*, the "$1"
    // of a price like "$12.50" is read as "capture group 1", which swallowed
    // the "$1" and pasted a second #root in its place.
    html = html.replace(
        /<div id="root">\s*<\/div>/,
        (root) => `${root}\n    <div id="seo-prerender">${bodyHtml}</div>`
    );

    return html;
};

const SEO_BLOCK_STYLE = `
<style>
  #seo-prerender{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:960px;margin:0 auto;padding:24px 16px;color:#2c1810;background:#f5f1ed}
  #seo-prerender a{color:#8b4513}
  #seo-prerender h1{font-size:1.6rem;margin:0 0 4px}
  #seo-prerender .meta{color:#5d3a1a;font-size:.9rem;margin-bottom:16px}
  #seo-prerender table{width:100%;border-collapse:collapse;font-size:.9rem}
  #seo-prerender th,#seo-prerender td{text-align:left;padding:6px 8px;border-bottom:1px solid #e0d3c4}
  #seo-prerender td.num{text-align:right;font-variant-numeric:tabular-nums}
  #seo-prerender img{width:36px;height:auto;vertical-align:middle}
</style>`;

// ---------------------------------------------------------------------------
// Page builders
// ---------------------------------------------------------------------------

const buildSetPage = (template, set, pricesUpdatedAt) => {
    const sorted = [...set.cards].sort((a, b) => num(b.marketPrice) - num(a.marketPrice));
    const top = sorted[0];
    const topImage = top ? buildImageUrl(top) : '';
    const abbr = set.abbreviation ? ` (${set.abbreviation})` : '';
    const title = `${set.name}${abbr} Card Price Guide | FAB Trades`;
    const description =
        `Up-to-date TCGplayer market, low, and high prices for all ${set.cardCount} ` +
        `Flesh and Blood cards in ${set.name}${top ? `, including ${top.name}` : ''}. ` +
        `Sort by value and balance trades with FAB Trades.`;
    const canonicalPath = `/sets/${set.slug}`;

    const rows = sorted
        .map((c, i) => {
            const img = buildImageUrl(c);
            const nameCell = `${escapeHtml(c.name)}`;
            const printing = c.subTypeName && c.subTypeName.toLowerCase() !== 'normal'
                ? ` <em>(${escapeHtml(c.subTypeName)})</em>`
                : '';
            return `<tr>
        <td class="num">${i + 1}</td>
        <td>${img ? `<img loading="lazy" src="${escapeAttr(img)}" alt="${escapeAttr(`${c.name} - ${set.name}`)}" />` : ''}</td>
        <td>${nameCell}${printing}</td>
        <td>${escapeHtml(c.extNumber || '')}</td>
        <td>${escapeHtml(c.extRarity || '')}</td>
        <td class="num">${formatMoney(c.lowPrice)}</td>
        <td class="num">${formatMoney(c.marketPrice)}</td>
        <td class="num">${formatMoney(c.highPrice)}</td>
      </tr>`;
        })
        .join('\n');

    const bodyHtml = `${SEO_BLOCK_STYLE}
    <nav><a href="/sets">Flesh and Blood Sets</a> / ${escapeHtml(set.name)}</nav>
    <h1>${escapeHtml(set.name)}${escapeHtml(abbr)} Card Price Guide</h1>
    <p class="meta">${set.cardCount} printings · Released ${formatDate(set.publishedOn)} · Prices from TCGplayer${pricesUpdatedAt ? `, updated ${formatDate(pricesUpdatedAt)}` : ''}</p>
    <table>
      <thead><tr><th>#</th><th></th><th>Card</th><th>No.</th><th>Rarity</th><th>Low</th><th>Market</th><th>High</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>`;

    const jsonLd = buildSetJsonLd({ set, cards: sorted, siteUrl: SITE_URL, pricesUpdatedAt });

    return renderPage(template, {
        title,
        description,
        canonicalPath,
        image: topImage,
        jsonLd,
        bodyHtml
    });
};

const buildSetsIndexPage = (template, sets) => {
    const title = 'Flesh and Blood Card Price Guides by Set | FAB Trades';
    const description =
        'Browse every Flesh and Blood TCG set and see up-to-date TCGplayer market ' +
        'prices for each card. Pick a set for its full price guide.';
    const canonicalPath = '/sets';

    const items = sets
        .map(
            (s) => `<tr>
        <td><a href="/sets/${escapeAttr(s.slug)}">${escapeHtml(s.name)}</a>${s.abbreviation ? ` <span class="meta">${escapeHtml(s.abbreviation)}</span>` : ''}</td>
        <td>${escapeHtml(formatDate(s.publishedOn))}</td>
        <td class="num">${s.cardCount}</td>
        <td class="num">${formatMoney(s.topMarketPrice)}</td>
      </tr>`
        )
        .join('\n');

    const bodyHtml = `${SEO_BLOCK_STYLE}
    <h1>Flesh and Blood Card Price Guides by Set</h1>
    <p class="meta">Up-to-date TCGplayer prices for every Flesh and Blood set.</p>
    <table>
      <thead><tr><th>Set</th><th>Released</th><th>Cards</th><th>Top price</th></tr></thead>
      <tbody>
${items}
      </tbody>
    </table>`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Flesh and Blood Card Price Guides by Set',
        url: `${SITE_URL}${canonicalPath}`,
        hasPart: sets.map((s) => ({
            '@type': 'WebPage',
            name: `${s.name} Card Price Guide`,
            url: `${SITE_URL}/sets/${s.slug}`
        }))
    };

    return renderPage(template, { title, description, canonicalPath, jsonLd, bodyHtml });
};

const buildLegalPage = ({
    template,
    title,
    description,
    canonicalPath,
    heading,
    effectiveDate,
    sections,
    jsonLdName
}) => {
    const body = sections
        .map((section) => {
            const sectionBody = section.body
                .map((item) =>
                    item.type === 'ul'
                        ? `<ul>${item.items.map((li) => `<li>${escapeHtml(li)}</li>`).join('\n')}</ul>`
                        : `<p>${escapeHtml(item.text)}</p>`
                )
                .join('\n');
            return `<h2>${escapeHtml(section.heading)}</h2>\n${sectionBody}`;
        })
        .join('\n');

    const bodyHtml = `${SEO_BLOCK_STYLE}
    <h1>${escapeHtml(heading)}</h1>
    <p class="meta">Effective date: ${escapeHtml(effectiveDate)}</p>
${body}`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: jsonLdName,
        url: `${SITE_URL}${canonicalPath}`,
        dateModified: effectiveDate
    };

    return renderPage(template, { title, description, canonicalPath, jsonLd, bodyHtml });
};

const buildPrivacyPage = (template) =>
    buildLegalPage({
        template,
        title: 'Privacy Policy | FAB Trades',
        description:
            'Privacy policy for FAB Trades: what information the fabtrades.net ' +
            'website and the FAB Trades mobile app collect, how it is used, and ' +
            'your rights.',
        canonicalPath: '/privacy',
        heading: 'Privacy Policy',
        effectiveDate: PRIVACY_EFFECTIVE_DATE,
        sections: privacySections,
        jsonLdName: 'FAB Trades Privacy Policy'
    });

const buildTermsPage = (template) =>
    buildLegalPage({
        template,
        title: 'Terms of Use | FAB Trades',
        description:
            'Terms of Use (EULA) for FAB Trades: the fabtrades.net website, the ' +
            'FAB Trades mobile app, and FABTrades Pro auto-renewable subscriptions.',
        canonicalPath: '/terms',
        heading: 'Terms of Use',
        effectiveDate: TERMS_EFFECTIVE_DATE,
        sections: termsSections,
        jsonLdName: 'FAB Trades Terms of Use'
    });

const buildSupportPage = (template) => {
    const title = 'Support | FAB Trades';
    const description =
        'Contact FAB Trades support. Send a message with your name, email, ' +
        'and issue description — we typically reply within a few business days.';
    const canonicalPath = '/support';
    const bodyHtml = `
    <h1>Support</h1>
    <p class="meta">Contact FAB Trades at
      <a href="mailto:${escapeAttr(SUPPORT_CONTACT_EMAIL)}">${escapeHtml(SUPPORT_CONTACT_EMAIL)}</a>
      or use the form below.
    </p>
    <form name="support" method="POST" data-netlify="true" data-netlify-honeypot="bot-field">
      <input type="hidden" name="form-name" value="support" />
      <p style="display:none">
        <label>Don't fill this out: <input name="bot-field" /></label>
      </p>
      <p><label>Name <input type="text" name="name" required /></label></p>
      <p><label>E-mail <input type="email" name="email" required /></label></p>
      <p><label>Issue description <textarea name="message" required rows="5"></textarea></label></p>
      <p><button type="submit">Send message</button></p>
    </form>`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: 'FAB Trades Support',
        url: `${SITE_URL}${canonicalPath}`,
        description
    };

    return renderPage(template, { title, description, canonicalPath, jsonLd, bodyHtml });
};

// ---------------------------------------------------------------------------
// Sitemap + robots
// ---------------------------------------------------------------------------

const buildSitemap = (sets, metadata, { includeTrends }) =>
    buildSitemapXml({
        siteUrl: SITE_URL,
        sets,
        lastmod: (metadata?.generatedAt || new Date().toISOString()).slice(0, 10),
        includeTrends
    });

const buildRobots = () =>
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;

// Unlike the price tables, this block shows on the first paint of the app's
// busiest page, so it uses the app's own palette (index.css, dark by default)
// rather than the light table style above.
const HOME_BLOCK_STYLE = `
<style>
  #seo-prerender{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:var(--c-text,#F3EDE7)}
  #seo-prerender a{color:var(--c-accent,#D8834A)}
  #seo-prerender h1{font-size:1.6rem;margin:0 0 8px}
  #seo-prerender h2{font-size:1.1rem;margin:20px 0 4px}
  #seo-prerender p{color:var(--c-textMuted,#B5A99E);margin:0}
</style>`;

// dist/index.html is also what Netlify serves for every route without a page
// of its own (/binder, /b/<token>, ...). Those must not flash the home page's
// intro while the app loads.
const HOME_ONLY_SCRIPT =
    `<script>if(location.pathname!=='/'){var n=document.getElementById('seo-prerender');if(n)n.remove();}</script>`;

// The home page is the trade calculator, which is an empty shell until the app
// runs. Give crawlers what it is and where the price guides are, plus the
// absolute canonical + og:url (kept out of the source index.html so Vite doesn't
// try to resolve the href as an asset).
//
// The trade-meta edge function rewrites this same file's <head> for shared
// trade links; it replaces the title and og tags and leaves the rest alone.
const buildHomePage = (template, sets) => {
    let html = template;
    if (!/<link rel="canonical"/.test(html)) {
        html = html.replace(
            '</head>',
            `    <link rel="canonical" href="${SITE_URL}/" />\n    <meta property="og:url" content="${SITE_URL}/" />\n  </head>`
        );
    }
    html = html.replace(
        '</head>',
        () => `    <script type="application/ld+json">${JSON.stringify(buildHomeJsonLd(SITE_URL))}</script>\n  </head>`
    );
    return html.replace(
        /<div id="root">\s*<\/div>/,
        (root) =>
            `${root}\n    <div id="seo-prerender">${HOME_BLOCK_STYLE}${buildHomeBodyHtml(sets)}</div>${HOME_ONLY_SCRIPT}`
    );
};

// The Trending page's default view, frozen at build time. The site rebuilds
// after every price update, so this is the same list a visitor gets.
const buildTrendsPage = (template, movers, pricesUpdatedAt) => {
    const { title, description, bodyHtml, jsonLd } = buildTrendsContent({
        movers,
        siteUrl: SITE_URL,
        pricesUpdatedAt
    });
    return renderPage(template, {
        title,
        description,
        canonicalPath: '/trends',
        jsonLd,
        bodyHtml: `${SEO_BLOCK_STYLE}${bodyHtml}`
    });
};

// Same arguments as the Trending page's first load (RecentMoversSection).
// Trending is extra: if the movers can't be read, the page is skipped and the
// route falls back to the app shell, as it did before.
const loadMovers = async () => {
    try {
        const rows = await trendingMovers('tcgplayer', { days: 7, sort: 'percent', minPrice: 0, limit: 10 });
        return Array.isArray(rows) ? rows : [];
    } catch (err) {
        console.warn(`[seo] Could not load trending movers (${err.message}); skipping /trends.`);
        return [];
    }
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = async () => {
    if (!existsSync(DIST)) {
        console.error('[seo] dist/ not found. Run `vite build` first.');
        process.exit(1);
    }

    const template = await readFile(path.join(DIST, 'index.html'), 'utf8');
    const data = await loadData();
    const sets = buildSets(data);

    console.log(`[seo] Using SITE_URL=${SITE_URL}`);
    console.log(`[seo] Generating pages for ${sets.length} sets...`);

    // Per-set price guide pages.
    for (const set of sets) {
        const dir = path.join(DIST, 'sets', set.slug);
        await mkdir(dir, { recursive: true });
        await writeFile(
            path.join(dir, 'index.html'),
            buildSetPage(template, set, data.metadata?.generatedAt),
            'utf8'
        );
    }

    // Browse-sets landing page.
    await mkdir(path.join(DIST, 'sets'), { recursive: true });
    await writeFile(
        path.join(DIST, 'sets', 'index.html'),
        buildSetsIndexPage(template, sets),
        'utf8'
    );

    // Privacy + Terms (static so store listing URLs are always
    // crawlable/accessible even without JS).
    await mkdir(path.join(DIST, 'privacy'), { recursive: true });
    await writeFile(
        path.join(DIST, 'privacy', 'index.html'),
        buildPrivacyPage(template),
        'utf8'
    );
    await mkdir(path.join(DIST, 'terms'), { recursive: true });
    await writeFile(
        path.join(DIST, 'terms', 'index.html'),
        buildTermsPage(template),
        'utf8'
    );
    await mkdir(path.join(DIST, 'support'), { recursive: true });
    await writeFile(
        path.join(DIST, 'support', 'index.html'),
        buildSupportPage(template),
        'utf8'
    );

    // Trending.
    const movers = await loadMovers();
    const hasTrends = movers.length > 0;
    if (hasTrends) {
        await mkdir(path.join(DIST, 'trends'), { recursive: true });
        await writeFile(
            path.join(DIST, 'trends', 'index.html'),
            buildTrendsPage(template, movers, data.metadata?.generatedAt),
            'utf8'
        );
    }

    // Sitemap + robots.
    await writeFile(
        path.join(DIST, 'sitemap.xml'),
        buildSitemap(sets, data.metadata, { includeTrends: hasTrends }),
        'utf8'
    );
    await writeFile(path.join(DIST, 'robots.txt'), buildRobots(), 'utf8');

    // Last, because every page above is built from the untouched shell.
    await writeFile(path.join(DIST, 'index.html'), buildHomePage(template, sets), 'utf8');

    console.log(
        `[seo] Done. ${sets.length} set pages + sets index, home${hasTrends ? ', trends' : ''}, sitemap.xml, robots.txt written to dist/.`
    );
};

main().catch((err) => {
    console.error('[seo] Generation failed:', err);
    process.exit(1);
});
