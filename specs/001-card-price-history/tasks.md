---

description: "Task list for card price history implementation"
---

# Tasks: Card Price History

**Input**: Design documents from `/specs/001-card-price-history/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. [plan.md](./plan.md) requires `flutter test` coverage for Low extraction, 30-day clip, change summary, CTA/span visibility, placement under Prices, empty/error, and Pro vs free chrome. Use real `PricePoint` lists — never a mock that returns the chart the test wanted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Mobile feature lives in `apps/mobile/lib/` with tests in `apps/mobile/test/`
- No web, pipeline, or `packages/contracts` changes (30-day window is mobile-only)

## Constitution

Touches **I** (reuse `fab_price_history` / `priceHistory()` / paywall; one chart library), **II** (`PricePoint` stays the snapshot; series helper names observed Low vs derived delta vs window), **III** (fetch error is retry, not a swallowed empty chart; null Low is a gap), **IV** (real `PricePoint` fixtures; no contracts JSON), **V** (pipeline unchanged; apps only read).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Chart dependency and honest test fixtures so later tests do not invent dummy prices

- [X] T001 Add `fl_chart: ^1.2.0` to `apps/mobile/pubspec.yaml` and run `flutter pub get` from `apps/mobile`
- [X] T002 [P] Add a `buildPricePoint` helper in `apps/mobile/test/support/fixtures.dart` (`capturedOn`, nullable `tcgLow` / `cmLow` / `tcgMarket` / `cmTrend`) using the real `PricePoint` constructor — never default a null Low to `0.0`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Low-series math and the Printing-keyed fetch. No user story UI until this is green.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Write failing tests in `apps/mobile/test/core/logic/price_history_series_test.dart`: Low is `tcgLow` or `cmLow` from `PriceSource` only (never Market/Trend/Mid/High, never the other marketplace); null Low is dropped not coerced to 0; a Market-only row is a gap; default window is last 30 calendar days (`today − 29` inclusive, date-only); `delta` is last visible Low minus first visible Low; `hasOlder` is any usable Low before window start; Pro CTA chrome is `!isPro && hasOlder && chartable`; span chrome is `isPro && hasOlder && chartable`; empty/loading/error hide both chrome flags
- [X] T004 Implement the helper in `apps/mobile/lib/core/logic/price_history_series.dart` so T003 passes (`window` `last30` | `full`, `points`, `hasOlder`, `chartable` iff `points.length >= 2`, `delta`, chrome flags). Format the change amount with existing `Pricing` in `apps/mobile/lib/core/logic/pricing.dart`
- [X] T005 Add `priceHistoryProvider` as `FutureProvider.family<List<PricePoint>, String>` in `apps/mobile/lib/core/providers.dart` that calls existing `CardRepository.priceHistory(cardId)` in `apps/mobile/lib/core/data/card_repository.dart`. Empty list is success (no snapshots), not an error

**Checkpoint**: Foundation ready — series rules are testable without a widget; fetch is keyed by Printing id

---

## Phase 3: User Story 1 - See this printing's price over time (Priority: P1) 🎯 MVP

**Goal**: On mobile card details, a Low-only history section sits directly under the Prices box. Everyone defaults to the last 30 days. Free/signed-out get a quiet Pro line when older snapshots exist; Pro can switch to the full span. Tap/hold a point shows that day’s date and Low. Today’s Prices stay visible.

**Independent Test**: Open a Printing with ≥2 TCG Lows. History appears immediately under Prices with a one-line chart and a change summary. Free sees only 30 days + “See full history with Pro” when older points exist. Pro defaults to 30 days with a span control. Tap a point: date + Low, no navigation.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T006 [US1] Write failing widget tests in `apps/mobile/test/widgets/price_history_section_test.dart` (extend `pumpApp` in `apps/mobile/test/support/harness.dart` or override locally to stub `CardRepository.priceHistory` and Pro via `subscriptionProvider`): section sits under the `Prices` heading on `CardDetailScreen`; loading/empty/error leave Prices visible; chartable state shows one Low line and a numeric change; free + older snapshots show “See full history with Pro” and no span control; Pro + older snapshots show a span control, no upgrade line, and default 30-day window

### Implementation for User Story 1

- [X] T007 [US1] Implement `PriceHistorySection` in `apps/mobile/lib/features/card_detail/price_history_section.dart`: `fl_chart` `LineChart` with exactly one `LineChartBarData`, `isCurved: false`, spots = observed Lows only (omit gaps, never y=0), Y auto-fit without a $0 baseline, `LineTouchData` tooltip of that spot’s date + `Pricing.format` Low (snap to nearest observed spot, never `$0.00` / `€0.00`), plus catalog attribution that values are observed Low from the same catalog as today’s prices
- [X] T008 [US1] Insert `PriceHistorySection` immediately after `_PriceCard` (around line 127) in `apps/mobile/lib/features/card_detail/card_detail_screen.dart`. Watch `priceHistoryProvider(_selected.id)`, `settingsProvider` / `pricingProvider`, and `isProProvider`. Build Prices from the cached `CardModel` without awaiting history
- [X] T009 [US1] When free/signed-out, chartable, and `hasOlder`, show a quiet “See full history with Pro” text control under the chart in `apps/mobile/lib/features/card_detail/price_history_section.dart` that calls `presentProPaywall(context, ref, trigger: 'price_history')` from `apps/mobile/lib/features/paywall/pro_paywall.dart`. Do **not** wrap the chart in `ProGate`. After upgrade, stay on the 30-day default
- [X] T010 [US1] When Pro, chartable, and `hasOlder`, show a local last-30 / full-span control in `apps/mobile/lib/features/card_detail/price_history_section.dart` (default `last30` on open, not persisted). Switching recomputes visible points and the change summary via the series helper. Free/signed-out must not see this control

**Checkpoint**: User Story 1 is a shippable glance under Prices for free and Pro

---

## Phase 4: User Story 2 - History follows the selected Printing (Priority: P2)

**Goal**: Switching Versions reloads history for that Printing only. A Printing with no history shows empty, not the previous line.

**Independent Test**: Open a card with two Printings that have different Low paths. Switch Versions; the series and change summary follow `_selected.id`. A Printing with <2 Lows shows empty, not leftover points.

### Tests for User Story 2 ⚠️

- [X] T011 [US2] Add failing widget tests in `apps/mobile/test/widgets/price_history_section_test.dart`: two catalog Printings with different `priceHistory` stubs; selecting the second Version shows only that Printing’s Lows; selecting a Printing whose stub returns 0–1 Lows shows empty copy, not the previous chart, once the new fetch has settled

### Implementation for User Story 2

- [X] T012 [US2] Keep `priceHistoryProvider` keyed by `_selected.id` in `apps/mobile/lib/features/card_detail/card_detail_screen.dart`. While the new id is loading, show the compact loading placeholder (not the previous Printing’s line). Marketplace changes recompute Low from the same snapshots without a new fetch

**Checkpoint**: User Stories 1 and 2 both work; history is per Printing

---

## Phase 5: User Story 3 - Honest empty, sparse, and failure states (Priority: P3)

**Goal**: <2 Lows, unpriced days, CardMarket-with-no-`cm_low`, and a failed fetch must not look like $0 or a crash. The page and Prices stay usable.

**Independent Test**: One-snapshot Printing → empty, not a flat zero line. Gaps omitted. Failed fetch → retry under Prices. Airplane mode: details + Prices still render.

### Tests for User Story 3 ⚠️

- [X] T013 [P] [US3] Extend `apps/mobile/test/core/logic/price_history_series_test.dart` and `apps/mobile/test/widgets/price_history_section_test.dart`: <2 usable Lows → empty, no chart; a null-Low day between two Lows is omitted (connectors between observed spots only, never a $0.00 tooltip); `priceHistory` throw → error + Retry, Prices still on screen; `PriceSource.cardmarket` with only `tcgLow` populated → empty (no silent TCG line), with marketplace-specific copy

### Implementation for User Story 3

- [X] T014 [US3] Render loading / empty / error+Retry in `apps/mobile/lib/features/card_detail/price_history_section.dart` per [contracts/history-section.md](./contracts/history-section.md). Empty copy: “History not available yet”, or marketplace-specific when the other market would have had points. Retry invalidates `priceHistoryProvider(cardId)`. Empty/loading/error hide the Pro CTA and span control
- [X] T015 [US3] Confirm `CardDetailScreen` in `apps/mobile/lib/features/card_detail/card_detail_screen.dart` is not blocked on history (no full-page spinner, action bar stays). A compact history placeholder is fine; a failed load must not hide `_PriceCard` or `_ActionBar`

**Checkpoint**: All three stories independently functional; unpriced days never display as zero

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Prevent the wrong Pro pattern and prove the quickstart suite

- [X] T016 [P] Update the `ProGate` example comment in `apps/mobile/lib/features/paywall/pro_gate.dart` so it no longer suggests wrapping a price-history chart (that pattern is forbidden by FR-013)
- [X] T017 [P] Optionally capture `price_history_span_changed` with `{span: '30d'|'full', card_id}` via `analyticsProvider` in `apps/mobile/lib/features/card_detail/price_history_section.dart` when Pro toggles span — do not log tooltip inspects
- [X] T018 Run the automated checks in [quickstart.md](./quickstart.md): `cd apps/mobile && flutter test test/core/logic/price_history_series_test.dart && flutter test test/widgets/price_history_section_test.dart && flutter test`. Full suite stays green. `apps/web/` unchanged

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational
  - Sequential in priority order is the intended path (P1 → P2 → P3)
  - US2/US3 mostly extend `price_history_section.dart` / the same widget tests, so they are not independent files
- **Polish (Phase 6)**: Depends on US1–US3

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — MVP
- **User Story 2 (P2)**: After US1 widget exists — Versions switch is the same section keyed by `_selected.id`
- **User Story 3 (P3)**: After US1 section exists — empty/error states are additional UI on that section

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Series helper before provider before widget
- Widget before screen insertion
- Chart + inspect before Pro chrome
- Story complete before moving to next priority

### Parallel Opportunities

- T001 (pubspec) and T002 (fixtures) can run together
- T013 (US3 tests) can start once T004 exists, in parallel with US2 tests if staffed
- T016 (ProGate comment) and T017 (analytics) can run together after US1 chrome exists

---

## Parallel Example: User Story 1

```bash
# After T004–T005, write the failing widget tests:
Task: "Widget tests for placement, chrome, and Prices visibility in apps/mobile/test/widgets/price_history_section_test.dart"

# Then implement the section (same file, sequential):
Task: "PriceHistorySection chart + inspect in apps/mobile/lib/features/card_detail/price_history_section.dart"
Task: "Insert under _PriceCard in apps/mobile/lib/features/card_detail/card_detail_screen.dart"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Open card details signed-out; history under Prices; 30-day Low line; Pro CTA if older snapshots exist
5. Demo if ready — empty/error polish and Versions can follow

### Incremental Delivery

1. Setup + Foundational → series math + fetch
2. User Story 1 → glance under Prices (MVP)
3. User Story 2 → Versions follow the Printing
4. User Story 3 → honest empty/error
5. Polish → ProGate comment, optional analytics, full `flutter test`

### Parallel Team Strategy

This feature is one section on one screen. Prefer one implementer sequential P1 → P2 → P3 rather than splitting stories across people (they share `price_history_section.dart`).

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to US1/US2/US3
- Do not add a migration, RPC, SharedPreferences history cache, web widget, or CardMarket ingest
- Do not use `ProGate` around the chart
- Signed-out = free (30-day window only)
- CardMarket selected + null `cm_low` history → empty, not a TCG substitute
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
