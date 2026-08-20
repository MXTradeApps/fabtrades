# Implementation Plan: Binder Value Detail

**Branch**: `003-binder-value-detail` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-binder-value-detail/spec.md`

## Summary

The Binder total (mobile’s green chip, web’s `/binder` header total) becomes an inspect control. It opens a native overlay with the same headline number plus quantity-weighted **TCGplayer Market/Low** (USD) and **CardMarket Trend/Low** (EUR), stock counts, unpriced gaps, and up to five Printings by contribution. Math is a pure snapshot helper on each client, held to `packages/contracts/binder_value_snapshot.json`. No new routes, tables, or fetches. Chip/header formulas stay as they are; unpriced catalog fields never render as zero in the breakdown.

## Technical Context

**Language/Version**: Dart SDK ^3.12 (Flutter, `apps/mobile`) and JavaScript ES modules + React 19 (`apps/web`)

**Primary Dependencies**: Existing Flutter Material (`showModalBottomSheet`) and MUI 7 `Dialog`. Existing `Pricing` / catalog card objects. No new chart, routing, or pricing library.

**Storage**: Device Binder (mobile) and existing `binder_entries` + in-memory catalog (web). No new tables. Overlay is read-only.

**Testing**: `cd apps/mobile && flutter test`; `cd apps/web && npm test`. New golden fixture asserted by both. Widget/component tests for open/dismiss and Want List non-entry. Snapshot unit tests use catalog-shaped printings, not mocks that return the totals.

**Target Platform**: FAB Trades mobile (iOS/Android) and web Binder. Shared Binder and Want List out of scope.

**Project Type**: Dual-client product feature. Shared *fixture and vocabulary*, two native UIs.

**Performance Goals**: Overlay contents visible within 5 seconds of activation (SC-003) from data already on the Binder screen. Opening MUST NOT wait on a network round-trip. Binders are tens to low thousands of rows; one O(n log n) snapshot is enough.

**Constraints**: Signed-out inspect where the Binder already exists (mobile). Unpriced never `$0.00` / `€0.00`. No condition-adjusted prices. No currency conversion. No account gate added. Do not change how the Binder total control is *calculated*—only that it opens this overlay. Pipeline unchanged.

**Scale/Scope**: One helper + one overlay per client. Two entry points (mobile Binder tab chip, web `/binder` total). Free Binder cap 50 distinct cards; Pro unlimited — both fine.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / constraint | Status | How this plan complies |
| --- | --- | --- |
| I. Good Enough Ships | Pass | Pure snapshot + existing sheet/dialog. No portfolio page, chart, or Settings picker. Top five, not a resorted Binder. |
| II. Code That Reveals Intent | Pass | Field totals are observed catalog fields. Headline is the existing Binder total, not a renamed Market. `MoneyTotal.amount` null vs chip `?? 0` stay distinct. |
| III. Fail Fast, Never Silent | Pass | Unpriced is `—` plus copy counts. No silent TCG↔CM fallback. Empty Binder hides the control instead of an empty lying modal. |
| IV. Honest Tests, Shared Contracts | Pass | New `binder_value_snapshot.json`. Both suites assert it. Fixtures are catalog-shaped Binder rows. |
| V. Reproducible Ingest | Pass | Pipeline and schema unchanged. Apps only read prices already on the Printing. |
| Table is the deadline | Pass | Overlay on the Binder; dismiss restores the list. |
| No gate before value | Pass | No new sign-in wall. Web keeps today’s Binder page account rule; does not invent a signed-out web Binder. |
| One brand, two peer surfaces | Pass | Same numbers and labels; mobile sheet vs web dialog. |
| Vocabulary | Pass | Binder, Printing, TCGplayer, CardMarket, Market, Low, Trend. |
| Real prices or nothing | Pass | Observed fields; 0/null unpriced. |
| Local reads | Pass | Snapshot from Binder + catalog already in memory. |
| Dual-client DRY | Pass | Shared fixture, not a fake shared runtime. Want List / shared Binder / scan not forced for symmetry. |
| Server-owned Pro | Pass | No entitlement writes. |

No unjustified violations. Complexity Tracking left empty.

### Post-design re-check

Phase 1 adds a derived snapshot, overlay UI contracts, and a dual-client fixture path. It does not add schema, a third headline formula, currency conversion, or a Want List/shared-Binder port. Gates still pass. Web header remaining TCG-Market-only (`headline: "tcgMarketOnly"`) is an existing chip rule, documented rather than papered over.

## Project Structure

### Documentation (this feature)

```text
specs/003-binder-value-detail/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── binder-value-snapshot.md
│   ├── binder-value-modal.md
│   └── entry-points.md
└── tasks.md             # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
packages/contracts/
├── binder_value_snapshot.json          # NEW: golden snapshot cases
└── README.md                           # add the fixture to the table

apps/mobile/lib/
├── core/logic/binder_value_snapshot.dart   # NEW
├── features/binder/binder_screen.dart      # chip onTap
└── features/binder/binder_value_sheet.dart # NEW: bottom sheet UI

apps/mobile/test/
├── contracts/binder_value_snapshot_contract_test.dart
└── widgets/binder_value_sheet_test.dart

apps/web/src/
├── utils/binderValueSnapshot.js            # NEW
├── pages/BinderCollection.jsx              # /binder total opens dialog
└── components/binder/BinderValueDialog.jsx # NEW

apps/web/tests/
├── contracts/binderValueSnapshot.contract.test.js
└── components/BinderValueDialog.test.jsx
```

**Structure Decision**: Dual-client feature. Shared contract JSON under `packages/contracts`. Mobile keeps UI in `features/binder/` (sheet, not a new route). Web keeps UI next to Binder (`components/binder/`) and wires only `BinderCollection` when `isWanted === false`. Pipeline, card-detail Prices, and shared Binder pages stay untouched.

## Complexity Tracking

> No constitution violations to justify.
