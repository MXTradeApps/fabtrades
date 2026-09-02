# Research: Recent Card Gainers and Losers

## Decision: Rank in Postgres; clients display a short public RPC

**Rationale**: Catalog-wide movers need a start Low from `fab_price_history` (3–5 calendar days ago) and the current catalog Low for ~17k Printings. The catalog snapshot does not include history (001 research). Fetching the full history table or every Printing’s series on the client would miss SC-001 and violate constitution I. A `SECURITY INVOKER` SQL function `fab_recent_movers(p_source, p_card_ids default null)` reads existing public tables, applies eligibility + percent ranking, and returns at most 10 gainers and 10 losers. Signed-out works (`GRANT EXECUTE` to `anon` and `authenticated`). Pipeline stays read-only from the apps’ perspective.

Owned movers use the **same function** with `p_card_ids` = distinct Binder Printing ids (qty > 0, not Want List). That keeps one ranking implementation for both views and avoids a second client-side catalog scan.

History already has `unique (card_id, captured_on)` and `fab_price_history_card_id_idx`. The window filter is `captured_on BETWEEN CURRENT_DATE - 5 AND CURRENT_DATE - 3`. Add a btree on `captured_on` in the same migration so the RPC does not seq-scan a growing history table on every Home/Trends open. Do not add a movers table.

**Alternatives considered**:

- Client-side rank over a windowed `fab_price_history` dump (~50k rows for 3 days) — too heavy for the movers landing, and web would add a new hot path next to the snapshot.
- Materialized `fab_recent_movers` table written by ingest — extra write surface; ranking only needs to be correct after the nightly snapshot, and a STABLE function on ~17k rows is enough.
- Filter the catalog-wide top 10 for owned cards — owned Printings that moved but are not market-wide top 10 would disappear (fails US2).
- Per-Printing `priceHistory()` for every owned id — works for free-tier 50 cards, wasteful round-trips; one RPC with ids is the same rule as catalog-wide.

## Decision: Latest Low is `fab_card_prices`; start Low is history-only in the 3–5 day band

**Rationale**: FR-005 compares a start Low (most recent *observed* Low whose `captured_on` is 3–5 calendar days ago) to the **latest observed Low in the current catalog**. Current catalog Low is `fab_card_prices.tcg_low` / `cm_low` (already on `fab_cards_with_prices` and the snapshot). Start Low MUST come from `fab_price_history` in `[CURRENT_DATE - 5, CURRENT_DATE - 3]`. Distinct on `card_id` ordered by `captured_on DESC` among rows whose Low for the selected marketplace is non-null. No interpolation. A Low from 1–2 days ago or older than 5 days is not a start. Missing current Low → ineligible.

`CURRENT_DATE` in Supabase is the database calendar date (UTC). Pipeline `captured_on` is `new Date().toISOString().slice(0, 10)` (UTC date). Clients MUST NOT compute the window in local timezone; they pass `p_source` (and optional ids) and display the rows.

**Alternatives considered**:

- Start and latest both from history (latest = max `captured_on`) — can disagree with the Prices box if today’s prices row exists but today’s history upsert has not landed, or the reverse.
- Exact-day-7 start — superseded by clarification (recent window, not weekly).
- Client-local “today” for the window — US evening vs UTC would shuffle eligibility; one server date keeps both surfaces honest.

## Decision: Shared golden fixture for ranking math; SQL must match it

**Rationale**: Constitution IV. Percent change, $1/€1 floor, 0% exclusion, gainer vs loser, top-10 cut, and tie-break are the same on web and mobile (FR-015). Fixture: `packages/contracts/recent_movers.json`. JS `recentMovers.js` and Dart `recent_movers.dart` assert it. The SQL function is the production ranker for both catalog-wide and owned; it is specified to emit the same eligibility and order as the fixture. Identity fields on the RPC (name, set, finish) are catalog joins, not fixture math.

Owned Printing ids are a second small helper (`ownedPrintingIds`): live Binder entries with `quantity > 0`, `isWanted = false`, unique by Printing id. Want List is excluded. Same Printing in two Binders is one id.

**Not in the fixture** (surface-specific):

- Tab label Home vs web Trends / Browse Sets copy
- Search chrome and set-list placement
- Currency formatting (existing `formatPrice` / `Pricing`)
- Image thumbnails

**Alternatives considered**: Ranking only in SQL with no client helper — then JS and Dart cannot fail a build when the rule is misunderstood, and owned empty/hide logic still needs a shared id rule. Ranking only in clients after SQL returns every eligible catalog row — payload of thousands of movers on every landing open.

## Decision: Mobile Home is the renamed Browse landing; web Trends is a new destination

**Rationale**: Session 2026-08-26: the website MUST NOT have a Home page or a Home nav item. `/` stays the Trade Calculator. Trends and Browse Sets are separate hamburger destinations. Catalog-wide card search is on both. Mobile still uses Home as the first tab (formerly Browse).

| Surface | Today | This feature |
| --- | --- | --- |
| Mobile tab 0 | `BrowseScreen`, label Browse: search + set list | Same screen, label **Home**: search unchanged; empty query shows **recent movers then the existing set list**; search still covers the body |
| Web `/` | Trade calculator (`Home.jsx`) | Unchanged. Internal filename `Home.jsx` is not a player-facing Home. |
| Web hamburger | Trade Calculator, Binders, History, Want List, **Browse Sets** | Same order of existing items. Insert **Trends** immediately before Browse Sets. No Home item. |
| Web `/trends` | Does not exist | **Trends**: catalog Printing search + recent movers (owned then catalog-wide). No set list (FR-021). |
| Web `/sets` | Set list + set-name filter, nav “Browse Sets” | Still Browse Sets. Empty search shows the set list. Non-empty search shows catalog Printing results (FR-017). No movers. Route `/sets` kept (SEO/canonical). |

Putting the set list **below** movers on mobile keeps set browsing without a new tab. Web cannot do the same: clarification forbids mixing Trends and Browse Sets. Search non-empty on either web destination: Printing results only. Clearing search on Trends restores movers; clearing search on Browse Sets restores the set list.

**Alternatives considered**:

- Put movers on web `/sets` and rename the nav Home — contradicts 2026-08-26 (no web Home; Trends and Browse Sets stay separate).
- New `/home` or `/movers` route labeled Home — extra nav; spec forbids a web Home item.
- Replace web `/` with movers — contradicts the spec and the table-is-the-deadline trade calculator.
- Nested mobile set screen only — more navigation than needed; a scroll is one step and keeps current Browse muscle memory.
- Printing search on Trends only — fails FR-017 (search on both Trends and Browse Sets).

## Decision: Do not bake movers into the catalog snapshot

**Rationale**: Snapshot is already large; history is per-day and changes on ingest. The movers landing fetches independently. Catalog search and the set list paint from data already on device / in the snapshot (constitution: local reads). Movers loading, empty, and error MUST NOT block search, sets, Binder, or trade (FR-011, FR-020). Abort or ignore stale responses on marketplace change or unmount.

Session memory of the last successful catalog-wide payload is enough. No localStorage, no new CDN file. Do not add `/trends` to `generateSeoPages.js` (sets remain the SEO browse page).

**Alternatives considered**: Nightly movers JSON next to the snapshot — another generate/deploy artifact for 20 rows. Client SWR on `fab_price_history` — same weight problem as ranking on the client.

## Decision: Marketplace is the existing price source; CardMarket empty is empty

**Rationale**: FR-003 / FR-013. Mobile `AppSettings.source`, web `PriceContext.priceSource` (`tcgplayer` \| `cardmarket`). RPC `p_source` must be one of those two; anything else is an error (fail fast), not a silent TCG default. Low field is `tcg_low` or `cm_low` only. Never Market/Mid/High/Trend. Never mix marketplaces on one list.

CardMarket ingest may be enabled (`ENABLE_CARDMARKET`); `cm_low` can still be null for a Printing. Then that Printing is ineligible for CardMarket lists. A CardMarket landing with zero eligible rows is the honest empty state, not a TCG list.

**Alternatives considered**: Always TCG on the landing — ignores selected marketplace. Two columns — forbidden. Falling back to TCG when CM is empty — silent wrong currency.

## Decision: Price floor is start Low ≥ 1.00 in that marketplace’s unit

**Rationale**: Clarification: $1.00 TCGplayer / €1.00 CardMarket. Same numeric threshold; currency follows source. Compare **start** Low, not latest. `0.99` out; `1.00` in. 30¢ → 60¢ never appears.

Percent = `(latest - start) / start`. SQL `numeric` avoids float noise. 0% (`latest = start`) excluded. Gainers: `percent > 0`, order percent DESC, then `card_id` ASC. Losers: `percent < 0`, order percent ASC (most negative first), then `card_id` ASC. Sealed products (`fab_cards.is_sealed`) excluded so the lists match the catalog clients already show.

**Alternatives considered**: Floor on latest Low — a card that crashed from $2 to $0.50 would still be a real loser; spec says start Low. Floor on percent magnitude — not requested. Tie-break by |currency| — less stable than id.

## Decision: Web RPC via `fabDb.js` POST; do not use the auth supabase-js client for catalog ranking

**Rationale**: Catalog reads already go through `fabDb.js` + the publishable key (`restFetch` / `restGet`). `get_public_binder` is a different (auth) path. `recentMovers` is public catalog data, like `fab_price_history`. Extend `fabDb.js` with a POST + JSON body to `rpc/fab_recent_movers`. Invalid `p_source` surfaces as a failed request (error + retry), not a silent default.

Mobile already uses the Supabase Dart client for `fab_price_history`; `rpc('fab_recent_movers', …)` is the matching call.

**Alternatives considered**: `GET /fab_price_history` from the browser and rank in JS — payload and ranking-drift problems above. A new Edge Function — extra runtime for a query Postgres can answer.

## Decision: No Pro gate, no alerts, no pipeline change

**Rationale**: Assumptions and out of scope. Catalog-wide movers are public catalog data, like today’s prices. Clients MUST NOT write entitlements. Alerts stay out. Ingest already writes `fab_price_history`; this feature only reads.

**Alternatives considered**: Pro-only owned movers — spec says no Pro gate in this pass. Computing movers inside the pipeline — extra job for a query Postgres can answer.

## Open facts (resolved, not NEEDS CLARIFICATION)

| Topic | Resolution |
| --- | --- |
| Window | `captured_on` in `[today-5, today-3]` inclusive; start = most recent observed Low in that band |
| Today | Database `CURRENT_DATE` (UTC), matching pipeline `captured_on` |
| Latest Low | `fab_card_prices` for `p_source` |
| List length | 10 per side, or fewer if fewer qualify; never padded |
| Owned ids | Distinct Printing ids from any Binder with qty > 0; Want List excluded |
| Empty Binders | Hide owned section; catalog-wide only |
| Own-but-none-qualify | Owned empty copy first; catalog-wide below |
| Signed-out web Binder | Do not invent on-device web Binder (004); hide owned |
| Signed-out mobile Binder | On-device entries; owned shown if any qty > 0 |
| Web `/` | Unchanged Trade Calculator. Not labeled Home in the hamburger. |
| Web movers | `/trends`, hamburger **Trends**. No set list on this page. |
| Web sets | `/sets`, hamburger **Browse Sets**. Printing search; no movers. |
| Card details | Existing overlay / screen; row is the Printing id looked up in the catalog |
| Pipeline | Unchanged |
| Chart on movers landing | None; details already owns history |
