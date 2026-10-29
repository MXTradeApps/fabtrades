/**
 * Gives shared trade links (`/?trade=…`) a rich preview when pasted into
 * Discord, iMessage, Facebook and the like: the SPA shell is served as usual,
 * but its generic <head> tags are swapped for the trade's title, a card-by-card
 * description and a generated image (netlify/functions/trade-image.mjs).
 *
 * Any other request to `/` passes through untouched.
 */

import {
    decodeTradeParam,
    fetchPrintings,
    injectTradeMeta,
    summarizeTrade,
    tradeImageUrl,
    tradeMeta
} from '../../src/utils/tradePreview.js';

export default async (request, context) => {
    const url = new URL(request.url);
    const param = url.searchParams.get('trade');
    if (!param) return;

    const trade = decodeTradeParam(param);
    if (!trade) return;

    const [response, printings] = await Promise.all([
        context.next(),
        fetchPrintings([...trade.have, ...trade.want].map((item) => item.id))
    ]);

    const type = response.headers.get('content-type') || '';
    if (!response.ok || !type.includes('text/html')) return response;

    const html = injectTradeMeta(await response.text(), {
        ...tradeMeta(summarizeTrade(trade, printings)),
        imageUrl: tradeImageUrl(url.origin, param),
        pageUrl: url.toString()
    });

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('etag');
    return new Response(html, { status: response.status, headers });
};

export const config = { path: '/' };
