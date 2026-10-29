/**
 * Opens a short trade link: `/t/<code>` redirects to `/?trade=<param>`, where
 * the app loads the trade and the trade-meta edge function writes the link
 * preview (chat apps follow the redirect when unfurling). See
 * src/utils/tradeLinks.js.
 */

import { getStore } from '@netlify/blobs';
import { TRADE_LINK_STORE, isTradeLinkCode } from '../../src/utils/tradeLinks.js';

export default async (request, context) => {
    const origin = new URL(request.url).origin;
    const code = context.params?.code;

    let trade = null;
    if (isTradeLinkCode(code)) {
        try {
            // Strong reads so a link works the moment it is created.
            trade = await getStore({ name: TRADE_LINK_STORE, consistency: 'strong' }).get(code);
        } catch (err) {
            console.error('[trade-link]', err);
        }
    }

    if (!trade) return Response.redirect(`${origin}/`, 302);

    const target = new URL('/', origin);
    target.searchParams.set('trade', trade);
    return new Response(null, {
        status: 302,
        headers: {
            Location: target.toString(),
            // A code always maps to the same trade, so the CDN can keep the answer.
            'Cache-Control': 'public, max-age=3600',
            'Netlify-CDN-Cache-Control': 'public, durable, max-age=31536000'
        }
    });
};

export const config = { path: '/t/:code' };
