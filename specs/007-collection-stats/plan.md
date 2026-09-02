# Implementation Plan: Binder Collection Stats

**Branch**: `007-collection-stats` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-collection-stats/spec.md`

## Summary

The floating Binder-value total (mobile green chip, web `/binder` header total) becomes a **Collection Stats** button with that label only — no dollar figure on the button, and no running total left on the Binder screen. The button opens a **new page** for the currently open Binder. That page shows:

1. **Current total value** (chosen price source, quantity-weighted)
2. The existing Binder-value **snapshot** (TCG Market/Low, CardMarket Trend/Low, counts, unpriced gaps, top five by contribution)
3. **Top movers in this Binder** via the existing `fab_recent_movers` RPC with this Binder's Printing ids (percent rank, same floor/window as catalog-wide)

The Binder-value overlay (`BinderValueSheet` / `BinderValueDialog`) is **deleted**. The owned-cards movers section on mobile Home and web Trends is **deleted**; those landings become catalog-wide only. No Binder value-over-time. No new ranking function, no new price tables, no hamburger destination that bypasses Binder.

## Technical Context

**Language/Version**: Dart SDK ^3.12 (Flutter, `apps/mobile`) and JavaScript ES modules + React 19 (`apps/web`)

**Primary Dependencies**: Existing `buildBinderValueSnapshot` / `binderValueSnapshot.js` (`packages/contracts/binder_value_snapshot.json`). Existing `fab_recent_movers` RPC + `ownedPrintingIds` / `recentMovers` helpers (`packages/contracts/recent_movers.json`). Existing `MoverBox` / `RecentMoversSection` chrome (catalog-wide path only after this change). Existing Binder list + `openBinderId`. Existing card details. No new chart library. No new price source. No new SQL function.

**Storage**: Device Binder (mobile) and existing `binder_entries` + in-memory catalog (web). Public `fab_recent_movers(p_source, p_card_ids)` already exists — Collection Stats passes **this Binder's** ids. Snapshot math is in-memory. No new tables, no Binder-value history, no movers persisted on device.

**Testing**: `cd apps/web && npm test`; `cd apps/mobile && flutter test`. Reuse snapshot and recent-movers goldens. New widget/page tests for the Collection Stats button (label only, hidden when empty / Want List), page open/back, per-Binder movers (ids from this Binder only; copies joined from qty), modal/sheet gone, Home/Trends catalog-wide only. Do not add a third ranking fixture.

**Target Platform**: FAB Trades mobile Binder tab (pushed screen, not a fifth tab) and web `/binder/stats` (not in the hamburger; reached only from `/binder`). Shared Binder `/b/:token` and Want List out of scope.

**Project Type**: Dual-client product feature. Shared *fixtures and vocabulary*, two native pages, one existing public ranking function.

**Performance Goals**: Collection Stats headline and snapshot visible within 5 seconds from Binder + catalog already in memory (SC-001). Movers fetch is a sibling RPC (≤ 20 rows) and MUST NOT block the snapshot. Empty/error movers leave the rest of the page usable (SC-013).

**Constraints**: Signed-out inspect where the Binder already exists (mobile). Web keeps today's `/binder` account rule; do not invent a signed-out web Binder. Unpriced never `$0.00` / `€0.00`. No condition-adjusted prices. No currency conversion. No account gate added. No Pro gate. Pipeline unchanged. Do not show a Binder total on the Collection Stats **button**. Do not keep the overlay as a second surface. Do not keep owned movers on Home/Trends.

**Scale/Scope**: One new page per client. Delete overlay + owned-landing section. Reuse snapshot helper and movers RPC. Free Binder cap 50 distinct cards; Pro still a short `IN` list.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / constraint | Status | How this plan complies |
| --- | --- | --- |
| I. Good Enough Ships | Pass | Reuse snapshot + existing RPC. Delete overlay and owned Home/Trends section. No value-history table, no second ranker, no hamburger Collection destination. |
| II. Code That Reveals Intent | Pass | Headline is current total from chosen source. Snapshot field totals stay observed Market/Low/Trend. Binder movers are `p_card_ids` of **this** Binder, not all Binders. `ownedPrintingIds` still means “qty > 0, not Want List”; callers pass the filtered Binder list. |
| III. Fail Fast, Never Silent | Pass | Bad `p_source` errors. Null Low ineligible. Unpriced is `—`. Fetch error is retry on movers only. Empty Binder hides the button instead of a lying page. |
| IV. Honest Tests, Shared Contracts | Pass | Keep `binder_value_snapshot.json` and `recent_movers.json`. No new goldens unless a rule actually diverges (it does not). Tests assert this-Binder ids and copies-on-row, not a mock that returns the ranking. |
| V. Reproducible Ingest | Pass | Pipeline and `fab_recent_movers` schema unchanged. Apps only SELECT / RPC-read. |
| Table is the deadline | Pass | Stats is one tap from Binder and one back. Trade tab/`/` untouched. |
| No gate before value | Pass | No new sign-in wall. Web does not invent a signed-out Binder. |
| One brand, two peer surfaces | Pass | Same numbers, label **Collection Stats**, same mover meaning. Native chrome: mobile pushed screen vs web `/binder/stats`. |
| Speak the trader's language | Pass | Binder tab stays Binder. Collection Stats is the button/page label. Printing, Want List is not a Binder, recent movers not weekly. |
| Real prices or nothing | Pass | Observed catalog fields; floor; no interpolate; no value trend invented from gaps. |
| Local reads, background sync | Pass | Snapshot from Binder + catalog already on device. Movers fetch is sibling and non-blocking. |
| Server-owned Pro | Pass | No entitlement reads required; no writes. |
| Dual-client DRY | Pass | Shared fixtures + one SQL ranker. Scan, Want List, shared Binder not forced onto web. |

No unjustified violations. Complexity Tracking left empty.

### Post-design re-check

Phase 1 adds a page UI contract, an entry-point contract, and a Binder-movers read contract that **calls the existing RPC** with a filtered id list and joins quantity for display. It does not add ingest, a value-history table, a fifth tab, a hamburger Collection item, or a new ranker. Gates still pass. If SQL ranking and `recent_movers.json` disagree, fix SQL (or the product rule in the fixture **and** both helpers) — not a Collection-Stats-only fork.

## Project Structure

### Documentation (this feature)

```text
specs/007-collection-stats/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── entry-points.md
│   ├── collection-stats-page.md
│   └── binder-movers-read.md
└── tasks.md             # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
packages/contracts/
├── binder_value_snapshot.json         # UNCHANGED: snapshot math
├── recent_movers.json                 # UNCHANGED: ranking / floor / owned id rule
└── README.md                          # no new fixture

apps/web/
├── src/App.jsx                        # NEW route /binder/stats
├── src/pages/CollectionStats.jsx      # NEW: page for open Binder
├── src/pages/BinderCollection.jsx     # Collection Stats button; remove total + dialog
├── src/pages/Trends.jsx               # catalog-wide movers only (no owned ids)
├── src/components/movers/RecentMoversSection.jsx  # drop owned fetch/UI
├── src/components/binder/BinderValueDialog.jsx    # DELETE
└── tests/                             # CollectionStats, BinderCollection entry, Trends owned-gone

apps/mobile/
├── lib/features/binder/collection_stats_screen.dart  # NEW: pushed page
├── lib/features/binder/binder_screen.dart            # Collection Stats button; no chip/total
├── lib/features/binder/binder_value_sheet.dart       # DELETE
├── lib/features/search/recent_movers_section.dart    # catalog-wide only
├── lib/features/search/search_screen.dart            # stop passing all-Binder owned ids
├── lib/features/onboarding/tour_copy.dart            # Collection Stats copy
└── test/widgets/                                     # collection stats, Home owned-gone, sheet gone
```

**Structure Decision**: Dual-client feature. Snapshot and ranking stay where they are. Collection Stats is a real page (`features/binder/` on mobile, `pages/CollectionStats.jsx` on web). Home/Trends keep catalog-wide movers only. Overlay files are deleted, not wrapped. Pipeline and `fab_recent_movers` stay as they are.

## Complexity Tracking

> No constitution violations to justify.
