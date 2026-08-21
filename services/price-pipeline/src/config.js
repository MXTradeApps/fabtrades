import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Flesh and Blood identifiers on the two data sources.
export const TCG_GAME_ID = 62; // Flesh and Blood on TCGplayer / TCGCSV
export const ENABLE_CARDMARKET = true;
export const CARDMARKET_GAME_ID = 16; // Flesh and Blood on CardMarket (22 is Legends of Runeterra)

export const TCGCSV_BASE = `https://tcgcsv.com/tcgplayer/${TCG_GAME_ID}`;
export const CARDMARKET_PRODUCTS_URL = `https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_${CARDMARKET_GAME_ID}.json`;
export const CARDMARKET_PRICES_URL = `https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_${CARDMARKET_GAME_ID}.json`;

// tcgcsv.com returns HTTP 401 for requests without a User-Agent.
export const HTTP_HEADERS = {
  'User-Agent': 'fabtrades-pipeline/1.0 (+https://github.com/fabtrades; card & price ingest)',
  Accept: '*/*'
};

export const UPSERT_CHUNK_SIZE = 500;

export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in pipeline/.env (see .env.example) or as CI secrets.'
    );
  }
  // Service role bypasses RLS; this key must never ship in a client app.
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
