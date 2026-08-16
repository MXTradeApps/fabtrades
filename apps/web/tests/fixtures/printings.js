/**
 * Catalog-shaped Printing fixtures for the web card-detail modal.
 * Shape matches createCardObject in useCardData.jsx — not dummy placeholders.
 */

export const pricedPrinting = {
    _uniqueId: '123-Normal',
    productId: '123',
    name: 'Lightning Press',
    displayName: 'Lightning Press (SUP001)',
    _setName: 'Super Slam',
    extNumber: 'SUP001',
    subTypeName: 'Normal',
    imageUrl: 'https://example.test/lightning.webp',
    imageUrlFallback: 'https://example.test/lightning-fb.webp',
    marketPrice: 12.5,
    lowPrice: 8,
    midPrice: 11,
    highPrice: 20,
    directLowPrice: 7.5,
    cardmarketTrend: 10.2,
    cardmarketLow: 6.5,
    cardmarketAvg: 9.1,
    cardmarketTrendFoil: null,
    cardmarketLowFoil: null,
    cardmarketAvgFoil: null,
};

export const foilSibling = {
    ...pricedPrinting,
    _uniqueId: '123-Rainbow Foil',
    subTypeName: 'Rainbow Foil',
    imageUrl: 'https://example.test/lightning-rf.webp',
    marketPrice: 40,
    lowPrice: 28,
    midPrice: 36,
    highPrice: 55,
    directLowPrice: 25,
    cardmarketTrend: 32,
    cardmarketLow: 24,
    cardmarketAvg: 30,
    cardmarketTrendFoil: 35,
    cardmarketLowFoil: 26,
    cardmarketAvgFoil: 33,
};

export const reprintSibling = {
    ...pricedPrinting,
    _uniqueId: '999-Normal',
    productId: '999',
    _setName: 'History Pack 1',
    extNumber: 'HP001',
    displayName: 'Lightning Press (HP001)',
    imageUrl: 'https://example.test/lightning-hp.webp',
    marketPrice: 5,
    lowPrice: 3,
    midPrice: 4.5,
    highPrice: 8,
    directLowPrice: 2.5,
    cardmarketTrend: 4,
    cardmarketLow: 2.8,
    cardmarketAvg: 3.5,
};

export const unpricedPrinting = {
    _uniqueId: '124-Normal',
    productId: '124',
    name: 'New Promo',
    displayName: 'New Promo (FAB001)',
    _setName: 'Promos',
    extNumber: 'FAB001',
    subTypeName: 'Normal',
    imageUrl: '',
    imageUrlFallback: '',
    marketPrice: 0,
    lowPrice: null,
    midPrice: 0,
    highPrice: null,
    directLowPrice: 0,
    cardmarketTrend: null,
    cardmarketLow: 0,
    cardmarketAvg: null,
    cardmarketTrendFoil: null,
    cardmarketLowFoil: null,
    cardmarketAvgFoil: null,
};

/** Unrelated card — must not appear as a Version of Lightning Press. */
export const otherCard = {
    _uniqueId: '50-Normal',
    productId: '50',
    name: 'Sink Below',
    displayName: 'Sink Below (WTR001)',
    _setName: 'Welcome to Rathe',
    extNumber: 'WTR001',
    subTypeName: 'Normal',
    imageUrl: 'https://example.test/sink.webp',
    imageUrlFallback: '',
    marketPrice: 1.5,
    lowPrice: 0.5,
    midPrice: 1,
    highPrice: 3,
    directLowPrice: 0.4,
    cardmarketTrend: 1.2,
    cardmarketLow: 0.4,
    cardmarketAvg: 0.9,
};

export const catalogFixture = [
    pricedPrinting,
    foilSibling,
    reprintSibling,
    unpricedPrinting,
    otherCard,
];
