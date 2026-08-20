---

description: "Task list for binder value detail overlay implementation"
---

# Tasks: Binder Value Detail

**Input**: Design documents from `/specs/003-binder-value-detail/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. [plan.md](./plan.md) requires `packages/contracts/binder_value_snapshot.json` asserted by both clients, plus widget/component tests for open/dismiss, Want List non-entry, and unpriced display (`—`, never `$0.00` / `€0.00`).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Shared math: `packages/contracts/binder_value_snapshot.json`
- Mobile: `apps/mobile/lib/features/binder/` and `apps/mobile/lib/core/logic/`
- Web: `apps/web/src/components/binder/`, `apps/web/src/utils/`, `apps/web/src/pages/BinderCollection.jsx`
- Tests: `apps/mobile/test/` and `apps/web/tests/`

## Constitution

Touches **I** (sheet/dialog, no portfolio page), **II** (headline vs field totals named apart), **III** (unpriced is `—`, no TCG↔CM fallback), **IV** (golden fixture both suites), **V** (read catalog only; no ingest change).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Golden cases so JS and Dart cannot invent different Binder math

- [X] T001 Create `packages/contracts/binder_value_snapshot.json` from [contracts/binder-value-snapshot.md](./contracts/binder-value-snapshot.md) (quantity weighting, foil CardMarket, null/`0` omitted, all-unpriced `amount` null, `tcgUnpricedCopies` / `cmUnpricedCopies`, top-five cap, contribution/name/id ties, `headline: "pricingValue"` and `headline: "tcgMarketOnly"` case groups, `tolerance` `1e-9`)
- [X] T002 Add `binder_value_snapshot.json` to the files table in `packages/contracts/README.md` (web `apps/web/src/utils/binderValueSnapshot.js`, mobile `apps/mobile/lib/core/logic/binder_value_snapshot.dart`; chrome such as sheet vs dialog is not in the fixture)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Snapshot helper on both clients. Overlay stories only display this object.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Write failing contract tests that load `binder_value_snapshot.json` via `apps/mobile/test/contracts/contract_fixtures.dart` in `apps/mobile/test/contracts/binder_value_snapshot_contract_test.dart`
- [X] T004 [P] Write failing contract tests that import `packages/contracts/binder_value_snapshot.json` in `apps/web/tests/contracts/binderValueSnapshot.contract.test.js`
- [X] T005 Implement `buildBinderValueSnapshot` (Binder rows only, qty &lt; 1 dropped, foil-aware CM Trend/Low, `MoneyTotal.amount` null when `pricedCopies === 0`, `sourceValue` per `headline` mode) in `apps/mobile/lib/core/logic/binder_value_snapshot.dart` until T003 passes — map from `BinderEntry` + `CardModel` + `PriceSource`
- [X] T006 [P] Implement `buildBinderValueSnapshot` with the same rules in `apps/web/src/utils/binderValueSnapshot.js` until T004 passes — map from `/binder` entries + live catalog fields (`marketPrice` / `lowPrice` / `cardmarketTrend` / foil variants); default `headline: "tcgMarketOnly"`

**Checkpoint**: Foundation ready — `flutter test` and `npm test` both pass the new fixture; no UI yet

---

## Phase 3: User Story 1 - Open Binder value from the green total (Priority: P1) 🎯 MVP

**Goal**: Activating the Binder total opens one overlay with the same headline number; dismiss restores the Binder; empty Binder and Want List have no entry

**Independent Test**: Non-empty Binder → activate the green chip (mobile) or `/binder` header total (web) → overlay appears, headline matches the control, dismiss leaves list/tab/qty unchanged. Empty Binder: no control. Want List tab / `/wants`: no this overlay.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T007 [P] [US1] Widget tests in `apps/mobile/test/widgets/binder_value_sheet_test.dart`: non-empty Binder tab chip opens one sheet; headline matches the chip; dismiss (barrier) leaves entries; empty Binder hides the chip; Want List tab has no chip
- [X] T008 [P] [US1] Component tests in `apps/web/tests/components/BinderValueDialog.test.jsx`: `/binder` total opens one dialog; headline matches the header total; dismiss (close/backdrop/Escape) leaves entries; `isWanted` / `/wants` total is not this control

### Implementation for User Story 1

- [X] T009 [P] [US1] Implement scrollable `showModalBottomSheet` chrome (title **Binder value**, headline string, source label from Settings, close/drag dismiss, no Binder mutations) in `apps/mobile/lib/features/binder/binder_value_sheet.dart`
- [X] T010 [P] [US1] Implement MUI `Dialog` chrome (title **Binder value**, headline string, TCGplayer source label, close/backdrop/Escape, no Binder mutations) in `apps/web/src/components/binder/BinderValueDialog.jsx`
- [X] T011 [US1] Make `_BinderValueChip` a button (`InkWell` / semantics) and open `binder_value_sheet.dart` from `apps/mobile/lib/features/binder/binder_screen.dart` (Binder tab only, non-empty; pass the same formatted `pricing.formatValue(binderTotal)` already shown; do not change the chip formula)
- [X] T012 [US1] Make the `/binder` header total (`formatCurrency(totalValue…)`) a button and open `BinderValueDialog.jsx` only when `isWanted === false` in `apps/web/src/pages/BinderCollection.jsx` (do not wire `/wants`; do not change `totalValue` math; do not touch `apps/web/src/pages/SharedBinder.jsx`)

**Checkpoint**: User Story 1 is fully functional and testable independently (headline + open/close only)

---

## Phase 4: User Story 2 - Compare marketplace Low and Market totals (Priority: P2)

**Goal**: Overlay shows quantity-weighted TCGplayer Market/Low (USD) and CardMarket Trend/Low (EUR); unpriced is `—` plus copy counts; both marketplaces always shown

**Independent Test**: Mixed priced/unpriced Binder. Open overlay. Four field totals equal qty × catalog field for priced copies only. Missing/`0` never `$0.00` / `€0.00`. Mobile Settings CardMarket changes the chip/headline, not the four rows’ presence.

### Tests for User Story 2 ⚠️

- [X] T013 [P] [US2] Extend `apps/mobile/test/widgets/binder_value_sheet_test.dart`: TCG Market/Low and CardMarket Trend/Low render; unpriced field shows `—` not `$0.00`/`€0.00`; unpriced copy count visible when omitted copies &gt; 0
- [X] T014 [P] [US2] Extend `apps/web/tests/components/BinderValueDialog.test.jsx` with the same marketplace and unpriced assertions (reuse `formatCatalogPrice` rules from `apps/web/src/components/cardDetail/CardDetailPrices.jsx`)

### Implementation for User Story 2

- [X] T015 [P] [US2] Render TCGplayer (USD) Market/Low and CardMarket (EUR) Trend/Low from `buildBinderValueSnapshot` in `apps/mobile/lib/features/binder/binder_value_sheet.dart` (foil-aware already in the helper; `amount == null` → `—`; show `unpricedCopies` when &gt; 0)
- [X] T016 [P] [US2] Render the same four rows from `buildBinderValueSnapshot` in `apps/web/src/components/binder/BinderValueDialog.jsx` (call snapshot with `headline: "tcgMarketOnly"`; format USD/EUR like card-detail Prices)
- [X] T017 [US2] Pass current Binder entries + catalog into the overlay so totals refresh if qty changes while open, without a network fetch, from `apps/mobile/lib/features/binder/binder_screen.dart` and `apps/web/src/pages/BinderCollection.jsx`

**Checkpoint**: User Stories 1 and 2 both work; headline still matches the control; field totals stay honest

---

## Phase 5: User Story 3 - See other Binder stats that explain the total (Priority: P3)

**Goal**: Same overlay shows copies, distinct Printings, foil vs Regular, marketplace-level unpriced copies, and up to five Top Printings (name, finish, qty, contribution)

**Independent Test**: Several Printings including foil and unpriced. Counts match the list. Top five ranked by headline-source contribution; fewer than five priced Printings does not pad.

### Tests for User Story 3 ⚠️

- [X] T018 [P] [US3] Extend `apps/mobile/test/widgets/binder_value_sheet_test.dart`: copies / distinct Printings / foil / Regular; `tcgUnpricedCopies` / `cmUnpricedCopies` when &gt; 0; top list length ≤ 5 and no placeholder rows
- [X] T019 [P] [US3] Extend `apps/web/tests/components/BinderValueDialog.test.jsx` with the same stock and top-five assertions

### Implementation for User Story 3

- [X] T020 [P] [US3] Add Stock (copies, distinct Printings, foil, Regular, marketplace unpriced counts) and Top Printings (name, finish, quantity, contribution; omit section when empty) in `apps/mobile/lib/features/binder/binder_value_sheet.dart`
- [X] T021 [P] [US3] Add the same Stock and Top Printings sections in `apps/web/src/components/binder/BinderValueDialog.jsx` (contribution currency follows TCG Market / `tcgMarketOnly`)

**Checkpoint**: All three stories independently functional; one overlay instance; Want List and shared Binder still out of scope

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Discoverability, vocabulary, and quickstart validation

- [X] T022 [P] Update `TourCopy.binderTotalBody` in `apps/mobile/lib/features/onboarding/tour_copy.dart` so the existing Binder-value tour can mention that tapping the green total opens details (chip still opens the sheet after the tour)
- [X] T023 Confirm labels use Binder / Printing / TCGplayer / CardMarket / Market / Low / Trend (not Collection or “CardMarket Market”) in `apps/mobile/lib/features/binder/binder_value_sheet.dart` and `apps/web/src/components/binder/BinderValueDialog.jsx`
- [X] T024 Run `cd apps/mobile && flutter test` and `cd apps/web && npm test`, then walk [quickstart.md](./quickstart.md) (open/dismiss both surfaces, four marketplace totals, unpriced never zero, stock + top five, Want List and shared Binder do not open this overlay)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational
  - US2–US3 assume the US1 overlay chrome exists (one sheet / one dialog)
  - US2 and US3 can proceed in parallel after US1 if staffed (different sections of the same overlay files — coordinate or go sequentially P1 → P2 → P3)
- **Polish (Phase 6)**: After desired stories are complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — MVP open/close + headline
- **User Story 2 (P2)**: After US1 overlay exists — marketplace rows; math already in Phase 2
- **User Story 3 (P3)**: After US1 overlay exists — stock + top five; can follow US2 sequentially to avoid clobbering the same UI files

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Snapshot helper (Phase 2) before any overlay numbers
- Chrome before wiring the Binder total control
- Story complete before the next priority if one person is editing the overlay files

### Parallel Opportunities

- T003 and T004 in parallel after T001
- T005 and T006 in parallel after their failing tests
- T007 and T008 in parallel; T009 and T010 in parallel
- T013 and T014 in parallel; T015 and T016 in parallel
- T018 and T019 in parallel; T020 and T021 in parallel (mobile vs web)
- T022 can run beside T023

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Widget tests in apps/mobile/test/widgets/binder_value_sheet_test.dart"
Task: "Component tests in apps/web/tests/components/BinderValueDialog.test.jsx"

# Chrome together:
Task: "Sheet in apps/mobile/lib/features/binder/binder_value_sheet.dart"
Task: "Dialog in apps/web/src/components/binder/BinderValueDialog.jsx"
```

## Parallel Example: User Story 2

```bash
# After US1, marketplace tests then UI (mobile vs web in parallel):
Task: "TCG/CM rows in apps/mobile/lib/features/binder/binder_value_sheet.dart"
Task: "TCG/CM rows in apps/web/src/components/binder/BinderValueDialog.jsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (fixture + README)
2. Complete Phase 2: Foundational (both helpers + contract tests)
3. Complete Phase 3: User Story 1 (tap total → overlay with matching headline)
4. **STOP and VALIDATE**: Tap green chip / click `/binder` total, dismiss, Binder unchanged
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → shared snapshot math
2. US1 → overlay from the Binder total (MVP)
3. US2 → TCG + CardMarket Low/Market (Trend)
4. US3 → counts and top five
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With two developers after Foundational:

1. Developer A: mobile sheet (US1 → US2 → US3)
2. Developer B: web dialog (US1 → US2 → US3)
3. Integrate only at Binder entry wiring (`binder_screen.dart` / `BinderCollection.jsx`)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story
- Do not retarget chip/header formulas, add a stats route, enable CardMarket ingest, port this overlay to Want List or shared Binder, or invent prices
- Reuse `Pricing.value` fallbacks only for mobile `headline: "pricingValue"` / top-five ranking — not for the four field totals
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
