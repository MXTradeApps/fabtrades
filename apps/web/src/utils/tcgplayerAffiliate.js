/**
 * TCGplayer Impact affiliate deep links.
 *
 * Partner redirects use `?u=<percent-encoded destination>` so credit sticks
 * while landing on a specific product page.
 */

export const TCGPLAYER_PARTNER_LINK =
    'https://partner.tcgplayer.com/c/7492612/1780961/21018';

/**
 * Build an affiliate URL that opens a TCGplayer product page.
 *
 * @param {string|number|null|undefined} productId TCGplayer product id
 * @param {{ subTypeName?: string|null, partnerLink?: string }} [options]
 * @returns {string|null}
 */
export function tcgplayerAffiliateUrl(productId, options = {}) {
    if (productId == null || productId === '') return null;
    const id = Number(productId);
    if (!Number.isInteger(id) || id <= 0) return null;

    const partnerLink = options.partnerLink || TCGPLAYER_PARTNER_LINK;
    if (!partnerLink) return null;

    const destination = new URL(`https://www.tcgplayer.com/product/${id}`);
    const printing = (options.subTypeName || '').trim();
    if (printing && printing.toLowerCase() !== 'normal') {
        destination.searchParams.set('Printing', printing);
    }

    const url = new URL(partnerLink);
    url.searchParams.set('u', destination.toString());
    return url.toString();
}
