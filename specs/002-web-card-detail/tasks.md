---

description: "Task list for web card detail modal implementation"
---

# Tasks: Web Card Detail Modal

**Input**: Design documents from `/specs/002-web-card-detail/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. [plan.md](./plan.md) requires Jest + Testing Library coverage for printings grouping, unpriced Prices (`null`/`0` → `—`), modal chrome, balancer-only Add to trade, SearchOption name-vs-add split, and list name/thumb opening details.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Web feature lives in `apps/web/src/` with tests in `apps/web/tests/`
- No mobile, pipeline, or `packages/contracts` changes in this feature (except existing `free_limits.json` already shared)

## Constitution

Touches **I** (one provider + one dialog, no `/cards/:id`), **II** (Printing / Prices / Want vocabulary), **III** (unpriced is `—`, missing art is explicit), **IV** (catalog-shaped fixtures, reuse `free_limits.json`), **V** (read-path `cm_*` mapping only; no invented prices).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Feature folders and honest catalog-shaped fixtures so later tests do not invent dummy cards

- [X] T001 Create `apps/web/src/components/cardDetail/` and catalog-shaped printing fixtures (priced, unpriced/`0`/`null`, sibling Versions) in `apps/web/tests/fixtures/printings.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Catalog honesty and a single app-shell session so every story can call `openDetail(printing)`

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Include CardMarket `cm_avg`, `cm_low`, `cm_trend` (and foil variants if present on `fab_cards_with_prices`) in `CARD_COLUMNS` and `mapRowToLegacyShape` in `apps/web/src/services/fabDb.js`
- [X] T003 Map `cardmarketTrend` / `cardmarketLow` / `cardmarketAvg` (and foil variants) onto catalog card objects in `createCardObject` in `apps/web/src/hooks/useCardData.jsx`
- [X] T004 [P] Implement `CardDetailContext` (`open`/`printing`, `openDetail` replaces never stacks, `closeDetail`, optional `registerAddWant` / `addWantCard` defaulting to `null`) in `apps/web/src/contexts/CardDetailContext.jsx`
- [X] T005 Mount `CardDetailProvider` inside `Router` in `apps/web/src/App.jsx` so every route can call `openDetail`

**Checkpoint**: Foundation ready — catalog objects carry CM fields; any page can open/replace a single detail session

---

## Phase 3: User Story 1 - Inspect a card without leaving the page (Priority: P1) 🎯 MVP

**Goal**: Overlay modal shows this Printing’s art, identity, finish, and dual-marketplace Prices; dismiss restores the page (trade piles unchanged)

**Independent Test**: From the trade balancer (`/`), open a named card. Confirm a detail modal with art, name, set/meta, finish, and Prices (TCG + CardMarket; unpriced as `—`). Dismiss (X, backdrop, Escape) leaves the live trade unchanged. Signed-out inspect still works.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T006 [P] [US1] Unit tests that `null` and `0` Prices render as `—` and never `$0.00` / `€0.00` in `apps/web/tests/components/CardDetailPrices.test.jsx`
- [X] T007 [P] [US1] Component tests for overlay chrome, identity, signed-out inspect, missing-art state, and dismiss restoring parent in `apps/web/tests/components/CardDetailModal.test.jsx`

### Implementation for User Story 1

- [X] T008 [P] [US1] Implement `CardDetailPrices` (TCGplayer Market/Low/Mid/High/Direct low USD; CardMarket Trend/Low/Avg EUR; catalog attribution; unpriced `—`) in `apps/web/src/components/cardDetail/CardDetailPrices.jsx`
- [X] T009 [US1] Implement `CardDetailModal` Dialog (art, name, set/collector identity, finish, Prices; loading/missing art does not hide name or Prices) in `apps/web/src/components/cardDetail/CardDetailModal.jsx`
- [X] T010 [US1] Wire nested art zoom with existing `CardImageModal` inside `apps/web/src/components/cardDetail/CardDetailModal.jsx` (dismiss zoom returns to detail, not a second inspect path)
- [X] T011 [US1] Render the single `CardDetailModal` from the app shell (`apps/web/src/App.jsx` and/or `apps/web/src/contexts/CardDetailContext.jsx`) bound to context `open`/`printing`
- [X] T012 [US1] Make trade-pile name and thumbnail call `openDetail(printing)` and stop using list `CardImageModal` in `apps/web/src/components/ui/CardList.jsx`
- [X] T013 [US1] Update `apps/web/tests/components/CardList.test.jsx` so name/thumb open details (not a standalone art overlay) and delete still uses its own control

**Checkpoint**: User Story 1 is fully functional from Home piles and testable independently

---

## Phase 4: User Story 2 - Every named card is a way in (Priority: P2)

**Goal**: Every listed surface’s catalog name and thumbnail opens the same modal; name/thumb never add; search keeps a distinct add control; no stacked dialogs

**Independent Test**: Walk trade piles, search, `/sets/:id`, Binder/Want List, `/b/:token`, `/history`. Every visible catalog name (and matching thumb) opens the same detail pattern. Search name/thumb does not add; add still works via its own control.

### Tests for User Story 2 ⚠️

- [X] T014 [P] [US2] Component tests that name/thumb call `openDetail` and do not call `onSelect`, while the remaining add control still selects, in `apps/web/tests/components/SearchOption.test.jsx`

### Implementation for User Story 2

- [X] T015 [P] [US2] Split `SearchOption`: name and thumbnail `stopPropagation` + `openDetail`; remaining row/add target still `onSelect`; keep keyboard-enter add in `apps/web/src/components/search/SearchOption.jsx`
- [X] T016 [P] [US2] Wire set-list name/thumb to `openDetail` and remove list `CardImageModal` in `apps/web/src/pages/SetDetail.jsx`
- [X] T017 [P] [US2] Wire Binder and Want List name/thumb to `openDetail` and remove list `CardImageModal` in `apps/web/src/pages/BinderCollection.jsx`
- [X] T018 [P] [US2] Wire shared-Binder name/thumb to `openDetail` and remove list `CardImageModal` in `apps/web/src/pages/SharedBinder.jsx` (leave any on-page Add to trade unchanged)
- [X] T019 [US2] Wire trade-history name/thumb to `openDetail` when a Printing is resolvable via `cardIdLookup`; otherwise render the name as plain text in `apps/web/src/pages/TradeHistory.jsx`

**Checkpoint**: User Stories 1 and 2 both work independently; one modal instance; art-only list overlay gone

---

## Phase 5: User Story 3 - Details follow the selected Printing (Priority: P3)

**Goal**: Versions switch art, identity, finish, and Prices to that Printing only; the opened Printing is selected first

**Independent Test**: Open details on a card with at least two Printings. Initial selection matches the entry point. Switch Version: art and Prices change; no leftover numbers from the previous finish. Unpriced/missing art on the new Printing is honest.

### Tests for User Story 3 ⚠️

- [X] T020 [P] [US3] Unit tests that `printingsForCard` returns only siblings of the opened Printing (set + finish, including reprints) in `apps/web/tests/utils/printingsForCard.test.js`

### Implementation for User Story 3

- [X] T021 [US3] Implement `printingsForCard(catalog, printing)` in `apps/web/src/utils/printingsForCard.js` (do not reuse `groupCardsByEdition` / `displayName` as the Versions grain)
- [X] T022 [US3] Add Versions UI in `apps/web/src/components/cardDetail/CardDetailModal.jsx` when siblings ≥ 2; selecting a Version updates art, identity, finish, and Prices for that Printing only
- [X] T023 [US3] Extend `apps/web/tests/components/CardDetailModal.test.jsx` so switching Version never leaves another Printing’s art or Prices on screen

**Checkpoint**: All prior stories still work; Versions are independently testable

---

## Phase 6: User Story 4 - Act without losing the page (Priority: P4)

**Goal**: Balancer-only **Add to trade** always onto Want; Want List add with existing auth/free-cap rules; Own N when signed in; successful adds stay in the modal with a Snackbar

**Independent Test**: On `/`, **Add to trade** is present and adds the Printing to Want (even from a Have card); Snackbar; modal stays open. On `/sets/:id` (or Binder/history), **Add to trade** is absent; Want List still works when signed in. Signed-out inspect still works; Own N only when signed in.

### Tests for User Story 4 ⚠️

- [X] T024 [P] [US4] Extend `apps/web/tests/components/CardDetailModal.test.jsx`: **Add to trade** absent off `/`; present on `/` and calls Want add; success does not unmount the dialog; failure (auth/cap) does not toast success

### Implementation for User Story 4

- [X] T025 [US4] Register `addWantCard` on Home mount and clear on unmount via `registerAddWant` in `apps/web/src/pages/Home.jsx` (do not lift `useTradeState` to App; `apps/web/src/hooks/useTradeState.js` stays unchanged)
- [X] T026 [US4] Show **Add to trade** only when `pathname === '/'` and `addWantCard` is registered; call `addWantCard({ label, card })` for the selected Printing onto Want in `apps/web/src/components/cardDetail/CardDetailModal.jsx`
- [X] T027 [US4] Offer Want List add using existing `upsertEntry` / `canAddDistinctCard` in `apps/web/src/components/cardDetail/CardDetailModal.jsx` (signed out → `apps/web/src/components/auth/SignInDialog.jsx`; over cap → existing upgrade/limit UI; never invent a local Binder)
- [X] T028 [US4] Show Own N when signed in and a Binder entry exists for `printing._uniqueId` with `!isWanted` in `apps/web/src/components/cardDetail/CardDetailModal.jsx` (omit badge signed out; do not block Prices on Binder fetch)
- [X] T029 [US4] After a successful Want or Want List add, keep the modal open and show the existing short bottom-center Snackbar/Alert confirmation in `apps/web/src/components/cardDetail/CardDetailModal.jsx`

**Checkpoint**: All user stories independently functional; mobile, pipeline, and entitlements unchanged

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Focus, attribution, and quickstart validation across stories

- [X] T030 Restore focus to the underlying page after dismiss and keep Escape/backdrop/close working in `apps/web/src/components/cardDetail/CardDetailModal.jsx`
- [X] T031 [P] Credit catalog marketplace attribution (and freshness when known) in `apps/web/src/components/cardDetail/CardDetailPrices.jsx`
- [X] T032 Run `cd apps/web && npm test` and walk [quickstart.md](./quickstart.md) (signed-out inspect, every entry surface, Versions, balancer-only Want add, unpriced never zero)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in priority order (P1 → P2 → P3 → P4)
  - US2–US4 assume the US1 modal exists (one overlay, FR-013)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — MVP inspect from Home piles
- **User Story 2 (P2)**: After US1 modal exists — additional entry points; SearchOption and page files are independent of each other
- **User Story 3 (P3)**: After US1 modal exists — Versions can ship without US2 or US4
- **User Story 4 (P4)**: After US1 modal exists — actions; balancer detection uses `useLocation()` from the provider already inside `Router`

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Context/catalog mapping before modal
- Prices component before modal composition
- Core inspect before entry-point wiring
- Story complete before moving to next priority

### Parallel Opportunities

- T004 can run in parallel with T002–T003
- T006 and T007 can run in parallel
- T008 can run in parallel with T006/T007 once fixtures exist
- After US1, T015–T018 (SearchOption, SetDetail, BinderCollection, SharedBinder) can run in parallel
- T020 can run in parallel with US2 work

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Unit tests for unpriced Prices in apps/web/tests/components/CardDetailPrices.test.jsx"
Task: "Component tests for modal chrome in apps/web/tests/components/CardDetailModal.test.jsx"

# Then implementation:
Task: "Implement CardDetailPrices in apps/web/src/components/cardDetail/CardDetailPrices.jsx"
Task: "Implement CardDetailModal in apps/web/src/components/cardDetail/CardDetailModal.jsx"
```

## Parallel Example: User Story 2

```bash
# After T014 test file exists, wire surfaces in parallel:
Task: "Split SearchOption in apps/web/src/components/search/SearchOption.jsx"
Task: "Wire SetDetail in apps/web/src/pages/SetDetail.jsx"
Task: "Wire BinderCollection in apps/web/src/pages/BinderCollection.jsx"
Task: "Wire SharedBinder in apps/web/src/pages/SharedBinder.jsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (modal + Home piles)
4. **STOP and VALIDATE**: Open a Have name on `/`, see Prices, dismiss, trade unchanged
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → `openDetail` and CM-mapped catalog
2. US1 → inspect from balancer piles (MVP)
3. US2 → every named card / thumb is a way in
4. US3 → Versions follow the Printing
5. US4 → balancer Want add, Want List, Own N
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (then US4 actions)
   - Developer B: User Story 2 entry points
   - Developer C: User Story 3 `printingsForCard` + Versions
3. Stories integrate on the single `CardDetailModal`

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Do not add a card URL route, lift `useTradeState` to App, enable CardMarket ingest, or port scan / lends / Trade Filler
- `formatPrice` in `apps/web/src/utils/searchUtils.js` already maps `null`/`0` → `—` for USD; CardMarket in the modal must match that honesty in EUR
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
