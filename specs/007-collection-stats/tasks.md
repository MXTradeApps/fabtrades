---

description: "Task list for Binder Collection Stats implementation"
---

# Tasks: Binder Collection Stats

**Input**: Design documents from `/specs/007-collection-stats/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. [plan.md](./plan.md) requires widget/page tests for the Collection Stats button (label only; hidden when empty / Want List), page open/back, per-Binder movers (ids from this Binder only; copies joined from qty), overlay/sheet gone, and Home/Trends catalog-wide only. Reuse `packages/contracts/binder_value_snapshot.json` and `packages/contracts/recent_movers.json` — do **not** add a third ranking fixture. Suites: `cd apps/web && npm test`; `cd apps/mobile && flutter test`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Shared fixtures: `packages/contracts/` (`binder_value_snapshot.json` and `recent_movers.json` **UNCHANGED**)
- Schema: none — no new migration; reuse `fab_recent_movers`
- Mobile page: `apps/mobile/lib/features/binder/collection_stats_screen.dart` (NEW)
- Mobile Binder: `apps/mobile/lib/features/binder/binder_screen.dart`
- Mobile overlay: `apps/mobile/lib/features/binder/binder_value_sheet.dart` (DELETE)
- Mobile movers landing: `apps/mobile/lib/features/search/search_screen.dart`, `apps/mobile/lib/features/search/recent_movers_section.dart`, `apps/mobile/lib/features/search/mover_box.dart`
- Mobile helpers / RPC: `apps/mobile/lib/core/logic/binder_value_snapshot.dart`, `apps/mobile/lib/core/logic/recent_movers.dart`, `apps/mobile/lib/core/data/card_repository.dart`
- Web page: `apps/web/src/pages/CollectionStats.jsx` (NEW)
- Web Binder: `apps/web/src/pages/BinderCollection.jsx`, `apps/web/src/App.jsx` (`/binder/stats`)
- Web overlay: `apps/web/src/components/binder/BinderValueDialog.jsx` (DELETE)
- Web movers landing: `apps/web/src/pages/Trends.jsx`, `apps/web/src/components/movers/RecentMoversSection.jsx`, `apps/web/src/components/movers/MoverBox.jsx`
- Web helpers / RPC: `apps/web/src/utils/binderValueSnapshot.js`, `apps/web/src/utils/recentMovers.js`, `apps/web/src/services/fabDb.js`
- Web chrome: `apps/web/src/components/elements/Header.jsx` (**no** Collection Stats hamburger item)
- Tests: `apps/mobile/test/` and `apps/web/tests/`

## Constitution

Touches **I** (reuse snapshot helper + existing RPC; delete overlay and owned Home/Trends section; no value-history table, no second ranker, no hamburger Collection destination, no fifth tab), **II** (headline is chosen-source current total; snapshot field totals stay observed Market/Low/Trend; Binder movers are `p_card_ids` of **this** Binder; `ownedPrintingIds` still means qty > 0, not Want List — callers filter the list), **III** (bad `p_source` errors; unpriced is `—` never `$0`/`€0`; movers error is retry on that slot only), **IV** (keep `binder_value_snapshot.json` and `recent_movers.json`; no Collection-Stats-only fork), **V** (pipeline unchanged; apps only SELECT / RPC-read). Also: table is the deadline (one tap from Binder, one back), no gate before value (signed-out mobile inspect; web keeps today’s `/binder` account rule), one brand two peer surfaces (mobile pushed screen vs web `/binder/stats`), vocabulary (Binder tab stays Binder; **Collection Stats** is the button/page label; Collection remains a keep-pile *name*; Want List is not a Binder), real prices or nothing, local reads (snapshot from Binder + catalog already in memory; movers fetch is sibling), dual-client DRY (shared fixtures + one SQL ranker).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Keep shared math in the existing goldens. Collection Stats composes them; it does not invent a third ranking or snapshot fixture.

- [X] T001 Confirm `packages/contracts/README.md` still lists only `binder_value_snapshot.json` and `recent_movers.json` for this feature’s math (web `apps/web/src/utils/binderValueSnapshot.js` + `apps/web/src/utils/recentMovers.js`; mobile `apps/mobile/lib/core/logic/binder_value_snapshot.dart` + `apps/mobile/lib/core/logic/recent_movers.dart`). Add a one-line note that Collection Stats reuses those two files and MUST NOT add a Collection-Stats ranking golden. Do not create `packages/contracts/collection_stats.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Display-only helpers and extracted snapshot chrome so user stories compose existing snapshot + RPC without forking math or losing overlay UI when the sheet/dialog is deleted.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Add `copiesByPrintingId(entries)` in `apps/mobile/lib/core/logic/recent_movers.dart` that sums `quantity` per Printing id for a **pre-filtered** Binder list (display only; not a rank key; not sent to SQL). Document that callers MUST filter to the open Binder first and MUST NOT change `ownedPrintingIds` to take a binder id. Extend `apps/mobile/test/core/logic/recent_movers_test.dart`: two condition rows for one Printing sum; Want List / qty 0 omitted; do not alter `owned_id_cases` in `packages/contracts/recent_movers.json`
- [X] T003 [P] Add the same `copiesByPrintingId` helper in `apps/web/src/utils/recentMovers.js` and extend `apps/web/tests/utils/recentMovers.test.js` with the same cases. Keep `ownedPrintingIds` signature and `recent_movers.json` owned-id cases unchanged
- [X] T004 [P] Extract marketplace totals, stock counts, unpriced gaps, and top-five rows from `apps/mobile/lib/features/binder/binder_value_sheet.dart` into `apps/mobile/lib/features/binder/binder_snapshot_section.dart` (takes `BinderValueSnapshot` + formatters; no sheet chrome, no headline). Point the existing sheet at the extracted widget so snapshot tests still pass until US1 deletes the sheet
- [X] T005 [P] Extract the same snapshot body from `apps/web/src/components/binder/BinderValueDialog.jsx` into `apps/web/src/components/binder/BinderSnapshotSection.jsx` and point the dialog at it. Contribution formatting MUST follow the snapshot’s chosen-source headline (not a hardcoded TCG-Market USD). Unpriced remains `—`, never `$0.00` / `€0.00`

**Checkpoint**: Foundation ready — `copiesByPrintingId` exists on both clients; snapshot chrome can live without overlay wrappers; `flutter test` / `npm test` still pass existing snapshot and recent-movers goldens; no Collection Stats page yet

---

## Phase 3: User Story 1 - Open Collection Stats from the Binder (Priority: P1) 🎯 MVP

**Goal**: Replace the floating Binder-value total with a **Collection Stats** button (label only, no currency). Activating it opens a **new page** for the currently open Binder that names that Binder and shows its **current total value** (chosen price source, quantity-weighted, unpriced omitted). Back restores the same Binder, list, and scroll. Empty Binder and Want List hide the button. The Binder-value overlay is deleted. No value-over-time chart. No fifth tab. No hamburger Collection destination.

**Independent Test**: With a non-empty Binder, the floating/header total is gone, a Collection Stats button is in its place with no dollar figure, activating it opens a distinct page (not a sheet/dialog over the list), the current total matches that Binder under Settings, and leaving restores the Binder unchanged. Empty Binder: no button. Want List: no button. Overlay cannot be reopened.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T006 [P] [US1] Replace overlay-entry cases in `apps/mobile/test/widgets/binder_value_sheet_test.dart` by moving them to `apps/mobile/test/widgets/collection_stats_test.dart`: non-empty Binder shows a Collection Stats control (`Key('collectionStatsButton')` or equivalent) with visible text **Collection Stats** and **no** currency; activating it pushes a Collection Stats page (not a modal sheet); page shows the Binder name and current total (`Key('collectionStatsHeadline')`) using the chosen source; back restores the same Binder list; empty Binder hides the button; Want List tab has no button; no `binderValueChip` / `showBinderValueSheet` left
- [X] T007 [P] [US1] Replace overlay-entry cases in `apps/web/tests/components/BinderValueDialog.test.jsx` with `apps/web/tests/pages/CollectionStats.test.jsx` (and BinderCollection entry cases in that file or `apps/web/tests/pages/BinderCollection.test.jsx`): `/binder` shows `data-testid="collection-stats"` labeled **Collection Stats** with no currency; click navigates to `/binder/stats` (no dialog); page shows Binder name + current total (`data-testid="collection-stats-headline"`); back returns to `/binder` with the same list; `/wants` has no Collection Stats control; empty open Binder has no button; dialog/`binder-value-total` gone
- [X] T008 [P] [US1] Update `apps/mobile/test/widgets/binder_grid_test.dart` and `apps/web/tests/components/BinderGrid.test.jsx` so opening a non-empty Binder list expects the Collection Stats button instead of `binderValueChip` / `binder-value-total`. Grid tiles may still show per-Binder tile value; the open-list header MUST NOT show a running total

### Implementation for User Story 1

- [X] T009 [P] [US1] Create `apps/mobile/lib/features/binder/collection_stats_screen.dart`: pushed `ConsumerWidget` titled **Collection Stats**, shows the open Binder’s name, computes current total via existing `snapshotForBinder` / `pricing` with `BinderValueHeadline.pricingValue` (open Binder only, Want List excluded), formats with existing `Pricing`; unpriced copies MUST NOT render as `$0.00` / `€0.00` on the headline; no Binder mutations; no value-over-time chart; leave/back pops the Binder tab stack
- [X] T010 [P] [US1] Create `apps/web/src/pages/CollectionStats.jsx`: title **Collection Stats**, reads `getOpenBinderId()` / `targetOwnedBinderId()` from `apps/web/src/utils/openBinder.js` plus `getBinderEntries` filtered to that id and live catalog; headline uses `buildBinderValueSnapshot(..., { headline: "pricingValue" })` (not TCG-Market-only); same unpriced rule; document title via existing `useDocumentHead`; no Binder edits
- [X] T011 [US1] Register `<Route path="/binder/stats" element={<CollectionStats />} />` in `apps/web/src/App.jsx` next to `/binder`. Direct load with an empty open Binder MUST send the player back to `/binder` (no dead empty stats landing). Signed-out uses the same gate as `/binder` — do not invent a local web Binder. Do not add a `netlify.toml` redirect. Do not add `/binder/stats` to `apps/web/scripts/generateSeoPages.js`
- [X] T012 [US1] Replace `_BinderValueChip` in `apps/mobile/lib/features/binder/binder_screen.dart` with a **Collection Stats** button (keep `OnboardingKeys.binderTotal` on that control). Visible text and accessible name are **Collection Stats** only — do not pass `formatValue(binderTotal)`. `onTap` pushes T009 (`Navigator.push` on the Binder tab, not a fifth tab). Hide when the open Binder is empty or the Want List tab is selected. Remove the running total from the FAB row / app bar. Add-card FAB stays
- [X] T013 [US1] Replace `data-testid="binder-value-total"` in `apps/web/src/pages/BinderCollection.jsx` with a **Collection Stats** button (`data-testid="collection-stats"`) that navigates to `/binder/stats` when `isWanted === false`, not showing grid-only chrome, and `entries.length > 0`. Do not display `formatCurrency(totalValue)` on Binder (list or grid header). Do not wire `/wants`. Do not touch `apps/web/src/pages/SharedBinder.jsx`. Remove `valueOpen` / `BinderValueDialog` usage
- [X] T014 [P] [US1] Delete `apps/mobile/lib/features/binder/binder_value_sheet.dart` (`showBinderValueSheet` / `BinderValueSheet`) and every remaining caller. Collection Stats is the only Binder-value inspect surface
- [X] T015 [P] [US1] Delete `apps/web/src/components/binder/BinderValueDialog.jsx` and leftover `valueOpen` / `binder-value-total` / `binder-value-headline` entry points. No deep link or header action may reopen the overlay
- [X] T016 [P] [US1] Rewrite `TourCopy.binderTotalTitle` / `binderTotalBody` in `apps/mobile/lib/features/onboarding/tour_copy.dart` to describe Collection Stats (not a green running total or overlay). Keep `OnboardingKeys.binderTotal` so completed tours do not re-fire. After the tour, that control MUST open T009, not a deleted sheet
- [X] T017 [US1] Confirm `apps/web/src/components/elements/Header.jsx` has **no** Collection / Collection Stats hamburger item (My Binders still goes to `/binder` only). Binder tab / destination labels stay **Binder**. Wire T009–T016 until T006, T007, and T008 pass. Signed-out mobile with on-device Binder cards can open Collection Stats with no account wall

**Checkpoint**: User Story 1 is fully functional and testable independently (button + page + headline + overlay gone). Movers and snapshot body not required yet (US2 / US3)

---

## Phase 4: User Story 2 - See top movers within this Binder (Priority: P2)

**Goal**: Collection Stats shows top gainers and losers among Printings in **this** Binder only, ranked by percent Low change via existing `fab_recent_movers` (same window, floor, outlier caps, 10-per-side as catalog-wide). Rows show identity, copies in this Binder, current Low, percent, and currency amount. Copies do not affect rank. Selecting a row opens existing card details. Home / Trends become **catalog-wide only** — owned movers section deleted.

**Independent Test**: Put qualifying Printings in Binder A only. Collection Stats from A can list them; Collection Stats from Binder B (empty of those cards) does not. A catalog-wide gainer not in this Binder is absent. Copies appear on the row. Home / Trends show catalog-wide movers only in every Binder state (empty, partial, full).

### Tests for User Story 2 ⚠️

- [X] T018 [P] [US2] Extend `apps/mobile/test/widgets/collection_stats_test.dart`: RPC is called with this Binder’s Printing ids only (`CardRepository.recentMovers(source, {cardIds: thisBinderIds})`); a catalog-wide gainer not in this Binder is absent; a Printing in Binder A does not appear on Binder B’s page; each row shows name, set, finish, copies (T002 join), current Low, percent, currency amount; gainers vs losers distinct; tap opens existing `CardDetailScreen` for that `card_id`; empty ids → no RPC, honest empty copy, headline still visible; RPC `[]` with ids → honest empty, no `$0.00` row; fetch error → retry on movers only, headline still visible; Want List ids never sent
- [X] T019 [P] [US2] Extend `apps/web/tests/pages/CollectionStats.test.jsx`: `recentMovers(source, thisBinderIds)` from `apps/web/src/services/fabDb.js`; same this-Binder / copies / details / empty / error assertions; signed-in owner only (same `/binder` gate)
- [X] T020 [P] [US2] Flip owned-section cases in `apps/mobile/test/widgets/home_movers_test.dart` to catalog-wide only in every Binder state: no `Your recent movers`, no owned empty copy, no owned teaser, whether Binders are empty or full; catalog-wide movers, catalog search, and the set list below still work; owned error cases that assumed an owned slot are removed
- [X] T021 [P] [US2] Flip owned-section cases in `apps/web/tests/pages/Trends.test.jsx` the same way: signed-in with Binder entries still catalog-wide only; signed-out still catalog-wide with no owned section; `/sets` still has no movers. Remove assertions that owned lists appear first

### Implementation for User Story 2

- [X] T022 [P] [US2] Add an optional copies/quantity line to `apps/mobile/lib/features/search/mover_box.dart` (display only; omit when null). Do not change ranking chrome on Home
- [X] T023 [P] [US2] Add the same optional copies line to `apps/web/src/components/movers/MoverBox.jsx`
- [X] T024 [US2] On `apps/mobile/lib/features/binder/collection_stats_screen.dart`, filter live entries to the open Binder, call `ownedPrintingIds` on that list, skip RPC when ids are empty, otherwise call existing `CardRepository.recentMovers(source, {cardIds})`. Join copies via T002. Render gainers/losers with T022 (reuse movers visual language; do **not** show catalog-wide movers). Loading / empty / error+retry on this slot only — headline (and later snapshot) stay. Ignore stale responses after marketplace change or unmount. Invalid source must surface as error, no TCG fallback
- [X] T025 [P] [US2] Do the same on `apps/web/src/pages/CollectionStats.jsx` using `ownedPrintingIds` + `recentMovers` in `apps/web/src/services/fabDb.js` and T003 / T023. In-memory cache keyed by `(source, sorted this-Binder ids)` is allowed; do not persist
- [X] T026 [US2] On mover-row select, open that Printing’s existing details: mobile `apps/mobile/lib/features/card_detail/card_detail_screen.dart` keyed by `card_id`; web catalog lookup + existing `openDetail` from `apps/web/src/contexts/CardDetailContext.jsx`. Back returns to Collection Stats. Do not synthesize a card from RPC identity fields alone
- [X] T027 [US2] Stop computing `ownedPrintingIds` for the movers landing in `apps/mobile/lib/features/search/search_screen.dart`. Make `apps/mobile/lib/features/search/recent_movers_section.dart` catalog-wide only: one `recentMovers(source)` call (`p_card_ids` omitted), drop `ownedIds`, owned fetch, owned empty state, and owned teaser
- [X] T028 [US2] Stop loading Binder ids for owned movers in `apps/web/src/pages/Trends.jsx`. Make `apps/web/src/components/movers/RecentMoversSection.jsx` catalog-wide only (drop `ownedIds` and owned UI). Until T018–T021 pass: Collection Stats MUST NOT show catalog-wide movers; Home/Trends MUST NOT keep a partial owned list or link-out to Collection Stats

**Checkpoint**: User Stories 1 and 2 both work; this-Binder movers live on Collection Stats; Home/Trends are catalog-wide only

---

## Phase 5: User Story 3 - See snapshot stats that explain the current total (Priority: P3)

**Goal**: Collection Stats also shows the retired overlay’s snapshot: quantity-weighted TCGplayer Market/Low (USD) and CardMarket Trend/Low (EUR), copies / distinct Printings / foil vs Regular, unpriced counts per marketplace, and up to five Printings by contribution to the chosen-source headline. Both marketplaces appear regardless of Settings. Unpriced is omitted, never zero. No Binder value-over-time series.

**Independent Test**: Open Collection Stats on a Binder with mixed priced, unpriced, foil, and Regular copies. Four marketplace totals, counts, unpriced gaps, and top-by-value list reconcile against the Binder list. Changing Settings source refreshes headline and top-five; field totals stay observed Market/Low/Trend.

### Tests for User Story 3 ⚠️

- [X] T029 [P] [US3] Move snapshot assertions from the deleted `apps/mobile/test/widgets/binder_value_sheet_test.dart` onto `apps/mobile/test/widgets/collection_stats_test.dart`: TCG Market/Low USD, CardMarket Trend/Low EUR, unpriced `—` never `$0.00`/`€0.00`, copies / distinct Printings / foil / Regular (foil + Regular = copies), top five by chosen-source contribution with no padding. Headline still uses Settings source. No chart/sparkline finder
- [X] T030 [P] [US3] Move the same snapshot assertions from deleted `apps/web/tests/components/BinderValueDialog.test.jsx` onto `apps/web/tests/pages/CollectionStats.test.jsx`. Contribution currency follows the chosen source (not a leftover TCG-Market-only header). Delete `BinderValueDialog.test.jsx` once no overlay cases remain

### Implementation for User Story 3

- [X] T031 [P] [US3] Mount T004 `binder_snapshot_section.dart` on `apps/mobile/lib/features/binder/collection_stats_screen.dart` below movers (or below headline if movers are empty): `snapshotForBinder` with `headline: BinderValueHeadline.pricingValue`, open-Binder rows only. Credit that values are observed catalog numbers. Labels: TCGplayer, CardMarket, Market, Low, Trend. Top-five rows MAY open that Printing’s details. No value-over-time chart
- [X] T032 [P] [US3] Mount T005 `BinderSnapshotSection.jsx` on `apps/web/src/pages/CollectionStats.jsx` with `buildBinderValueSnapshot(..., { headline: "pricingValue" })`. Same labels, unpriced rule, optional top-five → `openDetail`. Settings marketplace change MUST refresh movers (US2) and chosen-source change MUST refresh headline + top-five; ignore stale fetches
- [X] T033 [US3] Confirm movers error/empty still leaves snapshot + headline usable (SC-013) in both Collection Stats pages until T029 and T030 pass. Delete leftover overlay test files. Do not re-derive field math in the page widget

**Checkpoint**: All three user stories independently functional; Collection Stats is the only Binder-value breakdown; overlay unreachable (SC-015)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Vocabulary, leftover tests, SEO/nav isolation, and quickstart validation

- [X] T034 [P] Confirm player-facing copy uses **Collection Stats** for the button/page only; Binder tab/destination stays **Binder**; Collection remains allowed as the keep-pile *name*; Want List is not a Binder; movers stay **recent movers** (not weekly) in `apps/mobile/lib/features/binder/collection_stats_screen.dart`, `apps/mobile/lib/features/binder/binder_screen.dart`, `apps/mobile/lib/features/onboarding/tour_copy.dart`, `apps/web/src/pages/CollectionStats.jsx`, `apps/web/src/pages/BinderCollection.jsx`, and `apps/web/src/components/elements/Header.jsx`
- [X] T035 [P] Confirm `apps/web/src/components/elements/Header.jsx` still has no Collection Stats item; optionally treat `/binder/stats` as Binder chrome for the My Binders highlight (`path.startsWith('/binder')`) without adding a nav destination. Confirm `apps/web/scripts/generateSeoPages.js` does not emit `/binder/stats`
- [X] T036 [P] Grep `apps/mobile/` and `apps/web/` for leftover `binderValueChip`, `binder-value-total`, `BinderValueDialog`, `showBinderValueSheet`, `Your recent movers`, and overlay routes; update `apps/mobile/test/widgets/app_smoke_test.dart` / `apps/mobile/integration_test/app_test.dart` if they still expect the green total
- [X] T037 Confirm `packages/contracts/binder_value_snapshot.json` and `packages/contracts/recent_movers.json` (and `printing_recent_changes.json`) still pass both suites with no Collection-Stats-only fork
- [X] T038 Run `cd apps/mobile && flutter test` and `cd apps/web && npm test`, then walk [quickstart.md](./quickstart.md) (label-only button, page + headline, this-Binder movers, snapshot honesty, overlay gone, Home/Trends catalog-wide only, back restores Binder, no hamburger Collection Stats)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories SHOULD proceed in priority order (P1 → P2 → P3) because US2/US3 mount onto the US1 page
  - US2 and US3 can be staffed in parallel **after** US1’s page shell exists (T009/T010)
- **Polish (Phase 6)**: Depends on the user stories intended to ship

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on US2/US3. Overlay deletion is part of US1
- **User Story 2 (P2)**: Needs the US1 page to host Binder movers. Landing owned-section removal (T027/T028) can start in parallel with page movers once T006–T008 are in place, but do not ship Home/Trends owned-gone without Collection Stats movers if that would leave players with nowhere to see owned movement
- **User Story 3 (P3)**: Needs the US1 page to host T004/T005 snapshot chrome. Independently testable once mounted; does not require US2 except for “movers error leaves snapshot usable”

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Display helpers (Phase 2) before page movers
- Page shell (US1) before movers (US2) and snapshot body (US3)
- Overlay files deleted in US1 after T004/T005 extraction so snapshot UI is not lost
- Story complete before moving to the next priority unless staffing US2/US3 in parallel on different files

### Parallel Opportunities

- T002 and T003 (copies helpers) can run in parallel
- T004 and T005 (snapshot extraction) can run in parallel
- T006, T007, T008 (US1 tests) can run in parallel
- T009 and T010 (page shells) can run in parallel; T014/T015/T016 after the Binder screens stop calling the overlay
- T018–T021 (US2 tests) can run in parallel
- T022 and T023 (MoverBox copies) can run in parallel
- T024 and T025 (page movers) can run in parallel after T022/T023
- T027 and T028 (landing owned-gone) can run in parallel
- T029 and T030 (US3 tests) can run in parallel; T031 and T032 can run in parallel
- T034, T035, T036 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together:
Task: "Widget tests in apps/mobile/test/widgets/collection_stats_test.dart"
Task: "Page tests in apps/web/tests/pages/CollectionStats.test.jsx"
Task: "Update binder_grid_test.dart and BinderGrid.test.jsx chip → Collection Stats"

# Launch both page shells together:
Task: "Create apps/mobile/lib/features/binder/collection_stats_screen.dart"
Task: "Create apps/web/src/pages/CollectionStats.jsx"
```

## Parallel Example: User Story 2

```bash
# Launch landing-owned-gone tests together:
Task: "Flip apps/mobile/test/widgets/home_movers_test.dart to catalog-wide only"
Task: "Flip apps/web/tests/pages/Trends.test.jsx to catalog-wide only"

# Launch MoverBox copies together:
Task: "Optional copies on apps/mobile/lib/features/search/mover_box.dart"
Task: "Optional copies on apps/web/src/components/movers/MoverBox.jsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — extract snapshot chrome before deleting overlays)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Button, page, headline, back-stack, overlay gone, empty/Want List hidden
5. Demo if ready — marketplace snapshot and Binder movers are not in this increment

### Incremental Delivery

1. Complete Setup + Foundational → helpers + extracted snapshot chrome
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: Collection Stats page + current total)
3. Add User Story 2 → this-Binder movers + Home/Trends catalog-wide only → Deploy/Demo
4. Add User Story 3 → snapshot stats on the same page → Deploy/Demo
5. Each story adds value without restoring the overlay or the owned landing section

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. After Foundational:
   - Developer A: User Story 1 (entry + page + overlay delete)
3. After US1 page shell:
   - Developer B: User Story 2 (Binder movers + landing owned-gone)
   - Developer C: User Story 3 (snapshot body on the page)
4. Polish together (T034–T038)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Do not add SQL, a value-history table, a fifth tab, a hamburger Collection item, or a Collection-Stats ranking fixture
- Avoid: putting currency on the Collection Stats button, keeping the overlay as a second surface, ranking Binder movers by copies or dollar impact, leaving owned movers on Home/Trends
