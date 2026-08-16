# Implementation Plan: Card Price History

**Branch**: `001-card-price-history` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-card-price-history/spec.md`

## Summary

Show this Printing’s observed Low over time on the mobile card details page, immediately under the existing Prices box. The catalog already stores daily snapshots in `fab_price_history` and mobile already fetches them (`CardRepository.priceHistory`); this work is the chart, the 30-day / Pro full-span window, honest empty/error states, and a quiet Pro upgrade line — not a new ingest or a new screen.

Everyone (including signed-out) defaults to the last 30 calendar days of Low for the selected marketplace. Free players cannot extend that window; when older snapshots exist they get “See full history with Pro,” which opens the existing paywall. Pro can switch to the full recorded span. One line only. Unpriced days are gaps, never $0.

## Technical Context

**Language/Version**: Dart SDK ^3.12.2 (Flutter mobile app `apps/mobile`, version 1.0.2+9)

**Primary Dependencies**: Flutter, flutter_riverpod ^3.3.2, supabase_flutter ^2.15.4, intl ^0.20.3, **fl_chart ^1.2.0** (new — LineChart + LineTouchData for tap/hold inspect). Existing RevenueCat paywall (`presentProPaywall`). No pipeline or schema change.

**Storage**: Supabase Postgres `public.fab_price_history` (already exists; public SELECT). Current prices remain on the in-memory / SharedPreferences catalog (`fab_cards_with_prices`). History is fetched live per Printing; not written to the catalog cache.

**Testing**: `flutter test` in `apps/mobile` (CI: `.github/workflows/ci.yml`). Unit tests for Low extraction, 30-day clip, change summary, and CTA/span visibility. Widget tests for placement under Prices, empty/error, and Pro vs free chrome. No `packages/contracts` fixture (web is out of scope).

**Target Platform**: iOS and Android via the existing Flutter app. Web is out of scope (no card-details Prices box).

**Project Type**: Dual-client product; this feature is **mobile-only** UI on an existing public catalog table.

**Performance Goals**: History section appears without blocking today’s Prices (SC-001/SC-002: direction and size of change readable within 5 seconds of the section appearing). Chart stays glanceable on the default 30-day view (no pinch-zoom required).

**Constraints**: No invented prices (null Low ≠ 0). Signed-out works as free. Page must not wait on the network to draw catalog data already on device. Clients MUST NOT write entitlements. CardMarket history columns are currently always null (`ENABLE_CARDMARKET = false`) — selecting CardMarket shows the empty state, not a silent TCG substitute.

**Scale/Scope**: One new section on one screen (`CardDetailScreen`). One printing’s daily rows (hundreds over years, not millions). Catalog-wide ingest already runs nightly; this feature only reads.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / constraint | Status | How this plan complies |
| --- | --- | --- |
| I. Good Enough Ships | Pass | Reuse `fab_price_history`, `priceHistory()`, `isProProvider`, and `presentProPaywall`. Add one chart library. No new tables, RPCs, caches, or web surface. |
| II. Code That Reveals Intent | Pass | `PricePoint` stays the snapshot; a dedicated Low-series helper names observed Low vs derived change vs UI window. Printing key is `card.id`. |
| III. Fail Fast, Never Silent | Pass | Fetch errors surface as retry under Prices, not a swallowed empty chart. Missing Low is a gap. CardMarket with no `cm_low` history is empty, not a TCG fallback. |
| IV. Honest Tests, Shared Contracts | Pass | Logic tests use real `PricePoint` shapes. No mock that returns the chart the test wanted. No contracts JSON: the 30-day window is mobile-only (web has no card details). |
| V. Reproducible Ingest | Pass | Pipeline unchanged. Apps still only read the catalog. No backfill of dates before ingest began. |
| Table is the deadline | Pass | Default 30-day line + numeric change sits under Prices; no extra navigation. |
| No gate before value | Pass | Signed-out and free still see recent history and today’s prices. |
| Speak the trader's language | Pass | Printing, Prices, Low, Binder-adjacent actions unchanged. |
| Real prices or nothing | Pass | Observed Low only; straight connectors between observed spots; no $0. |
| Local reads, background sync | Pass | Prices box keeps using cached catalog. History fetch is sibling and non-blocking. |
| Server-owned Pro | Pass | Read `isProProvider` only; upgrade uses existing paywall. |
| Dual-client DRY | Pass | Mobile-only UI is not forced onto web “for symmetry.” |

No unjustified violations. Complexity Tracking left empty.

### Post-design re-check

Phase 1 (data-model, contracts, quickstart) does not add schema, a second client, a shared contracts fixture, or a blocking `ProGate` around the chart. Gates still pass.

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
│   └── history-section.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/mobile/
├── lib/
│   ├── core/
│   │   ├── data/card_repository.dart          # existing priceHistory()
│   │   ├── logic/pricing.dart                 # marketplace Low formatter
│   │   ├── logic/price_history_series.dart    # NEW: Low extract, clip, delta
│   │   ├── models/card_model.dart             # PricePoint
│   │   ├── models/app_settings.dart           # PriceSource
│   │   └── providers.dart                     # NEW: priceHistoryProvider family
│   └── features/
│       ├── card_detail/
│       │   ├── card_detail_screen.dart        # insert section under _PriceCard
│       │   └── price_history_section.dart     # NEW: chart + states + chrome
│       └── paywall/pro_paywall.dart           # presentProPaywall (reuse)
├── test/
│   ├── core/logic/price_history_series_test.dart
│   └── widgets/price_history_section_test.dart
└── pubspec.yaml                               # add fl_chart

supabase/migrations/20260714131523_create_fab_card_tables.sql  # existing table; no new migration
services/price-pipeline/                                       # unchanged
apps/web/                                                      # out of scope
```

**Structure Decision**: Feature lives in the existing Flutter app next to card details. Series math is a small `core/logic` module so tests do not need a widget. The chart widget is a sibling of `_PriceCard`, not a new route. Catalog ingest and web stay untouched.

## Complexity Tracking

> No constitution violations to justify.
