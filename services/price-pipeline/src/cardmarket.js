import { CARDMARKET_PRODUCTS_URL, CARDMARKET_PRICES_URL, HTTP_HEADERS } from './config.js';

// Normalize a name for cross-source matching (TCGplayer <-> CardMarket).
export function normalizeCardName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJSON(url) {
  const res = await fetch(url, { headers: HTTP_HEADERS });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Build a Map<normalizedName, cardmarketPrices> keyed by normalized card name.
export async function fetchCardMarketByName() {
  const [productsData, pricesData] = await Promise.all([
    fetchJSON(CARDMARKET_PRODUCTS_URL),
    fetchJSON(CARDMARKET_PRICES_URL)
  ]);

  const products = productsData.products || [];
  const priceGuides = pricesData.priceGuides || [];

  const priceById = new Map();
  for (const p of priceGuides) priceById.set(p.idProduct, p);

  const byName = new Map();
  for (const product of products) {
    const prices = priceById.get(product.idProduct);
    if (!prices) continue;
    byName.set(normalizeCardName(product.name), {
      idProduct: product.idProduct,
      name: product.name,
      avg: prices.avg ?? null,
      low: prices.low ?? null,
      trend: prices.trend ?? null,
      avgFoil: prices['avg-foil'] ?? null,
      lowFoil: prices['low-foil'] ?? null,
      trendFoil: prices['trend-foil'] ?? null
    });
  }
  return byName;
}
