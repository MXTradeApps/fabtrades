# Implementation Plan: Trends Search Results as Mover Boxes

**Branch**: `006-trends-search-results` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-trends-search-results/spec.md`

## Summary

On the **movers landing** (web **Trends**, mobile **Home**), catalog search results become the same **trend boxes** used for ranked recent movers: Printing identity, current Low, and that Printing’s own 3–5 day Low change when it can be computed honestly. Search stays name-match order (Home keeps its existing sort; Trends does not gain one). Browse Sets and in-set search stay lists.

Ranked `fab_recent_movers` cannot serve this: it applies the $1 / €1 floor, cuts to 10 per side, and drops 0% / outliers from the payload. Search needs **every name match** as a box, with change figures **including under-floor cards**, and with the change line **omitted** (not 0%) when there is no honest move.

Production lookup is a new public SQL function `fab_printing_recent_changes(p_source, p_card_ids)` over the same history + prices tables. Clients match Printings in memory first, paint boxes from the catalog, then merge change rows by Printing id. Shared fixture `packages/contracts/printing_recent_changes.json`. Pipeline unchanged.

## Technical Context

**Language/Version**: Dart SDK ^3.12 (Flutter, `apps/mobile`) and JavaScript ES modules + React 19 (`apps/web`); Postgres via a new Supabase migration

**Primary Dependencies**: Existing movers landing (`Trends.jsx`, `RecentMoversSection`, mobile `search_screen.dart` / `recent_movers_section.dart`), existing catalog matching (`searchUtils.js` / `filterCards`), existing mover-box chrome, existing marketplace (`priceSource` / `AppSettings.source`), existing card details. No new chart library. No new price source.

**Storage**: Existing `fab_price_history` and `fab_card_prices` (public SELECT). New `public.fab_printing_recent_changes(p_source text, p_card_ids text[])` RPC. Reuse the `captured_on` btree from 005. Device/web catalog snapshot remains the source of search identity and current Low. No client writes. Do not add changes to the catalog snapshot.

**Testing**: `cd apps/web && npm test`; `cd apps/mobile && flutter test`. Golden `printing_recent_changes.json` asserted by both (under-floor included; 0% / missing window / outliers omitted from change payload). Page/widget tests: Trends search → boxes with percent; Browse Sets search → still list; Home global search → boxes; in-set search → list; clear search restores ranked movers; cheap-card match still shows change; no-change omits the change line.

**Target Platform**: FAB Trades web `/trends` search body and mobile Home global search. Web `/sets` Printing search and mobile set-scoped search unchanged as lists.

**Project Type**: Dual-client product feature. Shared *fixtures and vocabulary*, two native UIs, one public lookup function.

**Performance Goals**: Matching boxes paint from in-memory catalog without waiting on the lookup (same as 005 search vs movers). Lookup is one RPC for the current result ids (existing match cap, ~200). Debounce typing; abort stale responses. Failure of change figures must not hide identity boxes (SC-009).

**Constraints**: No invented Lows. Signed-out catalog-wide search. No Pro gate. Invalid `p_source` fails. Window is database `CURRENT_DATE`. Ranked movers RPC, floor, and top-10 stay as 005 specified. Browse Sets MUST remain a list. Do not add percent-change sort. Do not fill empty change with 0%, a dash, or “No recent move.”

**Scale/Scope**: One migration (lookup RPC). Reuse mover-box presentation on two search surfaces. One shared fixture. No sparklines, no Browse Sets redesign, no ranked-list changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / constraint | Status | How this plan complies |
| --- | --- | --- |
| I. Good Enough Ships | Pass | One lookup RPC for the ids already on screen. Reuse matching, details, marketplace, mover-box chrome. Do not scan the whole catalog. Do not extend `fab_recent_movers` with mode flags. |
| II. Code That Reveals Intent | Pass | Lookup vs rank are different functions. Names distinguish observed start/latest Low from derived percent. Search results stay catalog Printings; change rows are optional overlays, not a second catalog. |
| III. Fail Fast, Never Silent | Pass | Bad `p_source` errors. Missing change is omitted, never `$0` / `0%`. Lookup error is retry on the figures, not fake trends and not a blank search. |
| IV. Honest Tests, Shared Contracts | Pass | `printing_recent_changes.json`. Both suites assert under-floor inclusion, 0% omit, outlier omit, TCG vs CM columns. Widget tests use catalog-shaped Printings plus fixture-shaped change rows. |
| V. Reproducible Ingest | Pass | Pipeline unchanged. Apps only SELECT / RPC-read. |
| Table is the deadline | Pass | Search still immediate; trade tab/`/` untouched. |
| No gate before value | Pass | Signed-out Trends/Home search. No Pro. |
| One brand, two peer surfaces | Pass | Same change meaning on web Trends and mobile Home. Native chrome. Browse Sets / in-set stay lists (not fake symmetry). |
| Speak the trader's language | Pass | Printing, Low, Trends, Home, Browse Sets. |
| Real prices or nothing | Pass | Observed Low only; no interpolate; under-floor still shows a real move; garbage outliers omit figures. |
| Local reads, background sync | Pass | Identity and current Low from catalog already on device. Change fetch is sibling and non-blocking. |
| Server-owned Pro | Pass | No entitlement reads or writes. |
| Dual-client DRY | Pass | Shared fixture + one SQL lookup. Do not force Browse Sets boxes onto web “for symmetry.” |

No unjustified violations. Complexity Tracking left empty.

### Post-design re-check

Phase 1 adds a lookup RPC contract, a change-display fixture, and a movers-landing search UI contract. It does not add ingest, entitlements, ranked-list changes, sparklines, or Browse Sets trend boxes. Gates still pass. SQL lookup must match the fixture; if they disagree, fix SQL (or the product rule in the fixture **and** both helpers).

## Project Structure

### Documentation (this feature)

```text
specs/006-trends-search-results/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── printing-recent-changes.md
│   ├── printing-recent-changes-read.md
│   └── movers-landing-search.md
└── tasks.md             # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
packages/contracts/
├── printing_recent_changes.json       # NEW: under-floor include, 0%/outlier/missing omit
└── README.md                          # list the new fixture

supabase/migrations/
└── YYYYMMDDHHMMSS_fab_printing_recent_changes.sql
    # fab_printing_recent_changes(p_source, p_card_ids)

apps/web/
├── src/pages/Trends.jsx               # search body: trend boxes, not CatalogPrintingResults list
├── src/pages/SetList.jsx              # UNCHANGED search presentation (list)
├── src/services/fabDb.js              # NEW: printingRecentChanges(source, cardIds) RPC POST
├── src/utils/recentMovers.js          # ADD: lookup helper matching the new fixture (no floor, no top-10)
├── src/components/movers/             # extract/reuse box used by ranked lists AND Trends search
├── src/components/search/CatalogPrintingResults.jsx  # Browse Sets only
└── tests/                             # contract, fabDb, Trends search boxes, SetList still list

apps/mobile/
├── lib/core/data/card_repository.dart # NEW: printingRecentChanges(source, cardIds)
├── lib/core/logic/recent_movers.dart  # ADD: same lookup helper as JS
├── lib/features/search/search_screen.dart  # Home global search → trend boxes; keep sort
├── lib/features/search/recent_movers_section.dart  # share box widget with search
└── test/contracts/ + widgets/ Home search boxes; in-set list unchanged
```

**Structure Decision**: Dual-client feature. Production change figures are Postgres lookup by Printing id; JS/Dart helpers exist so the fixture can fail a build. Web Trends search stops using the shared list component; Browse Sets keeps it. Mobile Home global search switches to the mover box; `SetCardsScreen` stays a list. Ranked `fab_recent_movers` is not modified.

## Complexity Tracking

> No constitution violations to justify.
