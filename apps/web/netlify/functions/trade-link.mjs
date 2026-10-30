/**
 * Opens a short trade link. `/t/<code>` answers with the app page itself,
 * with the trade's link preview tags written into its <head>: Discord,
 * iMessage and Facebook read the tags from the URL that was pasted and don't
 * reliably follow a redirect to find them. A small script then moves the
 * address to `/?trade=<param>`, where the app loads the trade. Unknown codes
 * go to the home page. See src/utils/tradeLinks.js.
 */

import { getStore } from '@netlify/blobs';
import {
    decodeTradeParam,
    fetchPrintings,
    injectTradeMeta,
    summarizeTrade,
    tradeImageUrl,
    tradeMeta
} from '../../src/utils/tradePreview.js';
import { TRADE_LINK_STORE, isTradeLinkCode, withTradeAddress } from '../../src/utils/tradeLinks.js';

export default async (request, context) => {
    const url = new URL(request.url);
    const code = context.params?.code;

    let param = null;
    if (isTradeLinkCode(code)) {
        try {
            // Strong reads so a link works the moment it is created.
            param = await getStore({ name: TRADE_LINK_STORE, consistency: 'strong' }).get(code);
        } catch (err) {
            console.error('[trade-link]', err);
        }
    }
    const trade = param && decodeTradeParam(param);
    if (!trade) return Response.redirect(`${url.origin}/`, 302);

    const longUrl = new URL('/', url.origin);
    longUrl.searchParams.set('trade', param);

    const [shell, printings] = await Promise.all([
        fetch(new URL('/index.html', url.origin)).catch(() => null),
        fetchPrintings([...trade.have, ...trade.want].map((item) => item.id))
    ]);
    // Without the page there is nothing to preview; the long link still opens the trade.
    if (!shell?.ok) return Response.redirect(longUrl.toString(), 302);

    const html = injectTradeMeta(withTradeAddress(await shell.text(), param), {
        ...tradeMeta(summarizeTrade(trade, printings)),
        imageUrl: tradeImageUrl(url.origin, param),
        pageUrl: `${url.origin}${url.pathname}`
    });

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            // Prices in the preview move, and the page points at the current
            // deploy's bundle, so keep it short-lived.
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'Netlify-CDN-Cache-Control': 'public, max-age=300'
        }
    });
};

export const config = { path: '/t/:code' };
