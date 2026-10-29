/**
 * Creates short trade links. POST `{ "trade": "<the ?trade= param>" }` and get
 * back `{ code, url }` where url is `<origin>/t/<code>`. Used by the web Share
 * Trade dialog and the mobile app's Share sheet. See src/utils/tradeLinks.js.
 */

import { getStore } from '@netlify/blobs';
import { decodeTradeParam } from '../../src/utils/tradePreview.js';
import { TRADE_LINK_PATH, TRADE_LINK_STORE, saveTradeLink } from '../../src/utils/tradeLinks.js';

const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

export default async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    }

    // A read-only health check: is the function routed, and can it reach Blobs?
    if (request.method === 'GET') {
        try {
            await getStore(TRADE_LINK_STORE).get('health-check');
            return json({ ok: true });
        } catch (err) {
            return json({ ok: false, error: String(err?.message || err) }, 500);
        }
    }

    let trade;
    try {
        ({ trade } = await request.json());
    } catch {
        return json({ error: 'Expected a JSON body.' }, 400);
    }
    // Only real trades get stored: the same checks the trade page applies.
    if (typeof trade !== 'string' || !decodeTradeParam(trade)) {
        return json({ error: 'Not a valid trade.' }, 400);
    }

    try {
        const code = await saveTradeLink(getStore(TRADE_LINK_STORE), trade);
        const origin = new URL(request.url).origin;
        return json({ code, url: `${origin}${TRADE_LINK_PATH}${code}` });
    } catch (err) {
        console.error('[trade-links]', err);
        return json({ error: 'Could not save the link.' }, 500);
    }
};

export const config = { path: '/api/trade-links', method: ['GET', 'POST', 'OPTIONS'] };
