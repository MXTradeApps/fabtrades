# Shared Card & Price Database (Riftbound + Flesh and Blood)

A single Supabase Postgres database that any of your apps (mobile, web, tools) can read
from. It hosts **two game datasets** in one project, split by table prefix:

- **Riftbound** — the original tables (`sets`, `cards`, ...), TCGplayer game id 89,
  populated from TCGCSV (TCGplayer) + CardMarket.
- **Flesh and Blood (FAB)** — the `fab_*` prefixed tables (`fab_sets`, `fab_cards`, ...),
  TCGplayer game id 62, populated from TCGCSV + CardMarket (game 16).

The FAB app and pipeline use the `fab_*` prefixed tables and the `fab_cards_with_prices`
view. Both datasets are populated by [`../pipeline`](../pipeline).

## Connection (for client apps)
The project is **shared** — both datasets use the same URL and publishable key.

| | |
| --- | --- |
| Project | `tenrvaghaspwdvnwvgrh` |
| URL | `https://tenrvaghaspwdvnwvgrh.supabase.co` |
| Publishable key | `sb_publishable_ohMvMDesyA2rr4Y4nfALpg_i0N-swkr` |

The publishable key is safe to ship in client apps. All card/price tables are **public
read-only** via RLS; only the pipeline's `service_role` key can write. Never put the
`service_role` key in a client app.

## Riftbound tables (game id 89)
| Table | Rows | Notes |
| --- | --- | --- |
| `sets` | ~9 | TCGplayer groups / expansions (`group_id`, `name`) |
| `cards` | ~1,660 | one row per **printing**; PK `id` = `"<product_id>-<subtype>"` (e.g. `684123-foil`), `set_id` → `sets.group_id` |
| `card_prices` | 1:1 with cards | current TCGplayer (USD) + CardMarket (EUR) prices; `card_id` → `cards.id` |
| `price_history` | daily | one snapshot per card per day for charts |
| `pipeline_runs` | — | ingest log (not client-readable) |
| `cards_with_prices` | view | cards + `set_name` + current prices (easiest to query) |

## Flesh and Blood tables (game id 62)
The FAB pipeline writes to these `fab_*` prefixed tables. `fab_cards` carries the same
columns as `cards` plus FAB-specific fields (`card_type`, `card_sub_type`, `card_class`,
`talent`, `pitch`, `cost`, `power`, `defense`, `life`, `intellect`). CardMarket EUR fields
are filled when a printing matches the public Flesh and Blood catalog (game 16).

| Table | Notes |
| --- | --- |
| `fab_sets` | TCGplayer groups / expansions (`group_id`, `name`) |
| `fab_cards` | one row per **printing**; PK `id` = `"<product_id>-<subtype>"`, `set_id` → `fab_sets.group_id`; includes FAB extended columns |
| `fab_card_prices` | current TCGplayer (USD) + CardMarket (EUR) prices; `card_id` → `fab_cards.id` |
| `fab_price_history` | one snapshot per card per day for charts |
| `fab_pipeline_runs` | ingest log (not client-readable) |
| `fab_cards_with_prices` | view: cards + `set_name` + current prices (easiest to query) |
| `fab_app_config` | single-row soft-update config (`latest_version`, store URLs, message); public read |

When you ship a new mobile build, bump `fab_app_config.latest_version` (and
store URLs if needed) so older installs show the in-app update reminder:

```sql
UPDATE fab_app_config
SET latest_version = '1.0.2',
    updated_at = now()
WHERE id = 1;
```

### Key `cards` columns
- `id` — stable per-printing PK, `"<product_id>-<subtype>"` (Normal and Foil are
  separate rows since they share `product_id`); use this to key collections/trades
- `product_id` — TCGplayer id (NOT unique across finishes); `unique_id` — `SSSNNNN` convenience id
- `name`, `clean_name`, `rarity`, `sub_type_name`, `is_foil`, `is_sealed`
- `collector_number` — e.g. `"FAB428"`, `"PEN208"` (set codes; the confirming OCR scan signal — name OCR is primary)
- `image_url` — TCGplayer CDN card art
- `cardmarket_id` — `null` when no EU price match

### `card_prices` columns
- TCGplayer (USD): `tcg_low`, `tcg_mid`, `tcg_high`, `tcg_market`, `tcg_direct_low`
- CardMarket (EUR): `cm_avg`, `cm_low`, `cm_trend` (+ `cm_*_foil` variants)

## Example queries

### supabase-js (JS/TS, e.g. the web app)
```js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://tenrvaghaspwdvnwvgrh.supabase.co',
  'sb_publishable_ohMvMDesyA2rr4Y4nfALpg_i0N-swkr'
);

// Search real cards by name, cheapest printing first
const { data } = await supabase
  .from('cards_with_prices')
  .select('name, set_name, rarity, is_foil, image_url, tcg_market, cm_trend')
  .eq('is_sealed', false)
  .ilike('name', '%jinx%')
  .order('tcg_market', { ascending: true })
  .limit(20);
```

### Dart / Flutter (the mobile app)
```dart
final supabase = SupabaseClient(
  'https://tenrvaghaspwdvnwvgrh.supabase.co',
  'sb_publishable_ohMvMDesyA2rr4Y4nfALpg_i0N-swkr',
);

final rows = await supabase
    .from('cards_with_prices')
    .select('product_id, name, set_name, image_url, tcg_market, tcg_low')
    .eq('is_sealed', false)
    .ilike('name', '%jinx%')
    .limit(20);
```

### Scan lookup (by collector number)
```js
const { data } = await supabase
  .from('cards_with_prices')
  .select('*')
  .eq('collector_number', 'FAB428');
```

### REST (any language)
```
GET https://tenrvaghaspwdvnwvgrh.supabase.co/rest/v1/cards_with_prices?name=ilike.*jinx*&is_sealed=eq.false&select=name,tcg_market
  apikey: sb_publishable_ohMvMDesyA2rr4Y4nfALpg_i0N-swkr
```

## Refresh cadence
The GitHub Action ([`../../.github/workflows/update-prices.yml`](../../.github/workflows/update-prices.yml))
runs the pipeline daily at 06:00 UTC, upserting current prices and appending a
`price_history` row per card. See [`../pipeline/README.md`](../pipeline/README.md) to run it manually.

## Web app (migrated)
The web app reads from this database too — no price data is committed to the repo anymore.
`src/services/fabDb.js` loads the catalog from `fab_cards_with_prices` and the set list from
`fab_sets`, mapping DB columns back to the legacy TCGCSV names the UI uses
(`tcg_market`→`marketPrice`, `tcg_low`→`lowPrice`, `image_url`→`imageUrl`, `rarity`→`extRarity`,
`collector_number`→`extNumber`, `sub_type_name`→`subTypeName`, `set_name`→`_setName`).
`fab_sets` also carries browse metadata for the set list: `abbreviation`, `published_on`,
`is_supplemental`, `modified_on` (kept current by the pipeline from the TCGCSV groups feed).

### The web app does not read this at runtime

Mobile queries the view per search. The web app cannot: it needs the whole catalog
in memory before search or trade math work, and PostgREST caps a response at 1000
rows, so that was ~17 paginated requests — none of them cacheable, because Supabase
sends no `Cache-Control`. Every visit re-downloaded the lot.

So [`apps/web/scripts/generateCatalog.js`](../../apps/web/scripts/generateCatalog.js)
runs the same queries **at build time** and writes the result to a content-hashed
`dist/catalog/catalog-<hash>.json`, which `netlify.toml` serves `immutable`. The
browser fetches one CDN file (~0.35 MB brotli) and makes no database request at all.

The consequence to remember: **fresh prices only reach the website when it rebuilds.**
`update-prices.yml` pings a Netlify build hook after each daily ingest for exactly
that reason. If prices look stale on the web but current on mobile, check that hook
before suspecting the pipeline.

`fetchCatalog()` falls back to reading the database directly when there is no
snapshot, which is what `vite dev` and a failed generation both look like.
