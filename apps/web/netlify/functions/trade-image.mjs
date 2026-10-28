/**
 * The og:image for a shared trade: a 1200x630 PNG with the most valuable cards
 * on each side, the side totals and the cash that balances them. Linked from
 * the tags netlify/edge-functions/trade-meta.js writes into `/?trade=…`.
 *
 * Layout is described as satori element objects (no JSX build step here),
 * rendered to SVG, then rasterized by resvg.
 */

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import {
    decodeTradeParam,
    fetchPrintings,
    formatDollars,
    summarizeTrade
} from '../../src/utils/tradePreview.js';

const WIDTH = 1200;
const HEIGHT = 630;
const CARDS_PER_SIDE = 4;
const CARD_W = 124;
const CARD_H = 173;

// Dark theme tokens from src/theme/tokens.js.
const C = {
    bg: '#131110',
    surface: '#1B1816',
    sunken: '#24201C',
    border: '#3A332D',
    text: '#F3EDE7',
    muted: '#B5A99E',
    faint: '#7F746B',
    accent: '#D8834A',
    gain: '#46C285'
};

const h = (type, style, ...children) => ({
    type,
    props: { style: { display: 'flex', ...style }, children: children.flat().filter((c) => c != null && c !== false) }
});
const img = (src, style) => ({ type: 'img', props: { src, width: style.width, height: style.height, style } });

// Fonts ship in public/og/fonts and are read back from the site itself, which
// sidesteps bundling binary files into the function. Cached per instance.
let fontsPromise;
const loadFonts = (origin) => {
    fontsPromise ??= Promise.all(
        [500, 700].map(async (weight) => {
            const res = await fetch(new URL(`/og/fonts/onest-latin-${weight}-normal.woff`, origin));
            if (!res.ok) throw new Error(`font ${weight}: ${res.status}`);
            return { name: 'Onest', weight, style: 'normal', data: await res.arrayBuffer() };
        })
    ).catch((err) => {
        fontsPromise = undefined;
        throw err;
    });
    return fontsPromise;
};

const toDataUri = async (url) => {
    if (!url) return null;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
        if (!res.ok) return null;
        const type = res.headers.get('content-type') || 'image/jpeg';
        if (!type.startsWith('image/')) return null;
        const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
        return `data:${type};base64,${b64}`;
    } catch {
        return null;
    }
};

const ellipsis = { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' };

const cardTile = (card, image) =>
    h('div', {
        position: 'relative', width: CARD_W, height: CARD_H, borderRadius: 8,
        overflow: 'hidden', backgroundColor: C.sunken, border: `1px solid ${C.border}`,
        alignItems: 'center', justifyContent: 'center'
    },
        image
            ? img(image, { width: CARD_W, height: CARD_H, objectFit: 'cover' })
            : h('div', { padding: 10, fontSize: 16, color: C.muted, textAlign: 'center' }, card.name),
        card.quantity > 1
            ? h('div', {
                position: 'absolute', top: 6, right: 6, padding: '2px 8px', borderRadius: 999,
                backgroundColor: C.bg, color: C.text, fontSize: 16, fontWeight: 700
            }, `${card.quantity}x`)
            : null
    );

const moreTile = (count) =>
    h('div', {
        width: CARD_W, height: CARD_H, borderRadius: 8, backgroundColor: C.surface,
        border: `1px dashed ${C.border}`, alignItems: 'center', justifyContent: 'center',
        fontSize: 30, fontWeight: 700, color: C.muted
    }, `+${count}`);

const sideColumn = (label, side, images, cash) => {
    const shown = side.cards.length > CARDS_PER_SIDE
        ? side.cards.slice(0, CARDS_PER_SIDE - 1)
        : side.cards;
    const hidden = side.cards.length - shown.length;
    const names = side.cards.slice(0, 2).map((c) =>
        [c.quantity > 1 ? `${c.quantity}x` : null, c.tag || null, c.name].filter(Boolean).join(' '));

    return h('div', { flexDirection: 'column', width: 516 },
        h('div', { fontSize: 22, fontWeight: 700, letterSpacing: 3, color: C.faint }, label.toUpperCase()),
        h('div', { alignItems: 'baseline', marginTop: 4 },
            h('div', { fontSize: 56, fontWeight: 700, color: C.text },
                side.cards.length ? formatDollars(side.total) : '—'),
            cash ? h('div', { marginLeft: 16, fontSize: 26, fontWeight: 700, color: C.gain }, `+ ${cash} cash`) : null
        ),
        side.cards.length
            ? h('div', { marginTop: 18, gap: 12 },
                shown.map((card, i) => cardTile(card, images[i])),
                hidden > 0 ? moreTile(hidden) : null)
            : h('div', {
                marginTop: 18, height: CARD_H, borderRadius: 8, border: `1px dashed ${C.border}`,
                alignItems: 'center', justifyContent: 'center', fontSize: 26, color: C.muted
            }, 'Open to offers'),
        h('div', { flexDirection: 'column', marginTop: 14 },
            names.map((name) => h('div', { fontSize: 21, color: C.muted, maxWidth: 516, ...ellipsis }, name)))
    );
};

const swapIcon =
    'data:image/svg+xml;base64,' +
    Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h15l-4-4"/><path d="M20 16H5l4 4"/></svg>`
    ).toString('base64');

export const renderTradeImage = async (summary, { origin, fetchImages = toDataUri } = {}) => {
    const pick = (side) => side.cards.slice(0, CARDS_PER_SIDE).map((c) => fetchImages(c.imageUrl));
    const [fonts, haveImages, wantImages] = await Promise.all([
        loadFonts(origin),
        Promise.all(pick(summary.have)),
        Promise.all(pick(summary.want))
    ]);

    // Cash goes on the lighter side, the one that has to add it.
    const bothSides = summary.have.cards.length && summary.want.cards.length;
    const cash = bothSides && Math.abs(summary.diff) >= 0.5 ? formatDollars(summary.diff) : null;

    const tree = h('div', {
        width: WIDTH, height: HEIGHT, flexDirection: 'column', padding: '44px 56px',
        backgroundColor: C.bg, color: C.text, fontFamily: 'Onest'
    },
        h('div', { justifyContent: 'space-between', alignItems: 'center' },
            h('div', { alignItems: 'baseline', fontSize: 30, fontWeight: 700 },
                h('div', { color: C.accent }, 'FAB Trades'),
                h('div', { color: C.faint, marginLeft: 14, fontSize: 24, fontWeight: 500 }, 'Trade offer')),
            h('div', { fontSize: 22, color: C.faint }, 'fabtrades.net')
        ),
        h('div', { flexGrow: 1, marginTop: 30, justifyContent: 'space-between' },
            sideColumn('Have', summary.have, haveImages, summary.diff < 0 ? cash : null),
            h('div', { width: 56, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
                img(swapIcon, { width: 48, height: 48 })),
            sideColumn('Want', summary.want, wantImages, summary.diff > 0 ? cash : null)
        ),
        h('div', { fontSize: 20, color: C.faint },
            bothSides && !cash
                ? 'Even trade at TCGplayer prices · open the link to counter'
                : 'TCGplayer prices · open the link to balance or counter')
    );

    const svg = await satori(tree, { width: WIDTH, height: HEIGHT, fonts });
    return new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
};

export default async (request) => {
    const url = new URL(request.url);
    const trade = decodeTradeParam(url.searchParams.get('trade'));
    if (!trade) return Response.redirect(new URL('/app_icon.png', url.origin), 302);

    try {
        const printings = await fetchPrintings([...trade.have, ...trade.want].map((i) => i.id));
        const png = await renderTradeImage(summarizeTrade(trade, printings), { origin: url.origin });
        return new Response(png, {
            headers: {
                'Content-Type': 'image/png',
                // The link carries its own prices, so a given URL always draws the
                // same picture. Let the CDN keep it; browsers a day.
                'Cache-Control': 'public, max-age=86400',
                'Netlify-CDN-Cache-Control': 'public, durable, max-age=31536000, immutable'
            }
        });
    } catch (err) {
        console.error('[trade-image]', err);
        return Response.redirect(new URL('/app_icon.png', url.origin), 302);
    }
};

export const config = { path: '/og/trade.png' };
