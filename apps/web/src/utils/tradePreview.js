/**
 * Link previews for shared trades (`fabtrades.net/?trade=…`).
 *
 * The site is a client-rendered SPA, so a bot unfurling a trade link in
 * Discord, iMessage or Facebook only ever sees the generic index.html tags.
 * Two Netlify handlers use this module to fix that:
 *
 *   netlify/edge-functions/trade-meta.js  -> rewrites the <head> of `/?trade=`
 *   netlify/functions/trade-image.mjs     -> draws the card image (og:image)
 *
 * Everything here is plain web APIs (fetch, atob, TextDecoder) so the same file
 * runs in Netlify's Deno edge runtime, in a Node function and under Jest.
 */

import { foilAbbrev, parseDiscordCardName } from './tradeOffer.js';

export const SITE_URL = 'https://fabtrades.net';
export const IMAGE_PATH = '/og/trade.png';

// The card catalog every deploy context can read. Previews of production links
// should name production cards, and these are publishable read-only keys.
export const CATALOG_SUPABASE_URL = 'https://tenrvaghaspwdvnwvgrh.supabase.co';
export const CATALOG_SUPABASE_KEY = 'sb_publishable_ohMvMDesyA2rr4Y4nfALpg_i0N-swkr';

// A link is user-supplied; bound the work one request can ask for.
const MAX_ITEMS_PER_SIDE = 60;
const MAX_PARAM_LENGTH = 16000;

const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

/**
 * Decode the `trade` query param the same way `decodeTradeFromURL` does.
 *
 * @param {string|null} param
 * @returns {{ have: Array<{id: string, price: number, quantity: number}>,
 *             want: Array<{id: string, price: number, quantity: number}>,
 *             timestamp: number|null } | null}
 */
export const decodeTradeParam = (param) => {
    if (!param || param.length > MAX_PARAM_LENGTH) return null;
    try {
        let raw = param;
        try {
            raw = decodeURIComponent(raw);
        } catch {
            // Already decoded.
        }
        // A `+` pasted unencoded into a query string arrives as a space.
        raw = raw.replace(/ /g, '+');
        const binary = atob(raw);
        const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
        const data = JSON.parse(new TextDecoder().decode(bytes));
        if (!data || !data.v || data.v > 1) return null;

        const items = (list) =>
            (Array.isArray(list) ? list : [])
                .slice(0, MAX_ITEMS_PER_SIDE)
                .map((entry) => {
                    const [id, price, quantity] = Array.isArray(entry)
                        ? entry
                        : [entry?.n, entry?.p, entry?.q];
                    return {
                        id: String(id ?? '').slice(0, 200),
                        price: Math.max(0, toNumber(price)),
                        quantity: Math.min(999, Math.max(1, Math.round(toNumber(quantity)) || 1))
                    };
                })
                .filter((item) => item.id);

        const have = items(data.h);
        const want = items(data.w);
        if (have.length === 0 && want.length === 0) return null;
        return { have, want, timestamp: data.t ? toNumber(data.t) * 60000 : null };
    } catch {
        return null;
    }
};

/**
 * Look up names and images for the printings a trade mentions.
 * Resolves to an empty map on any failure: a preview without names is still
 * better than no page.
 *
 * @returns {Promise<Map<string, {name: string, imageUrl: string, subTypeName: string}>>}
 */
export const fetchPrintings = async (ids, {
    url = CATALOG_SUPABASE_URL,
    key = CATALOG_SUPABASE_KEY,
    fetchImpl = fetch,
    timeoutMs = 2500
} = {}) => {
    const unique = [...new Set(ids)].filter(Boolean);
    const byId = new Map();
    if (unique.length === 0) return byId;

    const list = unique.map((id) => `"${id.replace(/["\\]/g, '')}"`).join(',');
    const query =
        'fab_cards_with_prices?select=id,name,image_url,sub_type_name' +
        `&id=in.(${encodeURIComponent(list)})`;

    try {
        const response = await fetchImpl(`${url}/rest/v1/${query}`, {
            headers: { apikey: key, Authorization: `Bearer ${key}` },
            signal: AbortSignal.timeout(timeoutMs)
        });
        if (!response.ok) return byId;
        for (const row of await response.json()) {
            byId.set(row.id, {
                name: row.name || '',
                imageUrl: row.image_url || '',
                subTypeName: row.sub_type_name || ''
            });
        }
    } catch {
        // Fall through with whatever we have.
    }
    return byId;
};

/**
 * Join a decoded trade with catalog rows into display-ready sides.
 * Unknown ids (old name-based links, retired printings) keep their raw id as
 * the name so the totals still add up.
 */
export const summarizeTrade = (trade, printings = new Map()) => {
    const side = (items) => {
        const cards = items.map((item) => {
            const printing = printings.get(item.id);
            const { baseName, artAbbrev } = parseDiscordCardName(printing?.name || item.id);
            const foil = printing ? foilAbbrev(printing.subTypeName) : null;
            const tags = [foil && foil !== 'NF' ? foil : null, artAbbrev].filter(Boolean);
            return {
                name: baseName,
                tag: tags.join(' '),
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity,
                imageUrl: printing?.imageUrl || ''
            };
        });
        // Most valuable first: that is what the preview has room for.
        cards.sort((a, b) => b.total - a.total);
        return {
            cards,
            count: cards.reduce((n, c) => n + c.quantity, 0),
            total: cards.reduce((sum, c) => sum + c.total, 0)
        };
    };

    const have = side(trade.have);
    const want = side(trade.want);
    return { have, want, diff: have.total - want.total };
};

export const formatDollars = (amount) =>
    `$${Math.round(Math.abs(amount)).toLocaleString('en-US')}`;

const cardLabel = (card) =>
    [card.quantity > 1 ? `${card.quantity}x` : null, card.tag || null, card.name]
        .filter(Boolean)
        .join(' ');

const sideHeadline = (side) => {
    if (side.cards.length === 0) return null;
    const [top] = side.cards;
    const rest = side.cards.length - 1;
    return rest > 0 ? `${top.name} + ${rest} more` : cardLabel(top);
};

const sideLine = (label, side, limit = 4) => {
    const names = side.cards.slice(0, limit).map(cardLabel);
    const more = side.cards.length - limit;
    if (more > 0) names.push(`+${more} more`);
    return `${label} (${formatDollars(side.total)}): ${names.join(', ')}`;
};

/** The og:title / og:description text for a summarized trade. */
export const tradeMeta = (summary) => {
    const { have, want, diff } = summary;
    const haveHead = sideHeadline(have);
    const wantHead = sideHeadline(want);

    let title;
    if (haveHead && wantHead) title = `Trade: ${haveHead} for ${wantHead}`;
    else if (haveHead) title = `Trade offer: ${haveHead}`;
    else title = `Looking for: ${wantHead}`;

    const parts = [];
    if (have.cards.length) parts.push(sideLine('Have', have));
    if (want.cards.length) parts.push(sideLine('Want', want));
    if (have.cards.length && want.cards.length) {
        parts.push(Math.abs(diff) < 0.5
            ? 'Even at TCGplayer prices'
            : `${formatDollars(diff)} apart at TCGplayer prices`);
    }

    return {
        title: title.length > 90 ? `${title.slice(0, 87)}…` : title,
        description: `${parts.join(' · ')}. Open it on FAB Trades to balance or counter.`
    };
};

const escapeHtml = (str = '') =>
    String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

// Tags index.html already carries that a trade preview replaces.
const REPLACED_TAGS = [
    /<title>[\s\S]*?<\/title>\s*/i,
    /<meta\s+name="description"[^>]*>\s*/i,
    /<meta\s+name="robots"[^>]*>\s*/i,
    /<meta\s+property="og:(?:type|title|description|url|image[^"]*)"[^>]*>\s*/gi,
    /<meta\s+name="twitter:(?:card|title|description|image)"[^>]*>\s*/gi
];

/**
 * Swap the generic site tags in index.html for ones describing this trade.
 *
 * @param {string} html
 * @param {{ title: string, description: string, imageUrl: string, pageUrl: string }} meta
 */
export const injectTradeMeta = (html, { title, description, imageUrl, pageUrl }) => {
    let out = html;
    for (const pattern of REPLACED_TAGS) out = out.replace(pattern, '');

    const t = escapeHtml(title);
    const d = escapeHtml(description);
    const tags = [
        `<title>${t} | FAB Trades</title>`,
        `<meta name="description" content="${d}" />`,
        // Every trade is a unique URL; keep them out of search results.
        '<meta name="robots" content="noindex, follow" />',
        '<meta property="og:type" content="website" />',
        `<meta property="og:title" content="${t}" />`,
        `<meta property="og:description" content="${d}" />`,
        `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
        `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
        '<meta property="og:image:type" content="image/png" />',
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        `<meta property="og:image:alt" content="${t}" />`,
        '<meta name="twitter:card" content="summary_large_image" />',
        `<meta name="twitter:title" content="${t}" />`,
        `<meta name="twitter:description" content="${d}" />`,
        `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`
    ];
    return out.replace(/<\/head>/i, `    ${tags.join('\n    ')}\n  </head>`);
};

/** The og:image URL for a trade link, on the same host the link was opened on. */
export const tradeImageUrl = (origin, tradeParam) => {
    const url = new URL(IMAGE_PATH, origin);
    url.searchParams.set('trade', tradeParam);
    return url.toString();
};
