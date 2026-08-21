# FAB Trades — Architecture & Build Plan

A cross-platform (Android + iOS) mobile companion app for trading **Flesh and Blood**
(Legend Story Studios' TCG). Inspired by *MTG Trades*: look up prices,
balance trades, manage want lists/collection, and scan cards.

**This app reads from a shared Supabase database** populated daily by the pipeline in
[`../pipeline`](../pipeline). The same DB backs any other app (incl. the existing web
app). See §3 and [`DATABASE.md`](DATABASE.md).

> Status: Phases 0–5 built (search, card detail, trade balancer + history, collection &
> want lists, card scanning). See [`../context.md`](../context.md) for the current app
> code map and handoff notes. This document remains the source of truth for stack, data
> model, and roadmap.

---

## 1. Goals & non-goals

### Goals
- **Price lookup** for any Flesh and Blood card/printing (normal/foil), TCGplayer (USD) or
  CardMarket (EUR), market or low.
- **Trade balancer** — add cards + cash to "Have" / "Want" sides, see live delta.
- **Trade history** — store completed trades with *at-the-time* prices.
- **Want lists & collection** — track owned/wanted cards + total value.
- **Card scanning** — camera → OCR the card name (primary) + set-code collector number (confirming) → identify → add to trade/collection.
- **Offline-first** — full card DB cached locally; usable at a game store with no signal.
- **Android + iOS in sync** — one codebase, features ship to both simultaneously.

### Non-goals (for now)
- Gameplay simulation / deck legality (Legend Story Studios' terms restrict this).
- A marketplace / buying & selling. We show prices; we don't broker sales.
- Re-implementing the data pipeline — the web app already owns it (§3).

---

## 2. Stack decision: Flutter

**Chosen: Flutter (Dart)** — one codebase compiles to Android + iOS, features land on
both at once, strong support for lists/images/charts/camera+OCR. (Full comparison vs.
Kotlin Multiplatform and React Native is in git history; Flutter won on sync + speed.)

### Core packages (planned)
- **State/DI:** `riverpod` (+ `flutter_riverpod`)
- **Backend/data:** `supabase_flutter` (reads the shared Supabase DB)
- **Local DB / cache:** `drift` (typed SQLite) for offline mirror of fetched rows (§5)
- **Images:** `cached_network_image`
- **Charts:** `fl_chart` (price history, once history is tracked)
- **Scanning (Phase 5):** `camera` + `google_mlkit_text_recognition`
- **Models/serialization:** `freezed` + `json_serializable`
- **Routing:** `go_router`

---

## 3. Reuse strategy — the web app is the backend

Rather than each app scraping/parsing data, a **single Supabase database is the shared
backend**. A Node pipeline (this repo's [`../pipeline`](../pipeline)) ingests the sources
and upserts them daily; every app just reads Supabase.

### The pipeline (in `pipeline/`, runs daily via GitHub Actions)
Sources — both free, no API key (TCGCSV needs a `User-Agent` header):
- **TCGCSV** (`tcgcsv.com/tcgplayer/<gameId>/...`) for Flesh and Blood: sets via `/groups`,
  cards + USD prices + art via each set's `ProductsAndPrices.csv`.
- **CardMarket** EU prices from public S3 (game 16, Flesh and Blood), matched to cards by normalized name (including pitch color).

The pipeline (`fetchGroups` → `fetchGroupProducts` → `fetchCardMarketByName` →
`buildRows` → chunked `upsert`) writes to Supabase and appends a daily `price_history`
row per card. This *replaces* the web app's old `consolidated-data.json` output.

### The shared database (Supabase project `FAB Trades`)
See [`DATABASE.md`](DATABASE.md) for connection info and example queries.

```
[TCGCSV + CardMarket]
        │  pipeline/ (Node) — daily GitHub Action
        ▼
Supabase Postgres:  sets · cards · card_prices · price_history
        │  (RLS: public read-only; pipeline writes with service_role)
        ├───────────────► Flutter mobile app  (supabase_flutter)
        └───────────────► web app / other tools (supabase-js)
```

Benefits: one source of truth for all apps, prices + daily history maintained centrally,
server-side search/filter/sort, and no per-app data parsing.

### How the mobile app consumes it
Query the `fab_cards_with_prices` view via `supabase_flutter` (search/filter server-side),
then mirror fetched rows into a local `drift` cache for offline use (§5). Card art loads
from the `image_url` (TCGplayer CDN).

### Logic reused from the web app
- **Pipeline** ports the web app's ingest logic (sealed-product filter, safe numeric
  parsing, CardMarket name-matching, foil detection) into `pipeline/src/` — already done.
- **App** only needs the small bits: trade math (`Σ price×qty`; `have − want`) and
  price/foil selection, reimplemented in Dart (a few dozen lines).

---

## 4. Card identity & the real data schema

The app reads clean, typed rows from the `fab_cards_with_prices` view (full column list in
[`DATABASE.md`](DATABASE.md)). The pipeline has already handled the messy parts (string
prices → `numeric`, sealed-product flag, foil detection, CardMarket matching), so the
Dart model maps 1:1 to typed columns:

| Column | Meaning | Notes |
| --- | --- | --- |
| `id` | **primary key per printing**, `"<product_id>-<subtype>"` | e.g. `684123-foil` |
| `product_id` | TCGplayer product id | NOT unique (Normal+Foil share it) |
| `unique_id` | `SSSNNNN` convenience id | mirrors fabtrades/web-app convention |
| `set_id`, `set_name` | set | e.g. `24560`, `"Unleashed"` |
| `name`, `clean_name` | card name | |
| `image_url` | card art (TCGplayer CDN) | |
| `is_foil`, `sub_type_name` | foil flag / variant | precomputed |
| `is_sealed` | sealed product? | filter `= false` for real cards |
| `rarity` | `Common/…/Champion` | |
| `collector_number` | e.g. `"FAB428"`, `"PEN208"` (set codes; almost never `NNN/TTT`) | confirming OCR scan signal (§7); name OCR is primary |
| `tcg_low/mid/high/market/direct_low` | TCGplayer USD | `numeric`, `null` if unpriced |
| `cardmarket_id` | EU id or `null` | `null` ⇒ no EU price |
| `cm_avg/low/trend` (+ `…_foil`) | CardMarket EUR | `numeric`, `null` if unmatched |

**Notes for the Dart model:**
- Distinct printings (normal vs foil, alt-art) are separate rows keyed by `id`
  (`product_id` alone is not unique); group by `name` for display.
- Filter sealed products with `is_sealed = false` server-side.
- `price_history(card_id, captured_on, tcg_market, tcg_low, cm_trend, cm_low)` backs charts.

---

## 5. Local storage

- **Card/price data:** query Supabase (`fab_cards_with_prices`) directly for search; mirror
  fetched rows into a local **drift** (SQLite) cache so the last-seen data works offline.
  ~1.6k rows is tiny — an initial full sync + periodic refresh is fine.
- **User data (local, optionally cloud-synced later):**

```
collection(card_id, quantity, condition, is_wanted)   -- card_id = cards.id
trades(id, created_at, notes)
trade_items(trade_id, side, card_id?, quantity, cash_amount?, price_at_time)
settings(price_source, price_type)   -- tcgplayer|cardmarket, market|low
```

Card/price data lives in the shared Supabase DB (refreshed daily by the pipeline); user
data starts device-local and can sync via Supabase Auth + RLS later (§8, Phase 6).

---

## 6. App structure (feature-first)

```
lib/
  main.dart
  app/                 # theme, router, root widget
  core/
    data/              # supabase client + queries, drift offline cache
    models/            # freezed Card/Printing/Trade (mirrors §4 schema)
    logic/             # price/foil selection, trade math
  features/
    search/            # card search + filters (set/rarity/faction)
    card_detail/       # printings, current price, image
    trade/             # trade balancer + history
    collection/        # owned + want lists
    scan/              # camera + OCR (Phase 5)
```

---

## 7. Scanning approach (Phase 5) — OCR the name + set code

Real cards expose `collector_number` as a **set code** like `"FAB428"` or
`"PEN208"` (of ~16.8k non-sealed rows, essentially none use `NNN/TTT`).

1. Camera frame → **ML Kit text recognition** (on-device, offline, free).
2. Parse the printed **card name** (primary) and **set-code collector number**
   (confirming / ranking boost) from the OCR text.
3. Match name tokens against the local catalog; boost candidates whose set code
   agrees exactly with OCR.
4. Confirm with the user (show matched card), then add to trade/collection.

Name OCR is primary; the set code is an additive confirming signal. Ships last
because search + trade balancing deliver most of the value first.

---

## 8. Phased roadmap

- **Phase 0 — DONE (data backend).** Shared Supabase DB + daily pipeline are built (see
  `../pipeline`, [`DATABASE.md`](DATABASE.md)). Remaining: run the first production ingest
  (needs the service_role key) to populate it.
- **Phase 1 — Search + price lookup.** `supabase_flutter` query on `fab_cards_with_prices`
  (name/set/rarity), card detail with image + current price; price source/type toggle.
- **Phase 2 — Offline cache.** Mirror fetched rows into drift, background refresh.
- **Phase 3 — Trade balancer.** Have/Want + cash, live delta, save trade with at-the-time
  prices; trade history.
- **Phase 4 — Collection & want lists.** Owned + wanted, totals, sorting.
- **Phase 5 — Card scanning.** ML Kit OCR of name + set-code `collector_number` → identify → add.
- **Phase 6 — Cloud sync (optional).** Supabase Auth + RLS for multi-device user data.
- **Phase 7 — Binder.** Tradeable-stock binder replacing the Collection concept: one
  Binder nav tab (Binder + Want List views), scan/type add paths reusing existing flows,
  Confirm Trade reconciles the binder, filler/badge synergies. Full plan in
  [`BINDER-PLAN.md`](BINDER-PLAN.md); domain glossary in the repo-root `CONTEXT.md`.

---

## 9. Open questions / decisions
- **First ingest:** add the `service_role` key to `pipeline/.env` and run `npm run ingest`
  (or set the CI secrets and trigger the Action) to populate the DB.
- **Default price display:** TCGplayer US vs CardMarket EU — expose as a setting.
- **Price history depth:** `price_history` starts accumulating from the first run; charts
  get more useful over time. Consider a retention/rollup policy later.
- **Publisher compliance:** card art comes from the TCGplayer CDN. Legend Story Studios'
  guidelines may prefer official assets for published apps; track as a pre-launch legal
  item, especially for store submission.
- **Web app migration:** done — the web app now reads from the Supabase views via
  `src/services/fabDb.js`; no price data is committed to the repo anymore
  (details in [`DATABASE.md`](DATABASE.md)).
```
