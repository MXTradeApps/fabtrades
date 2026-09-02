# Implementation Plan: Recent Card Gainers and Losers

**Branch**: `005-card-gainers-losers` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-card-gainers-losers/spec.md`

## Summary

Players get **recent movers**: biggest gainers and losers of observed **Low**, ranked by percent change from a start snapshot 3–5 calendar days ago to the current catalog Low, with a $1 / €1 start-Low floor and at most 10 rows per side. When Binders have any owned Printings, an **owned** movers view sits first and catalog-wide lists sit below; empty Binders hide owned and show catalog-wide only.

Surfaces are native, not copies:

- **Mobile:** First tab is **Home** (was Browse). Home *is* the movers landing. Catalog search stays immediate. Set list stays on the same scroll below movers. Not a fifth tab.
- **Web:** No Home page or Home nav item. Hamburger **Trends** (`/trends`) is the movers landing (movers only). **Browse Sets** (`/sets`) stays the set catalog. Catalog-wide Printing search is on **both**. `/` stays the Trade Calculator (`pages/Home.jsx`).

Production ranker is a public SQL function over existing `fab_price_history` + `fab_card_prices` (no pipeline change). Both clients call it, share `packages/contracts/recent_movers.json`, and open existing card details from a row.

## Technical Context

**Language/Version**: Dart SDK ^3.12 (Flutter, `apps/mobile`) and JavaScript ES modules + React 19 (`apps/web`); Postgres via a new Supabase migration

**Primary Dependencies**: Existing Browse/Home UI (`BrowseScreen`), existing web header/drawer (`Header.jsx`), existing `/sets` `SetList.jsx`, existing catalog snapshot / `catalogProvider`, existing Binder entries (`binderProvider` / `binder.js`), existing card details overlay/screen, existing marketplace (`AppSettings.source` / `PriceContext.priceSource`). Web Printing search reuses `searchUtils.js` matching over the in-memory catalog. No new chart library. No new price source.

**Storage**: Existing `fab_price_history` and `fab_card_prices` (public SELECT). New `public.fab_recent_movers(p_source text, p_card_ids text[] default null)` RPC. Optional btree on `fab_price_history(captured_on)` in the same migration if the window filter would otherwise seq-scan history. Device Binder entries remain the source of owned ids. No client writes to catalog or entitlements. Movers are not stored in the catalog snapshot.

**Testing**: `cd apps/web && npm test`; `cd apps/mobile && flutter test`. Golden `recent_movers.json` asserted by both. Widget/page tests for mobile Home label, web Trends vs Browse Sets (no Home nav), owned-hide vs owned-empty, search covering movers on Trends and covering the set list on Browse Sets, row → details, marketplace rebuild. Smoke/integration copy that still says Browse on the mobile tab bar must expect Home.

**Target Platform**: FAB Trades mobile (iOS/Android) tab 0, web `/trends` (Netlify SPA), and web `/sets` (Printing search only; movers stay off this route). Web `/` trade calculator, Binder, Lend, Want List unchanged as destinations.

**Project Type**: Dual-client product feature. Shared *fixtures and vocabulary*, two native UIs, one public ranking function.

**Performance Goals**: Search and (mobile) set list paint without waiting on movers (SC-001: movers visible within 10s; FR-011: failure does not block the rest). RPC returns ≤ 20 rows. Owned id list is distinct Printings already in memory (free cap 50; Pro still a short `IN` list).

**Constraints**: No invented Lows. Signed-out catalog-wide. No Pro gate. No account wall. Invalid `p_source` fails; CardMarket with no `cm_low` is empty, not a TCG fallback. Window bounds are database `CURRENT_DATE`, not the device timezone. Do not invent signed-out web Binder. Pipeline unchanged. Web MUST NOT label any page or nav item Home. Web Trends MUST NOT embed the set catalog; Browse Sets MUST NOT embed movers.

**Scale/Scope**: One migration (RPC + optional date index). Mobile Home landing. Web Trends page + Browse Sets Printing search. Shared ranking fixture. No alerts, no extra time windows, no snapshot rebuild.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / constraint | Status | How this plan complies |
| --- | --- | --- |
| I. Good Enough Ships | Pass | One RPC over tables we already have. Reuse details, marketplace, catalog search matching. No movers table, no snapshot file, no alerts, no fifth tab, no web Home. |
| II. Code That Reveals Intent | Pass | Snapshot rows stay snapshots. Helper names start Low vs latest Low vs derived percent vs owned Printing ids. RPC `p_source` is marketplace, not a blended price. Web `Home.jsx` remains the trade calculator; Trends is a different page. |
| III. Fail Fast, Never Silent | Pass | Bad `p_source` errors. Null Low is ineligible, never `$0`. CardMarket empty ≠ TCG. Fetch error is retry, not a fake list. |
| IV. Honest Tests, Shared Contracts | Pass | `recent_movers.json`. Both suites assert eligibility, floor, 0%, ties, owned ids. Widget tests use catalog-shaped rows, not a mock that returns the ranking. |
| V. Reproducible Ingest | Pass | Pipeline unchanged. Apps only SELECT / RPC-read. |
| Table is the deadline | Pass | Short lists on the movers landing; search still immediate; trade tab/`/` untouched. |
| No gate before value | Pass | Signed-out catalog-wide. No Pro. Owned uses on-device Binders (mobile) or signed-in web Binder rows. |
| One brand, two peer surfaces | Pass | Same ranking and gainer/loser meaning. Native chrome: mobile Home (movers + sets on one scroll) vs web Trends + Browse Sets. |
| Speak the trader's language | Pass | Printing, Binder, Collection as Binder *name*, Want List is not owned, **recent movers** not weekly, web destination **Trends**. |
| Real prices or nothing | Pass | Observed Low only; floor; no interpolate; credit catalog Lows. |
| Local reads, background sync | Pass | Search/sets from catalog already on device. Movers fetch is sibling and non-blocking. Owned ids from local Binder state. |
| Server-owned Pro | Pass | No entitlement reads required; no writes. |
| Dual-client DRY | Pass | Shared fixture + one SQL ranker. Mobile-only scan stays off web. Signed-out web Binder is not invented. Web is not forced to grow a Home tab. |

No unjustified violations. Complexity Tracking left empty.

### Post-design re-check

Phase 1 adds an RPC contract, a ranking fixture, a movers-landing UI contract, and a web destination contract (Trends vs Browse Sets). It does not add ingest, entitlements, a fifth tab, a web Home, or a movers table. Gates still pass. SQL ranking must match the fixture; if they disagree, fix SQL (or the product rule in the fixture **and** both helpers).

## Project Structure

### Documentation (this feature)

```text
specs/005-card-gainers-losers/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── recent-movers.md
│   ├── recent-movers-read.md
│   ├── home-entry.md
│   └── web-destinations.md
└── tasks.md             # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
packages/contracts/
├── recent_movers.json                 # NEW: eligibility, percent, floor, ties, owned ids
└── README.md                          # list the new fixture

supabase/migrations/
└── YYYYMMDDHHMMSS_fab_recent_movers.sql   # fab_recent_movers(p_source, p_card_ids)
                                           # optional captured_on index

apps/web/
├── src/App.jsx                        # NEW route /trends
├── src/pages/Trends.jsx               # NEW: movers landing + catalog Printing search
├── src/pages/SetList.jsx              # Browse Sets: Printing search covers set list; no movers
├── src/pages/Home.jsx                 # UNCHANGED: Trade Calculator at /
├── src/services/fabDb.js              # NEW: recentMovers(source, cardIds?) RPC POST
├── src/utils/recentMovers.js          # NEW: fixture math + ownedPrintingIds
├── src/components/movers/             # NEW: RecentMoversSection + rows (Trends only)
├── src/components/elements/Header.jsx # Trends + Browse Sets; no Home item
└── tests/                             # contract, fabDb, Trends, SetList, Header

apps/mobile/
├── lib/core/data/card_repository.dart # NEW: recentMovers(source, {cardIds})
├── lib/core/logic/recent_movers.dart  # NEW: fixture math + ownedPrintingIds
├── lib/features/search/search_screen.dart  # Home title; movers above set list
├── lib/app/app.dart                   # tab label Home
└── test/contracts/ + widgets/ + smoke/integration Browse → Home
```

**Structure Decision**: Dual-client feature. Ranking for production is Postgres; JS/Dart helpers exist so the fixture can fail a build. Mobile keeps `BrowseScreen` in `features/search/` (behavior change, not a new tab module). Web movers live on `/trends` (`Trends.jsx`), not on `/sets` and not on `pages/Home.jsx` (trade calculator). Browse Sets stays `/sets` and gains catalog Printing search only. Pipeline and `fab_price_history` schema stay as they are.

## Complexity Tracking

> No constitution violations to justify.
