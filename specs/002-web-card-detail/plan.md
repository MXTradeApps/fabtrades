# Implementation Plan: Web Card Detail Modal

**Branch**: `002-web-card-detail` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-web-card-detail/spec.md`

## Summary

Bring mobile’s card-details glance to web as one overlay modal. Named catalog cards (and their thumbnails) open it without leaving the current page. The modal shows that **Printing**’s art (zoom inside the modal), identity, Versions, dual-marketplace **Prices**, Want List, Own quantity when signed in, and **Add to trade** only on the balancer — always onto **Want**. Successful adds stay in the modal with a Snackbar confirmation. Today’s art-only `CardImageModal` is removed from list surfaces.

No new routes, no pipeline change, no mobile change. Catalog already in memory (`CardDataProvider`); CardMarket fields are mapped through so the Prices group can render honestly as unpriced while ingest still writes nulls.

## Technical Context

**Language/Version**: JavaScript (ES modules) + React 19.1, Vite 7, `apps/web`

**Primary Dependencies**: React, react-router-dom 7.8, MUI 7 Dialog / Snackbar / Alert (existing). No new chart or routing library. Reuse `CardThumbnail`, nested art zoom, `useTradeState.addWantCard`, `binder.upsertEntry`, `SignInDialog`, `FreeLimits`.

**Storage**: Existing static catalog snapshot + `fab_cards_with_prices` (read). Binder/Want via existing `binder.js`. Live trade via existing `useTradeState` (in-memory on Home). No new tables.

**Testing**: Jest + Testing Library (`cd apps/web && npm test`). New unit tests for printings grouping and price display (null/0 → —). Component tests for modal chrome, balancer-only Add to trade, SearchOption name-vs-add split, and list name/thumb opening details.

**Target Platform**: FAB Trades web app (desktop + mobile browser). Mobile Flutter app out of scope.

**Project Type**: Web client feature on an existing dual-client product.

**Performance Goals**: Identity + Prices visible within 2 seconds of activation (SC-007). Catalog is already loaded; opening the modal MUST NOT wait on a new catalog fetch. Art may load asynchronously with a missing-art state.

**Constraints**: Signed-out inspect. Unpriced never `$0.00` / `€0.00`. Name/thumb MUST NOT add as a side effect. No shareable card URL in v1. No scan / lends / Trade Filler. Price history out of scope.

**Scale/Scope**: One modal mounted at app shell. Wire ~7 surfaces (trade piles, search, set detail, Binder, Want List, shared Binder, trade history). Catalog ~17k printings already in memory.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / constraint | Status | How this plan complies |
| --- | --- | --- |
| I. Good Enough Ships | Pass | One provider + one dialog. Reuse trade add, binder upsert, SignInDialog, Snackbar. Do not lift all of `useTradeState` to App. No SEO card route. |
| II. Code That Reveals Intent | Pass | Modal is about a Printing (`_uniqueId`). Prices are catalog fields, not derived appraisals. Add-to-Want is not “add to the pile you clicked.” |
| III. Fail Fast, Never Silent | Pass | Missing art/prices/errors are explicit. Failed Want add (auth, free cap) does not toast success. Null/0 Low is — not $0. |
| IV. Honest Tests, Shared Contracts | Pass | Tests use catalog-shaped fixtures. Free-tier still `free_limits.json`. No new dual-client fixture: printings grouping is web-local (mobile already has Dart `printingsForCard`; unifying name-stripping is a named follow-up, not a blocker). |
| V. Reproducible Ingest | Pass | Pipeline unchanged. Apps still only read the catalog. Mapping `cm_*` through is read-path honesty, not invented prices. |
| Table is the deadline | Pass | Overlay; dismiss restores piles. Search keeps a distinct add control. |
| No gate before value | Pass | Inspect signed out. |
| One brand, two peer surfaces | Pass | Web-native Dialog; same information architecture as mobile details. |
| Vocabulary | Pass | Printing, Prices, Binder, Want List. |
| Real prices or nothing | Pass | Observed catalog only. |
| Dual-client DRY | Pass | Do not port scan, lends, or Trade Filler. |
| Server-owned Pro | Pass | Want List ceiling uses existing free-limits + upgrade path; no client entitlement writes. |

No unjustified violations. Complexity Tracking left empty.

### Post-design re-check

Phase 1 does not add a second inspect overlay, a new backend, or a contracts fixture that would duplicate `free_limits.json`. Gates still pass.

## Project Structure

### Documentation (this feature)

```text
specs/002-web-card-detail/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── card-detail-modal.md
│   └── entry-points.md
└── tasks.md             # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
apps/web/src/
├── App.jsx                              # mount CardDetailProvider + modal
├── contexts/CardDetailContext.jsx       # NEW: open/close + optional Want add
├── components/cardDetail/
│   ├── CardDetailModal.jsx              # NEW: dialog chrome
│   └── CardDetailPrices.jsx             # NEW: TCG + CM groups, — for unpriced
├── utils/printingsForCard.js            # NEW: sibling Printings for Versions
├── services/fabDb.js                    # add cm_* columns to catalog select
├── hooks/useCardData.jsx                # map cm_* onto card objects
├── hooks/useTradeState.js               # unchanged; Home registers addWantCard
├── pages/Home.jsx                       # register addWantCard
├── pages/SetDetail.jsx                  # name/thumb → openDetail; drop list CardImageModal
├── pages/BinderCollection.jsx           # same
├── pages/SharedBinder.jsx               # same
├── pages/TradeHistory.jsx               # name/thumb → openDetail
├── components/ui/CardList.jsx           # name/thumb → openDetail
├── components/ui/CardImagePreview.jsx   # CardImageModal kept for in-modal zoom only
└── components/search/SearchOption.jsx   # name/thumb inspect; separate add control

apps/web/tests/
├── components/CardDetailModal.test.jsx
├── components/SearchOption.test.jsx
├── utils/printingsForCard.test.js
└── components/CardList.test.jsx         # update mocks / open-detail assertions
```

**Structure Decision**: Feature lives entirely in `apps/web`. One context at the router shell so every page shares the same modal. List surfaces only call `openDetail(printing)`. Trade mutation stays on Home via a registered callback. Mobile, pipeline, and `packages/contracts` stay untouched except existing free-limits already shared.

## Complexity Tracking

> No constitution violations to justify.
