/**
 * Creates short trade links. POST `{ "trade": "<the ?trade= param>" }` and get
 * back `{ code, url }` where url is `<origin>/t/<code>`. Used by the web Share
 * Trade dialog and the mobile app's Share sheet. See src/utils/tradeLinks.js.
 */

import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { decodeTradeParam } from '../../src/utils/tradePreview.js';
import {
    TRADE_LINK_PATH,
    TRADE_LINK_STORE,
    saveTradeLink,
    tradeLinkCode
} from '../../src/utils/tradeLinks.js';

// node:crypto rather than Web Crypto, which is not a global on every Node
// runtime Netlify may pick for functions.
const sha256 = async (text) => createHash('sha256').update(text).digest();

// A tiny real trade for the health check.
const SAMPLE_TRADE = Buffer.from(JSON.stringify({ v: 1, h: [['health-check', 1, 1]], w: [] })).toString('base64');

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

    // Health check: runs every step a POST does on a fixed sample trade and
    // reports the first one that fails, so the live setup can be checked from
    // a browser.
    if (request.method === 'GET') {
        let step = 'decode';
        try {
            if (!decodeTradeParam(SAMPLE_TRADE)) throw new Error('sample trade did not decode');
            step = 'code';
            await tradeLinkCode(SAMPLE_TRADE, undefined, sha256);
            step = 'store';
            await saveTradeLink(getStore(TRADE_LINK_STORE), SAMPLE_TRADE, sha256);
            return json({ ok: true, node: process.version });
        } catch (err) {
            return json({ ok: false, step, node: process.version, error: String(err?.message || err) }, 500);
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
        const code = await saveTradeLink(getStore(TRADE_LINK_STORE), trade, sha256);
        const origin = new URL(request.url).origin;
        return json({ code, url: `${origin}${TRADE_LINK_PATH}${code}` });
    } catch (err) {
        console.error('[trade-links]', err);
        return json({ error: 'Could not save the link.', detail: String(err?.message || err) }, 500);
    }
};

export const config = { path: '/api/trade-links', method: ['GET', 'POST', 'OPTIONS'] };
