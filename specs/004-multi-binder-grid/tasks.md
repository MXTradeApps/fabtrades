---

description: "Task list for multi-binder grid implementation"
---

# Tasks: Multi-Binder Grid

**Input**: Design documents from `/specs/004-multi-binder-grid/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. [plan.md](./plan.md) requires golden fixtures asserted by both `apps/mobile` (`flutter test`) and `apps/web` (`npm test`): extend `packages/contracts/free_limits.json`; add `binder_move.json`, `binder_cover.json`, `binder_names.json`. Widget/page tests for the grid, Want List sibling, Trade Binder delete refusal, and Pro upgrade on a 5th Binder. Move/cover/name unit tests use catalog-shaped rows, not mocks that return the answer.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Shared fixtures: `packages/contracts/`
- Schema: `supabase/migrations/`
- Mobile: `apps/mobile/lib/features/binder/`, `apps/mobile/lib/core/models/`, `apps/mobile/lib/core/logic/`, `apps/mobile/lib/core/data/`, `apps/mobile/lib/core/sync/`
- Web: `apps/web/src/components/binder/`, `apps/web/src/utils/`, `apps/web/src/pages/BinderCollection.jsx`, `apps/web/src/services/binder.js`
- Tests: `apps/mobile/test/` and `apps/web/tests/`

## Constitution

Touches **I** (grid + two defaults + move + limits; no folders / share-all-Binders / Collection-in-Confirm-Trade), **II** (`role=trade` vs display name; Want List is `is_wanted`, not a Binder; cover/value derived), **III** (duplicate name refused; Trade Binder delete refused; non-empty delete refused; unpriced tile is unpriced, not $0), **IV** (extend `free_limits.json`; add `binder_move.json` / `binder_cover.json` / `binder_names.json`; both suites assert them), **V** (pipeline unchanged; covers use catalog `image_url`). **MINOR** vocabulary: Collection as a default Binder **name** in `.specify/memory/constitution.md` Constraint 4 and `docs/CONTEXT.md` in this change. Also: table is the deadline (Confirm Trade / filler stay Trade Binder), no gate before value (signed-out mobile), one brand two peer surfaces, real prices or nothing, local reads, dual-client DRY (fixtures not a runtime), server-owned Pro (5th Binder paywall does not write `entitlements`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Golden cases so JS and Dart cannot invent different Binder, cover, move, name, or free-limit rules

- [X] T001 [P] Extend `packages/contracts/free_limits.json` from [contracts/free-limits.md](./contracts/free-limits.md): add `limits.binders: 4` and `behaviour.binders: "paywall"`; keep `binderCards: 50` / `refuse`; add cases for 50 distinct owned Printings split across Trade Binder + Collection still refusing a 51st, a valid move among those 50 allowed, 3 live Binders create allowed, 4 live Binders create forbidden for free / allowed for Pro, tombstoned Collection not counting toward 4
- [X] T002 [P] Create `packages/contracts/binder_move.json` from [contracts/binder-move.md](./contracts/binder-move.md) using catalog-shaped rows (printing id, binder id, condition, quantity, prices): partial qty, merge on printing+condition, refuse qty &lt; 1 / qty &gt; source / same Binder / missing source / tombstoned destination, Want List never a destination, distinct owned count unchanged
- [X] T003 [P] Create `packages/contracts/binder_cover.json` from [contracts/binders.md](./contracts/binders.md) using catalog-shaped rows: empty → no cover; highest `qty × sourceValue` (`pricingValue` vs `tcgMarketOnly`); ties name A–Z then printing id then condition; all-unpriced still picks a cover by name (must not look empty)
- [X] T004 [P] Create `packages/contracts/binder_names.json` from [contracts/binders.md](./contracts/binders.md): trim + case-fold uniqueness among live Binders; empty-after-trim invalid; own-name rename ok; deleted name reusable; Trade Binder rename keeps `role=trade`
- [X] T005 Add `free_limits.json` (`binders` + shared `binderCards`), `binder_move.json`, `binder_cover.json`, and `binder_names.json` to the files table in `packages/contracts/README.md` (web `apps/web/src/utils/freeLimits.js` / `binderMove.js` / `binderCover.js` / `binderNames.js`; mobile `apps/mobile/lib/core/logic/free_limits.dart` / `binder_move.dart` / `binder_cover.dart` / `binder_names.dart`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, Binder records, entry identity, seed/migration, sync, shared helpers, and Trade Binder scoping. Grid stories only display these objects.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 [P] MINOR-amend Constraint 4 in `.specify/memory/constitution.md` (version bump + Sync Impact Report): product noun remains Binder; Trade Binder = tradeable stock; Collection is allowed as the default keep-pile Binder name; do not rename the Binder destination to Collection; Want List is still not a Binder
- [X] T007 [P] Update Binder / Collection / Want List vocabulary in `docs/CONTEXT.md` to match T006 (Trade Binder = tradeable stock; Collection = owned-not-for-trade default Binder name; type stays Binder)
- [X] T008 [P] Document the `binders` domain and owned entry identity `binder|{binderId}|{cardId}|{condition}` vs `want|{cardId}` in `docs/CLOUD_SYNC.md` (last-write-wins per record; unique live names; unique-violation is a surfaced error)
- [X] T009 Add `supabase/migrations/20260822000000_multi_binders.sql`: `public.binders` (`user_id`, `client_id`, `name`, `role` trade|standard, timestamps, `deleted_at`; `UNIQUE (user_id, client_id)`; partial unique live names `UNIQUE (user_id, lower(btrim(name))) WHERE deleted_at IS NULL`; partial unique one trade Binder; RLS own rows); `binder_entries.binder_id TEXT`; drop `UNIQUE (user_id, card_id, is_wanted)`; partial unique owned `(user_id, card_id, binder_id, condition) WHERE is_wanted = false AND deleted_at IS NULL`; partial unique want `(user_id, card_id) WHERE is_wanted = true AND deleted_at IS NULL`; check `(is_wanted AND binder_id IS NULL) OR (NOT is_wanted AND binder_id IS NOT NULL)`; backfill `system:trade` + `system:collection` and set owned `binder_id = system:trade`; rewrite `private.get_public_binder_by_token` to return owned live rows whose Binder `role = trade` only
- [X] T010 [P] Create Binder record (`clientId`, `name`, `role` trade|standard, `createdAt`, `updatedAt`, `deletedAt`; defaults `system:trade` / `system:collection`) in `apps/mobile/lib/core/models/binder.dart`
- [X] T011 [P] Add `binderId` on owned rows (null when `isWanted`; default `system:trade` on owned JSON missing `binder_id`) in `apps/mobile/lib/core/models/binder_entry.dart` and round-trip it in `apps/mobile/test/core/models/binder_entry_test.dart`
- [X] T012 Create `apps/mobile/lib/core/data/binders_repository.dart` (`CachedCollection<Binder>`, storage key `binders`): seed Trade Binder + Collection when missing; never tombstone `role=trade`
- [X] T013 On load, assign owned entries missing `binderId` to `system:trade` (Want List stays null) in `apps/mobile/lib/core/data/binder_repository.dart` so pre-feature `collection_entries` migrate losslessly
- [X] T014 [P] Implement binders-table adapter (`client_id` identity, tombstones, conflict `user_id,client_id`) in `apps/mobile/lib/core/sync/binders_sync.dart`
- [X] T015 Change owned `idOf` to `binder|{binderId}|{cardId}|{condition}` and want to `want|{cardId}` (conflict target matches new uniques) in `apps/mobile/lib/core/sync/binder_sync.dart`; add `SyncDomain.binders` in `apps/mobile/lib/core/sync/sync_journal.dart`; wire the binders collection and `bindersChanged` in `apps/mobile/lib/core/sync/sync_service.dart`
- [X] T016 Add `bindersRepositoryProvider` + `BindersNotifier` (load/seed, live list, grid order: trade, live Collection, then `createdAt`) and keep `BinderNotifier` loading entries in `apps/mobile/lib/core/providers.dart`
- [X] T017 Fetch/upsert/seed `binders` and scope `binder_entries` by `binder_id` (Want List `binder_id` null) in `apps/web/src/services/binder.js` without inventing signed-out web Binder storage
- [X] T018 [P] Write failing contract tests for the extended `free_limits.json` (shared `binderCards` across Binders, `binders: 4` paywall) via `apps/mobile/test/contracts/contract_fixtures.dart` in `apps/mobile/test/contracts/free_limits_contract_test.dart` (and shared-cap cases in `apps/mobile/test/core/providers/free_limits_test.dart`)
- [X] T019 [P] Write failing contract tests that import `packages/contracts/free_limits.json` in `apps/web/tests/contracts/freeLimits.contract.test.js`
- [X] T020 Implement `FreeLimits.binders = 4`, distinct owned `binderCards` counted across all live Binders (Want List separate), `canCreateBinder`, and keep `binderCards` behaviour `refuse` in `apps/mobile/lib/core/logic/free_limits.dart` until T018 passes — Pro removes both Binder caps; clients MUST NOT write entitlements
- [X] T021 [P] Implement the same `FreeLimits.binders`, shared `binderCards`, and `canCreateBinder` in `apps/web/src/utils/freeLimits.js` until T019 passes
- [X] T022 [P] Write failing contract tests that load `binder_cover.json` via `apps/mobile/test/contracts/contract_fixtures.dart` in `apps/mobile/test/contracts/binder_cover_contract_test.dart` using catalog-shaped rows
- [X] T023 [P] Write failing contract tests that import `packages/contracts/binder_cover.json` in `apps/web/tests/contracts/binderCover.contract.test.js`
- [X] T024 Implement cover pick (empty none; max contribution; all-unpriced name-stable) in `apps/mobile/lib/core/logic/binder_cover.dart` until T022 passes — same `pricingValue` / `tcgMarketOnly` split as `binder_value_snapshot.dart`
- [X] T025 [P] Implement the same cover pick in `apps/web/src/utils/binderCover.js` until T023 passes (web default `tcgMarketOnly`)
- [X] T026 Scope `reconcileBinderAfterTrade` to entries whose Binder `role = trade` (given leave Trade Binder; received enter Trade Binder; other Binders untouched; Want List decrement unchanged) in `apps/mobile/lib/core/logic/confirm_trade.dart` until `apps/mobile/test/core/logic/confirm_trade_test.dart` passes
- [X] T027 [P] Scope `reconcileBinderAfterTrade` the same way in `apps/web/src/utils/confirmTrade.js` until `apps/web/tests/utils/confirmTrade.test.js` and `apps/web/tests/services/confirmTrade.test.js` pass
- [X] T028 [P] Boost Trade Filler from Trade Binder only (`role = trade`, not Collection) in `apps/mobile/lib/core/logic/trade_filler.dart` until `apps/mobile/test/core/logic/trade_filler_test.dart` passes; assert `getPublicBinder` / RPC fixtures in `apps/web/tests/services/binder.test.js` return Trade Binder rows only

**Checkpoint**: Foundation ready — `flutter test` and `npm test` pass new/extended fixtures; schema and seed exist; Confirm Trade / share / filler cannot steal Collection; no grid UI yet

---

## Phase 3: User Story 1 - See my Binders as a grid (Priority: P1) 🎯 MVP

**Goal**: The Binder destination opens on a grid of Binders (Trade Binder + Collection). Tiles show name, copy count, value, and cover; drill-in opens that Binder’s list; back returns to the grid; existing owned cards migrate to Trade Binder; signed-out mobile works

**Independent Test**: New player (empty) and existing Binder cards. Grid shows Trade Binder and Collection with name, count, value. Non-empty Trade Binder shows highest-value cover; empty Collection shows no cover. Open Trade Binder, back to grid. Pre-feature owned cards are in Trade Binder, not Collection. Signed-out mobile: grid and lists without creating an account. Web signed-in `/binder` matches; do not invent signed-out web Binder.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T029 [P] [US1] Widget tests in `apps/mobile/test/widgets/binder_grid_test.dart`: two default tiles; name / copy count / value match the list; empty tile has 0, true-zero value, no cover; unpriced non-empty shows `—` not `$0.00`/`€0.00` and still a cover; tile opens that Binder’s list; back returns to the grid; existing owned cards appear in Trade Binder; signed-out (no account) still shows the grid
- [X] T030 [P] [US1] Page/component tests in `apps/web/tests/components/BinderGrid.test.jsx`: signed-in `/binder` shows the same two tiles and drill-in/back; `isWanted` / `/wants` is not this grid; do not render a local grid when signed out

### Implementation for User Story 1

- [X] T031 [P] [US1] Implement the Binder grid (tiles: name, copy count, tile value from that Binder’s existing total helper, cover from `binder_cover.dart` / catalog `image_url`; grid order from [contracts/binders.md](./contracts/binders.md); local data only) in `apps/mobile/lib/features/binder/binder_grid.dart`
- [X] T032 [P] [US1] Implement the same tile contract in `apps/web/src/components/binder/BinderGrid.jsx` (web value = TCG Market total for that Binder’s rows)
- [X] T033 [US1] Extract the existing Binder list chrome (sort, qty, value overlay for the *open* Binder) into `apps/mobile/lib/features/binder/binder_list.dart` scoped to one `binderId` (do not retarget `binder_value_sheet.dart` to the whole grid)
- [X] T034 [US1] Make the Binder tab home the grid; tile pushes `binder_list.dart`; back returns to the grid (Want List tab index unchanged); no account gate in `apps/mobile/lib/features/binder/binder_screen.dart`
- [X] T035 [US1] Make `/binder` (`isWanted === false`) grid-first with drill-in to the current list chrome and back to the grid in `apps/web/src/pages/BinderCollection.jsx` (do not change signed-out `/binder` into an on-device Binder; do not turn `/wants` into a Binder grid)
- [X] T036 [US1] Pass `binderId` into add: open Binder if one is drilled in, else Trade Binder (`system:trade`) from `apps/mobile/lib/app/card_actions.dart`, `apps/mobile/lib/features/card_detail/card_detail_screen.dart`, `apps/mobile/lib/features/scan/scan_screen.dart`, and `apps/mobile/lib/features/paywall/pro_limits.dart` (`addToBinderOrUpsell`); Want List adds still set `isWanted`
- [X] T037 [US1] Same add-target rule (open Binder vs Trade Binder from the grid) in `apps/web/src/components/cardDetail/CardDetailModal.jsx` and `apps/web/src/pages/BinderCollection.jsx`
- [X] T038 [US1] Scope `BinderNotifier.add` / qty / identity to `(printing, binderId, condition)` and count free `binderCards` across all owned Binders in `apps/mobile/lib/core/providers.dart`
- [X] T039 [US1] Scope `upsertEntry` the same way (owned unique includes `binder_id` + condition; distinct owned count across Binders) in `apps/web/src/services/binder.js`

**Checkpoint**: User Story 1 is fully functional and testable independently (grid + two defaults + drill-in + migration). Want List still uses today’s entry; create/move not required yet

---

## Phase 4: User Story 2 - Reach Want List without losing it (Priority: P1)

**Goal**: Want List stays a sibling of the Binder grid — one obvious step, not a Binder tile, and never mixed into tile counts or values

**Independent Test**: From the Binder grid, open Want List without opening a Binder. Confirm it is the existing Want List (not a Binder named Want List). Return to the grid. Want List cards do not change any Binder tile’s count or value.

### Tests for User Story 2 ⚠️

- [X] T040 [P] [US2] Extend `apps/mobile/test/widgets/binder_grid_test.dart`: Binder | Want List tabs still present; Want List is not a grid tile; Want List rows do not affect Trade Binder / Collection count or value; returning from Want List shows the grid (or the Want List tab), not a blank Binder
- [X] T041 [P] [US2] Extend `apps/web/tests/components/BinderGrid.test.jsx`: `/wants` is unchanged list chrome; `/binder` grid has no Want List tile; Header still links Want List in one step

### Implementation for User Story 2

- [X] T042 [US2] Keep the Want List tab as index 1 (sibling, not a tile) and keep `apps/mobile/lib/features/want_list/want_list_screen.dart` wired from `apps/mobile/lib/features/binder/binder_screen.dart`
- [X] T043 [P] [US2] Keep `/wants` and the Want List nav item in `apps/web/src/App.jsx` and `apps/web/src/components/elements/Header.jsx` (Binder dest = `/binder` grid; Want List remains a sibling route)
- [X] T044 [US2] Leave the `isWanted === true` path as the existing Want List (no Binder tiles, no move-into-Want-List) in `apps/web/src/pages/BinderCollection.jsx`

**Checkpoint**: User Stories 1 and 2 both work; Want List is reachable in one step and is not a Binder

---

## Phase 5: User Story 3 - Move cards between Binders (Priority: P2)

**Goal**: From an open Binder list, move some or all copies of a Printing into another live Binder. Source decreases, destination merges on printing+condition, tiles update. Want List is not a destination. Shared `binderCards` cap does not refuse a valid move.

**Independent Test**: Qty 3 in Trade Binder; move 2 to Collection → Trade Binder 1, Collection 2; counts and values match. Destination already having that Printing+condition merges. Want List is not offered as a destination.

### Tests for User Story 3 ⚠️

- [X] T045 [P] [US3] Write failing contract tests that load `binder_move.json` via `apps/mobile/test/contracts/contract_fixtures.dart` in `apps/mobile/test/contracts/binder_move_contract_test.dart` using catalog-shaped rows
- [X] T046 [P] [US3] Write failing contract tests that import `packages/contracts/binder_move.json` in `apps/web/tests/contracts/binderMove.contract.test.js`
- [X] T047 [P] [US3] Widget tests in `apps/mobile/test/widgets/binder_grid_test.dart` (or `apps/mobile/test/widgets/binder_list_test.dart`): move 2 of 3 Trade Binder → Collection; merge on same printing+condition; Want List absent from destinations; tiles update count/value/cover
- [X] T048 [P] [US3] Page/component tests with the same move assertions in `apps/web/tests/components/BinderGrid.test.jsx`

### Implementation for User Story 3

- [X] T049 [US3] Implement `moveBinderCopies` (partial qty, merge printing+condition, refuse invalid qty / same Binder / non-live dest / Want List; never refuse for `binderCards`) in `apps/mobile/lib/core/logic/binder_move.dart` until T045 passes
- [X] T050 [P] [US3] Implement the same helper in `apps/web/src/utils/binderMove.js` until T046 passes
- [X] T051 [US3] Apply moves through `BinderNotifier` (source qty / delete at 0; dest upsert) in `apps/mobile/lib/core/providers.dart`
- [X] T052 [P] [US3] Apply moves (update/delete source + upsert dest; conflict on new owned unique) in `apps/web/src/services/binder.js`
- [X] T053 [US3] Add Move on an open owned Binder row (destination = other live Binders; qty 1…n) in `apps/mobile/lib/features/binder/binder_list.dart`
- [X] T054 [US3] Add the same Move control in `apps/web/src/pages/BinderCollection.jsx` (hidden on `/wants`)

**Checkpoint**: User Stories 1–3 work; Collection exists as a keep pile because stock can change Binders

---

## Phase 6: User Story 4 - Add, rename, and delete Binders (Priority: P3)

**Goal**: Create unique-named Binders up to 4 on free (5th shows Pro upgrade, creates nothing). Rename any Binder including Trade Binder (`role` stays `trade`). Delete Collection and user Binders only when empty. Trade Binder is never deletable.

**Independent Test**: Create “Side Event”, rename, delete while empty. Delete Trade Binder is refused and it stays on the grid. Free player with 4 Binders: 5th create shows Pro upgrade and still has exactly 4. Duplicate names (including `collection` vs `Collection`) refused.

### Tests for User Story 4 ⚠️

- [X] T055 [P] [US4] Write failing contract tests that load `binder_names.json` via `apps/mobile/test/contracts/contract_fixtures.dart` in `apps/mobile/test/contracts/binder_names_contract_test.dart`
- [X] T056 [P] [US4] Write failing contract tests that import `packages/contracts/binder_names.json` in `apps/web/tests/contracts/binderNames.contract.test.js`
- [X] T057 [P] [US4] Widget tests in `apps/mobile/test/widgets/binder_grid_test.dart`: unique create; rename collision refused; Trade Binder delete hidden or refused (empty or not); non-empty Collection delete refused; empty delete leaves the grid; 5th create on free calls `presentProPaywall` and does not add a Binder
- [X] T058 [P] [US4] Page/component tests with the same create/rename/delete/Pro assertions in `apps/web/tests/components/BinderGrid.test.jsx`

### Implementation for User Story 4

- [X] T059 [US4] Implement name normalize/uniqueness (trim + case-fold; own-name ok; empty invalid) in `apps/mobile/lib/core/logic/binder_names.dart` until T055 passes
- [X] T060 [P] [US4] Implement the same rules in `apps/web/src/utils/binderNames.js` until T056 passes
- [X] T061 [US4] Implement create / rename / delete on `BindersNotifier` in `apps/mobile/lib/core/providers.dart`: `canCreateBinder` for free; refuse `role=trade` delete; refuse delete when any live owned entry has `quantity ≥ 1`; tombstone otherwise; unique live names
- [X] T062 [P] [US4] Implement create / rename / delete Binders (same refusals; `behaviour.binders = "paywall"` creates no 5th row) in `apps/web/src/services/binder.js`
- [X] T063 [US4] Add create / rename / delete chrome on the grid; hide or no-op delete on Trade Binder; surface duplicate-name and non-empty-delete errors in `apps/mobile/lib/features/binder/binder_grid.dart` and `apps/mobile/lib/features/binder/binder_screen.dart`
- [X] T064 [US4] Add the same chrome in `apps/web/src/components/binder/BinderGrid.jsx` and `apps/web/src/pages/BinderCollection.jsx`
- [X] T065 [US4] On a free 5th create, call `presentProPaywall` (`trigger: 'binders_limit'`, do not write entitlements) from `apps/mobile/lib/features/binder/binder_screen.dart` using `apps/mobile/lib/features/paywall/pro_paywall.dart`; after Pro, retry create
- [X] T066 [US4] On a free 5th create, show the existing web Pro CTA (subscribe-in-app copy; no 5th row; do not write `entitlements`) in `apps/web/src/pages/BinderCollection.jsx`

**Checkpoint**: All four stories independently functional; Trade Binder cannot be deleted; names unique and syncable; 5th Binder is Pro

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Vocabulary, share surface, onboarding, and quickstart validation

- [X] T067 [P] Update Binder tour copy so the grid and Trade Binder vs Collection are mentioned, and Want List is not taught as a Binder, in `apps/mobile/lib/features/onboarding/tour_copy.dart` (`binderTabsBody` / related strings)
- [X] T068 Confirm labels use Binder / Trade Binder / Collection (name) / Printing / Want List (not “inventory”, not Want List as a Binder) in `apps/mobile/lib/features/binder/binder_grid.dart`, `apps/mobile/lib/features/binder/binder_list.dart`, `apps/web/src/components/binder/BinderGrid.jsx`, and `apps/web/src/pages/BinderCollection.jsx`
- [X] T069 [P] Keep public `/b/:token` as Trade Binder only (no Collection leak) in `apps/web/src/pages/SharedBinder.jsx` and `apps/web/src/services/binder.js` (`getPublicBinder`)
- [X] T070 Keep distinct-card overflow on the existing refuse + Upgrade snackbar path (not a mandatory paywall modal) in `apps/mobile/lib/features/paywall/pro_limits.dart` and the `/binder` card-cap Alert in `apps/web/src/pages/BinderCollection.jsx`; `paywall` is only for `binders`
- [X] T071 Run `cd apps/mobile && flutter test` and `cd apps/web && npm test`, then walk [quickstart.md](./quickstart.md) (grid + defaults + migration, Want List sibling, move 3→2+1, unique names, Trade Binder delete refusal, 5th Binder Pro upgrade, Confirm Trade / share / filler Trade Binder only, signed-out mobile, constitution + `docs/CONTEXT.md` vocabulary in this change)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational
  - US2 assumes the US1 grid exists (Want List is a sibling of that grid)
  - US3 assumes US1 drill-in list exists (move lives on an open Binder)
  - US4 assumes the US1 grid exists (create/rename/delete are grid actions)
  - US3 and US4 can proceed in parallel after US1 if staffed (move vs manage Binders — coordinate files `binder_list.dart` / `BinderCollection.jsx` / `providers.dart` / `binder.js`)
- **Polish (Phase 7)**: After desired stories are complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — MVP grid + two defaults + drill-in + migration
- **User Story 2 (P1)**: After US1 grid exists — Want List sibling; independently testable as “Want List still works”
- **User Story 3 (P2)**: After US1 list drill-in — move; helpers are new files and can start while US2 UI is in progress
- **User Story 4 (P3)**: After US1 grid — create/rename/delete + Pro on 5th; names helpers are new files

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Schema + Binder records + entry `binderId` (Phase 2) before any grid
- Cover helper (Phase 2) before tile images
- Move/name helpers before their UI
- Story complete before the next priority if one person is editing `binder_screen.dart` / `BinderCollection.jsx`

### Parallel Opportunities

- T001–T004 in parallel after planning cases
- T006, T007, T008 in parallel
- T010 and T011 in parallel after T009 (or alongside if the SQL shape is already specified)
- T018 and T019 in parallel; T020 and T021 after their failing tests
- T022 and T023 in parallel; T024 and T025 after their failing tests
- T026, T027, T028 in parallel (mobile confirm / web confirm / filler+share)
- T029 and T030 in parallel; T031 and T032 in parallel
- T040 and T041 in parallel
- T045 and T046 in parallel; T049 and T050 after those tests
- T047 and T048 in parallel; T053 and T054 in parallel (mobile vs web)
- T055 and T056 in parallel; T059 and T060 after those tests
- T057 and T058 in parallel; T063 and T064 in parallel
- T067, T069 can run beside T068

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Widget tests in apps/mobile/test/widgets/binder_grid_test.dart"
Task: "Component tests in apps/web/tests/components/BinderGrid.test.jsx"

# Grid chrome together:
Task: "Grid in apps/mobile/lib/features/binder/binder_grid.dart"
Task: "Grid in apps/web/src/components/binder/BinderGrid.jsx"
```

## Parallel Example: User Story 3

```bash
# After US1, move contract tests then helpers (mobile vs web in parallel):
Task: "binder_move.dart until apps/mobile/test/contracts/binder_move_contract_test.dart passes"
Task: "binderMove.js until apps/web/tests/contracts/binderMove.contract.test.js passes"
```

## Parallel Example: User Story 4

```bash
# Names helpers together, then grid manage chrome:
Task: "binder_names.dart in apps/mobile/lib/core/logic/binder_names.dart"
Task: "binderNames.js in apps/web/src/utils/binderNames.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (fixtures + README)
2. Complete Phase 2: Foundational (schema, seed/migrate, sync, cover, free-limit helpers, Trade Binder scoping)
3. Complete Phase 3: User Story 1 (grid of Trade Binder + Collection, drill-in, migration)
4. **STOP and VALIDATE**: Open Binder destination, see two tiles, open Trade Binder, back to grid; existing cards in Trade Binder
5. Demo if ready; Want List (US2) is the next P1 so it should follow before calling the Binder area done for players who use Want List today

### Incremental Delivery

1. Setup + Foundational → shared records, fixtures, Trade Binder safety
2. US1 → grid is the Binder home (MVP)
3. US2 → Want List still one step away
4. US3 → move between Binders
5. US4 → extra Binders, unique names, non-deletable Trade Binder, Pro on 5th
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With two developers after Foundational:

1. Developer A: mobile grid → Want List tab → move → manage (US1 → US4)
2. Developer B: web `/binder` grid → `/wants` sibling → move → manage
3. Integrate at `providers.dart` / `apps/web/src/services/binder.js` and the shared fixtures

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story
- Do not treat Want List as a Binder, invent signed-out web Binder, share Collection, auto-move Collection on Confirm Trade, write entitlements from the client, or invent prices
- Tile value reuses that Binder’s existing total; cover ranking uses the same source
- `free_limits.json` is data-loss-sensitive — fix the implementation that drifted, not the fixture, unless the product decision changed
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
