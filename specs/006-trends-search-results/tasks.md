---

description: "Task list for trends search results as mover boxes"
---

# Tasks: Trends Search Results as Mover Boxes

**Input**: Design documents from `/specs/006-trends-search-results/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. [plan.md](./plan.md) and constitution IV require `packages/contracts/printing_recent_changes.json` asserted by both `apps/mobile` (`flutter test`) and `apps/web` (`npm test`). Page/widget tests: Trends search → trend boxes with overlay when displayable; Browse Sets search → still list; Home global search → boxes with existing sort; in-set search → list; clear search restores ranked movers; under-floor match still shows change; no overlay omits the change line (not 0% / dash / copy). Ranking fixture `recent_movers.json` must stay green.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Shared fixtures: `packages/contracts/`
- Schema: `supabase/migrations/`
- Web Trends search: `apps/web/src/pages/Trends.jsx` (boxes, not list)
- Web Browse Sets: `apps/web/src/pages/SetList.jsx` + `apps/web/src/components/search/CatalogPrintingResults.jsx` (**list unchanged**)
- Web movers chrome: `apps/web/src/components/movers/`
- Web catalog RPC: `apps/web/src/services/fabDb.js`
- Web helpers: `apps/web/src/utils/recentMovers.js`
- Mobile Home search: `apps/mobile/lib/features/search/search_screen.dart`
- Mobile movers chrome: `apps/mobile/lib/features/search/recent_movers_section.dart`
- Mobile helpers / RPC: `apps/mobile/lib/core/logic/recent_movers.dart`, `apps/mobile/lib/core/data/card_repository.dart`
- Tests: `apps/mobile/test/` and `apps/web/tests/`

## Constitution

Touches **I** (lookup RPC for ids already on screen; do not overload `fab_recent_movers`; do not put boxes on Browse Sets), **II** (lookup vs rank; overlay vs catalog Printing), **III** (invalid `p_source` / `NULL` ids error; missing change omitted not `$0` / `0%`), **IV** (`printing_recent_changes.json`; both suites assert it; ranking fixture unchanged), **V** (pipeline unchanged). Also: no gate before value, one brand two peer surfaces (Trends/Home boxes; Browse Sets / in-set stay lists), real prices or nothing (under-floor still shows a real move), local reads (boxes paint from catalog; lookup is sibling), dual-client DRY (fixture + SQL).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Golden overlay cases so JS, Dart, and SQL cannot invent a floor, top-10 cut, or fake 0% on search matches

- [X] T001 Create `packages/contracts/printing_recent_changes.json` from [contracts/printing-recent-changes.md](./contracts/printing-recent-changes.md) with explicit `today`, requested `card_ids`, `lookup_cases` (TCG vs CM columns, null Low skipped not zeroed, most-recent Low in the 3–5 day band, 2-day and 6-day starts omitted, start Low `0.30`→`0.60` **included**, `2.00`→`2.00` omitted, outlier / Low above 10000 omitted, id not in the requested set omitted). Each expected overlay includes `card_id`, `start_on`, `start_low`, `latest_low`, `percent_change`, `amount_change`. Do not put ranking or `$1` floor cases here
- [X] T002 [P] Add `printing_recent_changes.json` to the files table in `packages/contracts/README.md` (web `apps/web/src/utils/recentMovers.js`; mobile `apps/mobile/lib/core/logic/recent_movers.dart`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Public lookup RPC, shared helpers that match the fixture, and catalog read clients. Search-box UI only merges these overlays onto catalog Printings.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add `supabase/migrations/YYYYMMDDHHMMSS_fab_printing_recent_changes.sql` implementing `public.fab_printing_recent_changes(p_source text, p_card_ids text[])` per [contracts/printing-recent-changes-read.md](./contracts/printing-recent-changes-read.md) and [data-model.md](./data-model.md): `SECURITY INVOKER` `STABLE`; `p_source` only `tcgplayer`|`cardmarket` else error; `p_card_ids` `NULL` errors (do not catalog-scan); empty array → zero rows; `CURRENT_DATE` window `[today-5, today-3]`; start = most recent non-null marketplace Low in that band; latest = `fab_card_prices` Low; **no** `$1` floor; **no** top-10; **no** sealed extra-filter; omit 0%, missing window, null latest, outliers (`Low > 10000` or `abs(percent) > 10`); one row per requested id that qualifies; `GRANT EXECUTE` to `anon` and `authenticated`; comment that SQL must match `packages/contracts/printing_recent_changes.json` and must **not** change `fab_recent_movers`
- [X] T004 [P] Write failing contract tests that load `printing_recent_changes.json` via `apps/mobile/test/contracts/contract_fixtures.dart` in `apps/mobile/test/contracts/printing_recent_changes_contract_test.dart` (assert `lookup_cases`; under-floor included; 0%/missing/outlier omitted; never coerce null Low to 0)
- [X] T005 [P] Write failing contract tests that import `packages/contracts/printing_recent_changes.json` in `apps/web/tests/contracts/printingRecentChanges.contract.test.js`
- [X] T006 Implement overlay lookup (no floor, no rank cut) in `apps/mobile/lib/core/logic/recent_movers.dart` until T004 passes; extend `apps/mobile/test/core/logic/recent_movers_test.dart` — names must distinguish start Low vs latest Low vs derived change; existing ranking helpers and `recent_movers.json` tests MUST still pass
- [X] T007 [P] Implement the same lookup helper in `apps/web/src/utils/recentMovers.js` until T005 passes; extend `apps/web/tests/utils/recentMovers.test.js` — do not change `rankRecentMovers` floor/top-10 behavior
- [X] T008 [P] Add `printingRecentChanges(source, cardIds)` in `apps/mobile/lib/core/data/card_repository.dart` calling `supabase.rpc('fab_printing_recent_changes', …)` per [contracts/printing-recent-changes-read.md](./contracts/printing-recent-changes-read.md); map snake_case rows; do not default a bad source; do not call `fab_recent_movers` for this path
- [X] T009 [P] Add `printingRecentChanges(source, cardIds)` POST to `/rest/v1/rpc/fab_printing_recent_changes` in `apps/web/src/services/fabDb.js` (same publishable-key `restFetch` POST family as `recentMovers`; JSON body; do not use the auth `supabase-js` client)
- [X] T010 Unit-test the web lookup path (URL, body `p_source` / `p_card_ids`, error on non-OK, reject `null` ids) in `apps/web/tests/services/fabDb.printingRecentChanges.test.js`
- [X] T011 Stub `printingRecentChanges` on `MockCardRepository` (default `[]`; optional map/error like `recentMovers`) in `apps/mobile/test/support/harness.dart` so later widget tests do not hit Supabase

**Checkpoint**: Foundation ready — `flutter test` / `npm test` pass the new fixture **and** `recent_movers.json`; RPC exists; clients can fetch overlay rows; search UI still the old list

---

## Phase 3: User Story 1 - Search on Trends and see matching cards as trend boxes (Priority: P1) 🎯 MVP

**Goal**: Catalog search on the movers landing (web **Trends**; mobile **Home**) presents matching Printings as **trend boxes** (identity, current Low, overlay percent/amount when the lookup returns a row), not a name-and-price list. Boxes paint from in-memory catalog first; debounce lookup; merge by Printing id. Ranked movers stay hidden while search is active; clear restores them. **Browse Sets** and mobile in-set search stay lists. Home keeps existing catalog sort; Trends does not gain a sort control. Under-floor matches still show an honest change.

**Independent Test**: Open Trends (or mobile Home). Type a card name that matches. Results are mover-style boxes with identity, current Low, and recent percent plus currency when computable — including a cheap card under the ranked floor. Browse Sets search is still the existing catalog list. Clear search returns ranked movers.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T012 [P] [US1] Extend `apps/web/tests/pages/Trends.test.jsx`: non-empty search renders trend boxes (not `CatalogPrintingResults` list rows); a match not on the ranked top 10 still appears; overlay percent/amount shown when stubbed; under-floor overlay still shown; clear search returns ranked movers; signed-out search works; results are not split into gainers vs losers sections
- [X] T013 [P] [US1] Extend `apps/web/tests/pages/SetList.test.jsx`: non-empty search **still** uses the catalog list; no mover-box grid; clear search returns the set list
- [X] T014 [P] [US1] Extend `apps/mobile/test/widgets/home_movers_test.dart`: Home global search shows trend boxes not `_PrintingList` tiles; existing sort still reorders those boxes; in-set (`SetCardsScreen`) search remains a list

### Implementation for User Story 1

- [X] T015 [P] [US1] Extract the ranked-list box into a reusable presentational widget in `apps/web/src/components/movers/` (e.g. keep `RecentMoversSection.jsx` importing it) so search can reuse the same chrome without duplicating markup
- [X] T016 [P] [US1] Extract the ranked-list box into a reusable widget in `apps/mobile/lib/features/search/` so Home global search can share chrome with `recent_movers_section.dart`
- [X] T017 [US1] On non-empty query in `apps/web/src/pages/Trends.jsx`, render matching catalog Printings as T015 boxes (reuse `matchPrintings` / `useCardData`); debounce T009 with current result ids; merge overlays by `card_id`; abort/ignore stale on query or marketplace change; empty query still ranked movers; **do not** import `CatalogPrintingResults` here
- [X] T018 [US1] Switch `_GlobalSearchResults` in `apps/mobile/lib/features/search/search_screen.dart` to T016 boxes using existing `filterCards` + `CardSort`; debounce T008 with result ids; merge overlays; keep Home sort; **do not** change `SetCardsScreen` list presentation
- [X] T019 [P] [US1] Confirm `apps/web/src/pages/SetList.jsx` still uses `apps/web/src/components/search/CatalogPrintingResults.jsx` for Printing search and does not call `printingRecentChanges`
- [X] T020 [US1] Wire marketplace-only Lows, one box per Printing, and name-match (plus Home sort) order in `apps/web/src/pages/Trends.jsx`, `apps/mobile/lib/features/search/search_screen.dart`, and the shared box widgets until T012, T013, and T014 pass — never sort Trends search by percent change

**Checkpoint**: User Story 1 is fully functional and testable independently (Trends/Home search boxes + Browse Sets/in-set still lists). Details navigation polish is US2; omit-change/error copy is US3 if a stub already returns overlays

---

## Phase 4: User Story 2 - Open a search-result box to inspect the Printing (Priority: P2)

**Goal**: Selecting a Trends/Home search-result box opens **that** catalog Printing’s existing card details (today’s prices still visible). Back/overlay close restores the movers landing with the **same query and boxes**. Do not synthesize a card from overlay fields alone.

**Independent Test**: From a Trends (or mobile Home) search-result box, open details for the same set and finish. Prices remain usable. Return with the search still in place.

### Tests for User Story 2 ⚠️

- [X] T021 [P] [US2] Extend `apps/mobile/test/widgets/home_movers_test.dart`: tapping a search-result box pushes existing `CardDetailScreen` for that Printing id (not a name-only match); back returns to Home with the query still showing boxes
- [X] T022 [P] [US2] Extend `apps/web/tests/pages/Trends.test.jsx`: clicking a search-result box looks up `_uniqueId` in the snapshot and calls existing `openDetail`; overlay close leaves `/trends` with the query and boxes. Confirm `apps/web/tests/pages/SetList.test.jsx` still opens details from the **list** and stays on `/sets`

### Implementation for User Story 2

- [X] T023 [US2] On box select in `apps/mobile/lib/features/search/search_screen.dart`, open existing `apps/mobile/lib/features/card_detail/card_detail_screen.dart` keyed by the catalog Printing id (do not add a ranking-only details page or duplicate the history chart)
- [X] T024 [US2] On box select in `apps/web/src/pages/Trends.jsx`, look up the snapshot Printing and open the existing overlay via `apps/web/src/contexts/CardDetailContext.jsx` — do not synthesize a partial card from overlay fields — until T021 and T022 pass

**Checkpoint**: Search boxes are a scan; inspect is existing details; query is not lost

---

## Phase 5: User Story 3 - Honest empty, no-trend, and failure states (Priority: P3)

**Goal**: No matches → honest empty copy, not empty boxes or `$0.00` rows. Match with no displayable overlay → identity + current Low (or unpriced), **change line omitted** (not 0%, dash, or “No recent move”). Overlay RPC failure → boxes stay; retry on figures only; ranked movers failure still must not block search. Unpriced current Low is unpriced, never zero.

**Independent Test**: Search a name with no matches; search a Printing with no 3–5 day start; fail the overlay RPC. Each state is clear, non-zeroing, and does not block Binder, trade, or Browse Sets.

### Tests for User Story 3 ⚠️

- [X] T025 [P] [US3] Extend `apps/mobile/test/widgets/home_movers_test.dart`: no matches → empty copy without boxes or `$0.00`; overlay `[]` → boxes without percent/amount/dash/copy; `printingRecentChanges` throw → boxes still listed, retry on figures, search still usable; unpriced current Low is not `$0.00`
- [X] T026 [P] [US3] Extend `apps/web/tests/pages/Trends.test.jsx` with the same no-match / omit-change / overlay-error assertions. Extend `apps/web/tests/pages/SetList.test.jsx` so Browse Sets search still works if Trends overlay would be in error (SetList never calls the lookup)

### Implementation for User Story 3

- [X] T027 [US3] Omit the change line when no overlay row exists (including 0% / missing window / outlier); never render 0%, `$0.00` / `€0.00` for missing change, a dash, or “No recent move” copy in the shared box widgets and `apps/web/src/pages/Trends.jsx` / `apps/mobile/lib/features/search/search_screen.dart`
- [X] T028 [US3] Keep identity boxes on overlay error; brief retry for figures only; debounce/abort so a late error cannot paint stale percents; CardMarket `[]` omits change lines without falling back to TCG — until T025 and T026 pass
- [X] T029 [US3] Keep ranked-movers loading/error from blocking search, and overlay error from blocking clear-to-movers, in `apps/web/src/pages/Trends.jsx` and `apps/mobile/lib/features/search/search_screen.dart`

**Checkpoint**: All three stories independently functional; a named card cannot look like a fake 0% dump or a crashed Trends/Home

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ranking isolation, vocabulary, and quickstart validation

- [X] T030 [P] Confirm `packages/contracts/recent_movers.json` suites still pass (`apps/web/tests/contracts/recentMovers.contract.test.js`, `apps/mobile/test/contracts/recent_movers_contract_test.dart`) and that `fab_recent_movers` was not modified in `supabase/migrations/`
- [X] T031 Confirm player-facing search on Trends/Home uses mover boxes, Browse Sets/in-set stay lists, no percent-change sort, no Pro CTA, no sparkline, in `apps/web/src/pages/Trends.jsx`, `apps/web/src/pages/SetList.jsx`, `apps/mobile/lib/features/search/search_screen.dart`, and the shared box widgets
- [X] T032 Run `cd apps/mobile && flutter test` and `cd apps/web && npm test`, then walk [quickstart.md](./quickstart.md) (Trends boxes, Browse Sets list, Home boxes + sort, in-set list, under-floor change, omit-change, overlay error, signed-out, details round-trip)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational
  - US2 assumes US1 boxes exist (select is wired on those boxes)
  - US3 assumes US1 boxes exist (omit-change / error polish)
- **Polish (Phase 6)**: After desired stories are complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — MVP Trends/Home search boxes
- **User Story 2 (P2)**: After US1 boxes — details navigation (may already be partially wired if the extracted box keeps `onSelect`)
- **User Story 3 (P3)**: After US1 boxes — honesty states

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Fixture + SQL + helpers (Phase 2) before any search-box UI
- Catalog boxes before overlay merge
- Box display before box navigation
- Story complete before the next priority if one person is editing `search_screen.dart` / `Trends.jsx`

### Parallel Opportunities

- T001 then T002
- T004 and T005 in parallel after T001
- T006 and T007 in parallel after their failing tests
- T008, T009, T011 in parallel after T003 (T010 after T009)
- T012, T013, T014 in parallel
- T015 and T016 in parallel
- T017 (web Trends) in parallel with T018 (mobile Home) after T015/T016; T019 beside them
- T021 and T022 in parallel; T023 and T024 in parallel
- T025 and T026 in parallel; T027/T028 after those tests
- T030 in parallel with T031 before T032

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Extend apps/web/tests/pages/Trends.test.jsx"
Task: "Extend apps/web/tests/pages/SetList.test.jsx"
Task: "Extend apps/mobile/test/widgets/home_movers_test.dart"

# Shared box chrome together:
Task: "Extract box in apps/web/src/components/movers/"
Task: "Extract box in apps/mobile/lib/features/search/"

# Surfaces together after chrome:
Task: "Trends.jsx boxes + debounce lookup"
Task: "search_screen.dart _GlobalSearchResults boxes + keep sort"
```

## Parallel Example: User Story 3

```bash
# Honesty tests then omit-change / error wiring:
Task: "home_movers_test.dart no-match / omit / overlay error"
Task: "Trends.test.jsx no-match / omit / overlay error"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (fixture + README)
2. Complete Phase 2: Foundational (RPC, helpers, catalog clients)
3. Complete Phase 3: User Story 1 (Trends/Home search boxes; Browse Sets/in-set still lists)
4. **STOP and VALIDATE**: Type a card on web Trends and mobile Home; confirm boxes + overlay; confirm Browse Sets is still a list; clear search restores ranked movers
5. Demo if ready; US2/US3 should follow before calling search honest (details round-trip and no fake 0%)

### Incremental Delivery

1. Setup + Foundational → overlay math is honest and shared
2. US1 → movers-landing search is the market pulse in box form (MVP)
3. US2 → box opens existing details without losing the query
4. US3 → missing/failed change cannot look like $0 or a crash
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With two developers after Foundational:

1. Developer A: mobile Home search boxes (US1 → US3)
2. Developer B: web Trends boxes + Browse Sets regression (US1 → US3)
3. Integrate at `printing_recent_changes.json`, the SQL function, and the two RPC wrappers

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story
- Do not invent Lows, mix marketplaces, put trend boxes on Browse Sets or in-set search, overload `fab_recent_movers`, apply the ranked floor to search overlays, add percent-change sort, fill empty change with 0%/dash/copy, require an account, hide search behind Pro, or write entitlements
- `CURRENT_DATE` owns the 3–5 day window — do not compute it in device local time
- If SQL lookup disagrees with the fixture, fix SQL (or change the product rule in the fixture **and** both helpers)
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
