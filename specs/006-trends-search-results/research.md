# Research: Trends Search Results as Mover Boxes

## Decision: New lookup RPC; do not overload `fab_recent_movers`

**Rationale**: Ranked movers (`fab_recent_movers`) returns at most 10 gainers and 10 losers, applies `start_low >= 1`, and drops 0% and outlier rows from the payload. Spec 006 requires (1) every catalog name match as a box, (2) honest change **including** under-floor cards, (3) omit the change line when there is no honest move. Passing search ids into the ranker would still cut to 20 rows and hide cheap-card moves.

A second `SECURITY INVOKER` SQL function `fab_printing_recent_changes(p_source text, p_card_ids text[])` reads the same public tables, uses the same 3–5 day start window and latest `fab_card_prices` Low, and returns **one optional change row per requested id**. `GRANT EXECUTE` to `anon` and `authenticated`. Pipeline stays read-only. The `captured_on` btree from 005 is reused; no new table.

`p_card_ids` is required. `NULL` is an error (fail fast) so a client cannot accidentally scan the whole catalog without a ranker. Empty array → `[]`. Unknown ids are skipped.

**Alternatives considered**:

- Call `fab_recent_movers(source, searchIds)` — fails under-floor, top-10, and “show the card anyway” rules.
- Add flags to `fab_recent_movers` (`p_apply_floor`, `p_limit`) — one function with two product meanings; constitution II (one job) and I (no gold-plated mode matrix).
- Client-side rank over `fab_price_history` for 200 ids — extra round-trip shape vs one RPC; web would add a hot path next to the snapshot (005 already rejected this for the landing).
- Per-Printing `priceHistory()` for each match — wasteful round-trips.

## Decision: Paint catalog boxes first; merge change rows by Printing id

**Rationale**: Constitution: local reads. Search identity and current Low already live in the catalog snapshot / `catalogProvider`. FR-013 / SC-009: lookup failure must not hide matches. Flow:

1. Existing matching (`matchPrintings` / `filterCards`) over in-memory catalog, existing result cap (~200) and existing Home sort.
2. Render mover-style boxes immediately (identity + current Low or unpriced).
3. Debounced POST of those ids to `fab_printing_recent_changes`.
4. Merge by `card_id`. Hit → show percent and currency, colored up/down. Miss → leave the change line off.
5. Abort in-flight / ignore stale on query change, marketplace change, or unmount.

Debounce (~300ms, same family as existing set-search debounce) so typing does not fire a RPC per key. Empty query does not call the lookup (ranked movers stay on `fab_recent_movers`).

**Alternatives considered**:

- Wait to paint until the lookup returns — blocks search on network; fails SC-009 and “search does not wait on movers.”
- Embed change in the catalog snapshot — snapshot has no history (001/005 research); would rebuild nightly for search-only data.
- Lookup on every keystroke with no debounce — noisy and easy to stampede.

## Decision: Change payload omits non-displayable moves; search still lists the Printing

**Rationale**: Clarifications 2026-08-26: under-floor **shows** the move; no honest move **omits the change line** (not 0%, not a dash, not “No recent move”). The RPC therefore returns a row only when figures are displayable:

| Situation | Search box | RPC row |
| --- | --- | --- |
| Start + latest, percent ≠ 0, not outlier, any start Low (including under $1 / €1) | Identity, current Low, percent + amount | Yes |
| Missing 3–5 day start, unpriced latest, 0% change, outlier cap | Identity + current Low / unpriced; no change line | No |
| Name does not match | Not shown | Not requested |

Outlier cap stays the 005 numbers (start or latest Low above 10000, or absolute percent greater than 10). Those are catalog errors, not real trends.

Sealed products: ranked movers exclude them. Search already decides membership via catalog matching. The lookup does **not** extra-filter sealed; if a match has an honest Low change, show it.

**Alternatives considered**: Return every requested id with nullable percent — clients would have to hide 0% vs null vs outlier with extra flags. Omitting the row is the same signal as “no change line.” Applying the ranked floor here — contradicts clarification A.

## Decision: Shared fixture for lookup math, separate from ranking

**Rationale**: Constitution IV. Web and mobile must agree on under-floor inclusion and omit rules. Ranking fixture `recent_movers.json` must keep the $1 floor and top-10 so 005 tests stay honest. New `packages/contracts/printing_recent_changes.json` covers lookup cases. JS and Dart helpers (extend `recentMovers.js` / `recent_movers.dart`) assert it. SQL is specified to emit the same rows.

Identity, thumbnails, currency formatting, and box chrome stay out of the fixture (same split as 005).

**Alternatives considered**: Add lookup cases into `recent_movers.json` — mixes two product rules in one expected list and would break ranking tests that require the floor. Lookup only in SQL — JS/Dart could not fail a build on drift.

## Decision: Reuse mover-box chrome; do not share the Browse Sets list

**Rationale**: Spec FR-001 / FR-009. Web `CatalogPrintingResults` is a name-and-price list used by Trends **and** Browse Sets today. Changing it in place would put trend boxes on Browse Sets (out of scope). Trends search uses the ranked-mover box (extract a presentational box from `RecentMoversSection` so ranked lists and search share chrome). `SetList.jsx` keeps `CatalogPrintingResults`.

Mobile Home global search (`_GlobalSearchResults` → `_PrintingList`) switches to the same box used by `RecentMoversSection`. `SetCardsScreen` (in-set) stays a list (FR-010). Home’s existing `CardSearchBar` sort stays (clarification B). Web Trends does not add a sort control.

Selecting a box still `openDetail` / `CardDetailScreen` with the **catalog** Printing (id lookup), not a synthesized RPC-only card (005 rule).

**Alternatives considered**: One `variant` prop on `CatalogPrintingResults` — easy to leak boxes onto `/sets`. Duplicate box markup in Trends search — third copy of chrome. Sparkline in the box — out of scope; details already owns history.

## Decision: Marketplace, window, and catalog credit stay 005’s

**Rationale**: FR-003 / FR-012 / FR-015. Same `p_source` (`tcgplayer` \| `cardmarket`), same `CURRENT_DATE` window, same Low columns, same “observed catalog Lows” meaning. Invalid source errors. CardMarket with no `cm_low` for a match → no change row, not a TCG fallback. Switching marketplace drops stale change rows.

**Alternatives considered**: Compute the window on the device — 005 already rejected (timezone shuffle). Mixing Market/Mid into search boxes — forbidden.

## Decision: No Pro gate, no pipeline change, no ranked-list edits

**Rationale**: Search and observed Lows are catalog data. Do not change `fab_recent_movers` eligibility, floor, or list length. Alerts and sparklines stay out.

**Alternatives considered**: Filter Trends search to Printings that appear on ranked lists — fails “named card still shows.” Client-written cache of changes — extra persistence for a public read.

## Open facts (resolved, not NEEDS CLARIFICATION)

| Topic | Resolution |
| --- | --- |
| Ranked RPC | Unchanged. Not used for search results |
| Lookup RPC | `fab_printing_recent_changes(p_source, p_card_ids)`; ids required |
| Floor | Ranked lists only. Search change rows include start Low &lt; 1.00 |
| 0% / missing / outlier | No RPC row; box omits change line |
| Result cap | Existing catalog search matching (~200); pass those ids only |
| Paint order | Catalog boxes first; merge changes; debounce lookup |
| Web Browse Sets | List (`CatalogPrintingResults`) |
| Mobile in-set | List (`SetCardsScreen`) |
| Sort | Home keeps existing catalog sort; Trends adds none; no percent sort |
| Details | Existing overlay/screen; catalog Printing id |
| Pipeline | Unchanged |
