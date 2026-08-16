# Implementation Plan: Card Price History

**Branch**: `001-card-price-history` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-card-price-history/spec.md`

## Summary

Mobile already shows this Printing’s observed Low under the Prices box. This pass **ports that glance to web**: the existing card overlay (`CardDetailModal`), immediately under `CardDetailPrices`. Same catalog table (`fab_price_history`), same 30-day default, same one Low line for the selected marketplace. Pipeline and schema stay unchanged.

Web-specific product rules from clarification (2026-08-16): no upgrade CTA (free players stay on 30 days with no unlock prompt); inspect is hover (pointer) and tap (touch). Pro on web still gets the full-span control when older snapshots exist. Set browse charts and a new card route stay out of scope.

Because both clients now implement the same Low-series rules, `packages/contracts` becomes the source of truth (constitution IV). Mobile UI does not change except to assert that fixture.

## Technical Context

**Language/Version**: JavaScript (React 19, Vite 7) in `apps/web`. Mobile remains Dart SDK ^3.12.2; series math already ships there.

**Primary Dependencies**: Existing web stack (`@mui/material` ^7, `@supabase/supabase-js`, React). **No new chart library** — a small SVG line in the overlay (linear connectors, hover/tap inspect). Fetch through existing `fabDb.js` REST helper (same pattern as catalog reads). Entitlement via `useEntitlement().isPro` (read-only). Marketplace via existing `PriceContext.priceSource` (defaults to `tcgplayer`; no new picker).

**Storage**: Supabase Postgres `public.fab_price_history` (already exists; public SELECT). Web catalog snapshot does **not** include history; fetch live per Printing when the overlay opens. No client writes.

**Testing**: `npm test` in `apps/web` (Jest + Testing Library). New `packages/contracts/price_history_series.json` asserted by both `apps/web` and `apps/mobile`. Widget tests for overlay placement, states, no web CTA, Pro span control, inspect readout. Mobile `flutter test` stays green, including a new contract test that replaces duplicated series expectations.

**Target Platform**: Web (Netlify). Overlay is used on trade, binder, wants, and set browse. iOS/Android history remains the existing Flutter section.

**Project Type**: Dual-client product. This pass is **web UI + shared series fixture** on an existing public catalog table. Mobile chart already exists.

**Performance Goals**: Overlay Prices stay visible while history loads (SC-001/SC-002: direction and size of change readable within 5 seconds of the section appearing). Default 30-day view needs no zoom. One Printing’s rows (hundreds, not millions).

**Constraints**: No invented prices (null Low ≠ 0). Signed-out works as free. Overlay must not wait on history to draw today’s prices. Clients MUST NOT write entitlements. No in-browser paywall from this section. CardMarket history columns are currently always null (`ENABLE_CARDMARKET = false`) — selecting CardMarket shows empty, not a silent TCG substitute. Web `priceSource` currently has no UI toggle and defaults to TCGplayer; the chart still follows that value.

**Scale/Scope**: One new section in `CardDetailModal`. Shared fixture + JS series helper + `fabDb` read. No new routes, no set-row sparklines, no web billing.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / constraint | Status | How this plan complies |
| --- | --- | --- |
| I. Good Enough Ships | Pass | Port into the existing overlay. Reuse `fab_price_history`, `fabDb` REST, `isPro`, `priceSource`. No new page, RPC, cache, or chart package. |
| II. Code That Reveals Intent | Pass | Snapshot rows stay snapshots. A JS `priceHistorySeries` helper names observed Low vs derived delta vs window, matching the Dart helper. |
| III. Fail Fast, Never Silent | Pass | Fetch errors are retry under Prices, not a swallowed empty chart. Missing Low is a gap. CardMarket with no `cm_low` is empty, not a TCG fallback. |
| IV. Honest Tests, Shared Contracts | Pass | New `price_history_series.json`. Both suites assert the same cases. Widget tests use catalog-shaped printings and real snapshot lists, not a mock that returns the chart. |
| V. Reproducible Ingest | Pass | Pipeline unchanged. Apps only read. No backfill. |
| Table is the deadline | Pass | History sits under Prices in the overlay already used mid-trade. |
| No gate before value | Pass | Signed-out and free still see 30-day history and today’s prices. Web does not add a paywall in this section. |
| One brand, two peer surfaces | Pass | Same glance (under Prices), native inspect (hover/tap). Mobile CTA is not copied onto web. |
| Speak the trader's language | Pass | Printing, Prices, Low unchanged. |
| Real prices or nothing | Pass | Observed Low only; straight connectors; no $0. |
| Local reads, background sync | Pass | Prices stay on the catalog snapshot. History fetch is sibling and non-blocking. |
| Server-owned Pro | Pass | Read `useEntitlement().isPro` only. |
| Dual-client DRY | Pass | Shared *fixture and vocabulary*, not a fake shared runtime. Mobile-only paywall CTA is not forced onto web. |

No unjustified violations. Complexity Tracking left empty.

### Post-design re-check

Phase 1 adds a golden fixture and dual-surface UI/read contracts. It does not add schema, web billing, a new route, or a chart dependency. Gates still pass. Mobile `showProCta` stays a mobile UI rule and is intentionally **absent** from the shared fixture.

## Project Structure

### Documentation (this feature)

```text
specs/001-card-price-history/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── price-history-read.md
│   ├── price-history-series.md
│   └── history-section.md
```

### Source Code (repository root)

```text
packages/contracts/
├── price_history_series.json          # NEW: shared Low-series cases
└── README.md                          # list the new fixture

apps/web/
├── src/
│   ├── services/fabDb.js              # NEW: priceHistory(printingId) REST read
│   ├── utils/priceHistorySeries.js    # NEW: Low extract, clip, delta
│   └── components/cardDetail/
│       ├── CardDetailModal.jsx        # insert section under CardDetailPrices
│       └── PriceHistorySection.jsx    # NEW: SVG line + states + Pro span
├── tests/
│   ├── contracts/priceHistorySeries.contract.test.js
│   ├── utils/priceHistorySeries.test.js
│   ├── services/fabDb.priceHistory.test.js
│   └── components/PriceHistorySection.test.jsx
└── package.json                       # unchanged dependencies

apps/mobile/                           # already shipped; this pass only
├── lib/core/logic/price_history_series.dart
└── test/contracts/price_history_series_contract_test.dart  # NEW: assert fixture

supabase/migrations/…create_fab_card_tables.sql  # existing table; no new migration
services/price-pipeline/                         # unchanged
```

**Structure Decision**: Web history is a sibling of `CardDetailPrices` inside the existing overlay, not a route. Series math is a pure module so Jest does not need SVG. The golden fixture lives in `packages/contracts` because both runtimes now implement the rule. Mobile chart code stays; only a contract test is added there.

## Complexity Tracking

> No constitution violations to justify.
