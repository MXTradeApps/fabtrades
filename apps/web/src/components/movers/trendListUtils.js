/** Shared pieces of the Trending-style ranked lists (Trending page, Collection Stats). */

/** Which price each list ranks by: Low for rising, Market (CM: Trend) for falling. */
export const measureLabel = (kind, priceSource) => {
    if (kind === 'gainer') return 'by Low';
    return priceSource === 'cardmarket' ? 'by Trend' : 'by Market';
};

export const windowLabel = (days) => (days === 7 ? 'this week' : `in the last ${days} days`);


export const artForRow = (row, cardIdLookup) => {
    const printing = cardIdLookup?.[row.card_id];
    return {
        imageUrl: printing?.imageUrl || row.image_url || '',
        fallbackUrl: printing?.imageUrlFallback || row.image_url || '',
    };
};

/** TCGplayer product + finish for the affiliate buy link (catalog first, then the row). */
export const buyForRow = (row, cardIdLookup) => {
    const printing = cardIdLookup?.[row.card_id];
    const fromId = /^(\d+)-/.exec(String(row.card_id || ''))?.[1];
    return {
        productId: printing?.productId || fromId || null,
        subTypeName: printing?.subTypeName || row.finish || null,
    };
};

export const segmentSx = {
    '& .MuiToggleButton-root': {
        px: 1.5,
        py: 0.5,
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.84rem',
    },
};

