---

description: "Task list for recent card gainers and losers implementation"
---

# Tasks: Recent Card Gainers and Losers

**Input**: Design documents from `/specs/005-card-gainers-losers/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. [plan.md](./plan.md) and constitution IV require `packages/contracts/recent_movers.json` asserted by both `apps/mobile` (`flutter test`) and `apps/web` (`npm test`). Widget/page tests for mobile **Home** label, web **Trends** vs **Browse Sets** (no Home nav), owned-hide vs owned-empty, search covering movers on Trends and covering the set list on Browse Sets, row → details, marketplace rebuild. Smoke/integration copy that still says Browse on the mobile tab bar must expect Home.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Shared fixtures: `packages/contracts/`
- Schema: `supabase/migrations/`
- Mobile: `apps/mobile/lib/features/search/search_screen.dart`, `apps/mobile/lib/app/app.dart`, `apps/mobile/lib/core/logic/`, `apps/mobile/lib/core/data/card_repository.dart`
- Web movers: `apps/web/src/pages/Trends.jsx` (NEW), `apps/web/src/components/movers/`, `apps/web/src/App.jsx` (`/trends`)
- Web sets: `apps/web/src/pages/SetList.jsx` (Browse Sets; Printing search only — **no movers**)
- Web chrome: `apps/web/src/components/elements/Header.jsx` (Trends + Browse Sets; **no Home item**)
- Web trade calculator: `apps/web/src/pages/Home.jsx` — **UNCHANGED** (`/` stays Trade Calculator; filename is not a player-facing Home)
- Shared ranking helpers: `apps/web/src/utils/recentMovers.js`, `apps/mobile/lib/core/logic/recent_movers.dart`
- Catalog RPC: `apps/web/src/services/fabDb.js`, `apps/mobile/lib/core/data/card_repository.dart`
- Tests: `apps/mobile/test/` and `apps/web/tests/`

## Constitution

Touches **I** (one RPC over existing history; no movers table, snapshot file, alerts, fifth tab, or web Home), **II** (start Low vs latest Low vs derived percent vs owned Printing ids; `Home.jsx` remains the trade calculator), **III** (invalid `p_source` errors; null Low omitted not `$0`; CardMarket empty ≠ TCG fallback), **IV** (`recent_movers.json`; both suites assert it), **V** (pipeline unchanged; apps only read). Also: table is the deadline (short lists; search immediate; web `/` untouched), no gate before value (signed-out catalog-wide; no Pro), one brand two peer surfaces (mobile Home vs web Trends + Browse Sets), vocabulary (Printing, Binder, Collection as name, Want List not owned, **recent movers** not weekly, web destination **Trends**), real prices or nothing, local reads (movers fetch is sibling), dual-client DRY (fixture + SQL, not a shared runtime), server-owned Pro (no entitlement writes).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Golden cases so JS, Dart, and SQL cannot invent different window, floor, percent, or owned-id rules

- [X] T001 Create `packages/contracts/recent_movers.json` from [contracts/recent-movers.md](./contracts/recent-movers.md) with explicit `today`, `ranking_cases` (TCG vs CM columns, null Low skipped not zeroed, most-recent Low in the 3–5 day band, 2-day and 6-day starts rejected, `$1`/`€1` start floor including 30¢→60¢ excluded, 0% dropped, sealed dropped, top-10 cut, percent tie broken by `card_id` ASC), and `owned_id_cases` (qty > 0 any Binder, Want List excluded, same Printing in two Binders or two conditions → one id, empty Binders → no ids). Each expected row includes `card_id`, `start_on`, `start_low`, `latest_low`, `percent_change`, `amount_change`
- [X] T002 [P] Add `recent_movers.json` to the files table in `packages/contracts/README.md` (web `apps/web/src/utils/recentMovers.js`; mobile `apps/mobile/lib/core/logic/recent_movers.dart`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Public ranking RPC, shared helpers that match the fixture, and catalog read clients. Movers-landing UI stories only display these rows.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add `supabase/migrations/YYYYMMDDHHMMSS_fab_recent_movers.sql` implementing `public.fab_recent_movers(p_source text, p_card_ids text[] DEFAULT NULL)` per [contracts/recent-movers-read.md](./contracts/recent-movers-read.md) and [data-model.md](./data-model.md): `SECURITY INVOKER` `STABLE`; `p_source` only `tcgplayer`|`cardmarket` else error (no TCG default); `CURRENT_DATE` window `[today-5, today-3]`; start = most recent non-null marketplace Low in that band; latest = `fab_card_prices` Low; floor `start_low >= 1`; exclude sealed, null latest, 0% change; gainers percent DESC then `card_id` ASC; losers percent ASC then `card_id` ASC; `rank` 1…10 per direction; `NULL` ids = catalog-wide; empty ids = zero rows; `GRANT EXECUTE` to `anon` and `authenticated`; btree on `fab_price_history(captured_on)` in the same migration; comment that SQL must match `packages/contracts/recent_movers.json`
- [X] T004 [P] Write failing contract tests that load `recent_movers.json` via `apps/mobile/test/contracts/contract_fixtures.dart` in `apps/mobile/test/contracts/recent_movers_contract_test.dart` (assert `ranking_cases` and `owned_id_cases`; observed start/latest vs derived percent/amount; never coerce null Low to 0)
- [X] T005 [P] Write failing contract tests that import `packages/contracts/recent_movers.json` in `apps/web/tests/contracts/recentMovers.contract.test.js`
- [X] T006 Implement window, eligibility, percent/amount, rank cut, and `ownedPrintingIds` in `apps/mobile/lib/core/logic/recent_movers.dart` until T004 passes; add `apps/mobile/test/core/logic/recent_movers_test.dart` for helper-level cases — names must distinguish start Low vs latest Low vs derived change; do not invent Lows
- [X] T007 [P] Implement the same helpers in `apps/web/src/utils/recentMovers.js` until T005 passes; add `apps/web/tests/utils/recentMovers.test.js`
- [X] T008 [P] Add `recentMovers(source, {cardIds})` in `apps/mobile/lib/core/data/card_repository.dart` calling `supabase.rpc('fab_recent_movers', …)` per [contracts/recent-movers-read.md](./contracts/recent-movers-read.md); map snake_case rows; do not default a bad source
- [X] T009 [P] Add `recentMovers(source, cardIds?)` POST to `/rest/v1/rpc/fab_recent_movers` in `apps/web/src/services/fabDb.js` (same publishable-key `restFetch` family as other catalog reads, JSON body; do not use the auth `supabase-js` client)
- [X] T010 Unit-test the web RPC path (URL, body `p_source` / `p_card_ids`, error on non-OK) in `apps/web/tests/services/fabDb.recentMovers.test.js`
- [X] T011 Stub `recentMovers` on `MockCardRepository` (default `[]`; optional map/error like `priceHistory`) in `apps/mobile/test/support/harness.dart` so later widget tests do not hit Supabase

**Checkpoint**: Foundation ready — `flutter test` / `npm test` pass the new fixture; RPC exists; clients can fetch ranked rows; no movers-landing UI yet

---

## Phase 3: User Story 1 - See recent biggest gainers and losers (Priority: P1) 🎯 MVP

**Goal**: Catalog-wide recent movers on the movers landing, with surface-native chrome. **Mobile:** first tab is **Home** (not Browse, not a fifth tab); empty search lands on catalog-wide movers, then the existing set list; catalog Printing search stays immediate. **Web:** hamburger **Trends** (`/trends`) is the movers landing (movers only, **no set list**); **Browse Sets** (`/sets`) stays the set catalog and gains catalog-wide Printing search; **no Home page or Home nav item**; `/` stays the Trade Calculator. Signed-out catalog-wide works. Search does not wait on movers.

**Independent Test**: Open the movers landing (mobile Home tab; web Trends from the hamburger). Confirm movers are what they land on, catalog search finds Printings without opening a set on the movers landing **and** on web Browse Sets, web Browse Sets is a separate destination (not mixed onto Trends), the first mobile tab is Home not Browse, web hamburger has Trends and Browse Sets and not Home, each row uses latest Low vs the 3–5 day start Low, cheap cards under the floor are absent, signed-out sees catalog-wide lists with no sign-in wall.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T012 [P] [US1] Widget tests in `apps/mobile/test/widgets/home_movers_test.dart`: tab/app bar **Home** not Browse; empty search shows recent movers above the set list; gainers vs losers distinct; row shows name, set, finish, current Low, percent, currency amount; catalog search covers movers; clear search restores movers; signed-out still shows catalog-wide; no fifth tab; credit copy names observed catalog Lows; no `$0.00` invented row
- [X] T013 [P] [US1] Page tests in `apps/web/tests/pages/Trends.test.jsx`: `/trends` lands on recent movers with **no set list**; hamburger **Trends** present; **Home** nav item absent; `/` is still the trade calculator (`pages/Home.jsx`); catalog Printing search covers movers; clear search returns movers not Browse Sets; signed-out has catalog-wide and no owned section
- [X] T014 [P] [US1] Page tests in `apps/web/tests/pages/SetList.test.jsx`: `/sets` empty search shows the set list and **no movers**; catalog Printing search (not set-name-only) covers the set list; clear search returns the set list not Trends; selecting a Printing result opens existing details; signed-out search works without sign-in

### Implementation for User Story 1

- [X] T015 [P] [US1] Build catalog-wide recent movers chrome (gainers + losers lists, loading slot, catalog-Low credit, marketplace from `AppSettings.source`, abort/ignore stale) in `apps/mobile/lib/features/search/recent_movers_section.dart` using T008 — search and set list must paint without waiting on this fetch
- [X] T016 [P] [US1] Build the same chrome in `apps/web/src/components/movers/RecentMoversSection.jsx` using T009 and `PriceContext.priceSource` — Trends-only; do not import or render the set catalog
- [X] T017 [US1] Rename app bar to Home; on empty query show movers **then** existing `_SetList`; on non-empty query keep existing `_GlobalSearchResults` (movers and set list hidden) in `apps/mobile/lib/features/search/search_screen.dart`
- [X] T018 [P] [US1] Relabel tab 0 to **Home** (`_tabScreenNames`, `NavigationDestination`, analytics screen name) in `apps/mobile/lib/app/app.dart` — do not add a fifth destination; Trade, Binder, Lend stay
- [X] T019 [P] [US1] Insert hamburger item **Trends** → `/trends` immediately before **Browse Sets** in `apps/web/src/components/elements/Header.jsx`; keep Browse Sets label and `/sets`; do **not** add a Home item; do **not** rename `/` or Trade Calculator
- [X] T020 [US1] Create movers landing page with catalog Printing search (reuse `apps/web/src/utils/searchUtils.js` over `useCardData`; empty query = movers only; non-empty = Printing results covering movers; document title via existing `useDocumentHead`) in `apps/web/src/pages/Trends.jsx` — **no set list** (FR-021)
- [X] T021 [US1] Register `<Route path="/trends" element={<Trends />} />` in `apps/web/src/App.jsx`; leave `/` as `Home.jsx` (trade calculator) and `/sets` as `SetList.jsx`; no `netlify.toml` redirect for `/trends`
- [X] T022 [US1] Make catalog-wide Printing search the primary search on Browse Sets in `apps/web/src/pages/SetList.jsx` (reuse `searchUtils.js` / `useCardData`; empty query = existing set list; non-empty = Printing results covering the set list; clear → set list; open existing `openDetail` with the snapshot Printing). Do **not** fetch or embed movers. Keep `/sets/:groupId` unchanged. Do not change `apps/web/scripts/generateSeoPages.js` canonical `/sets`
- [X] T023 [US1] Wire catalog-wide fetch (`p_card_ids` omitted), rebuild on marketplace change (drop leftover rows), and visually distinct up vs down in `apps/mobile/lib/features/search/recent_movers_section.dart`, `apps/mobile/lib/features/search/search_screen.dart`, `apps/web/src/components/movers/RecentMoversSection.jsx`, and `apps/web/src/pages/Trends.jsx` until T012, T013, and T014 pass

**Checkpoint**: User Story 1 is fully functional and testable independently (mobile Home + web Trends catalog-wide movers + search on Trends and Browse Sets). Owned section not required yet (empty Binders already match “catalog-wide only”)

---

## Phase 4: User Story 2 - See recent movers among owned cards (Priority: P2)

**Goal**: When any Binder has qty > 0, the movers landing (mobile Home; web Trends) shows a **separate** owned gainers/losers view first, then catalog-wide. Same ranking/floor/window. Want List does not count. Same Printing in two Binders appears once. Empty Binders omit the owned section (not a blank card). Owns-but-none-qualify still shows owned empty copy first. Signed-out web has no Binder store → hide owned. Web Browse Sets never shows owned movers.

**Independent Test**: Add qualifying Printings to a Binder. Open the movers landing (mobile Home; web Trends). Owned lists only include those Printings; catalog-wide still shows market movers including unowned cards. Duplicate Binder rows collapse to one owned row. Empty Binders hide owned. Web signed-out omits owned.

### Tests for User Story 2 ⚠️

- [X] T024 [P] [US2] Extend `apps/mobile/test/widgets/home_movers_test.dart`: owned first then catalog-wide when `binderProvider` has qty > 0; unowned catalog gainer absent from owned; Want List-only does not show owned; empty Binders omit owned; owns-but-`[]` RPC shows owned empty copy with catalog-wide still below; same Printing in two Binders once
- [X] T025 [P] [US2] Extend `apps/web/tests/pages/Trends.test.jsx`: signed-in with Binder entries shows owned first; signed-out omits owned (do not invent on-device web Binder); `/wants` is unrelated; `/sets` still has no owned/movers block

### Implementation for User Story 2

- [X] T026 [US2] Derive owned ids via `ownedPrintingIds` from `binderProvider` (qty > 0, not Want List, unique Printing id) and call T008 with `p_card_ids` in `apps/mobile/lib/features/search/search_screen.dart` / `apps/mobile/lib/features/search/recent_movers_section.dart` — hide owned when ids empty; empty RPC still shows the owned section when ids exist
- [X] T027 [US2] Load live Binder entries for the signed-in user (reuse `apps/web/src/services/binder.js`; no signed-out local store) and pass owned ids into T009 from `apps/web/src/pages/Trends.jsx` — never from `SetList.jsx`
- [X] T028 [US2] Compose owned-then-catalog as two labeled views (not a switcher) in `apps/mobile/lib/features/search/recent_movers_section.dart` and `apps/web/src/components/movers/RecentMoversSection.jsx` until T024 and T025 pass — headings a first-time tester can tell apart (SC-011)

**Checkpoint**: User Stories 1 and 2 both work; owned and catalog-wide stay distinct; Browse Sets remains movers-free

---

## Phase 5: User Story 3 - Open a mover to inspect the Printing (Priority: P3)

**Goal**: Selecting a catalog-wide or owned row opens **that** Printing’s existing card details (today’s prices still visible). Back returns to the movers landing (mobile Home tab stack / web overlay close on `/trends`). Details opened from Browse Sets search stay on `/sets`.

**Independent Test**: From a movers row, open details for the same set and finish. Prices remain usable. Return to Home / Trends without losing the tab/`/trends`.

### Tests for User Story 3 ⚠️

- [X] T029 [P] [US3] Extend `apps/mobile/test/widgets/home_movers_test.dart`: tap uses `card_id` to push existing `CardDetailScreen` for that Printing (not a name-only match); back returns to Home movers
- [X] T030 [P] [US3] Extend `apps/web/tests/pages/Trends.test.jsx`: row looks up `card_id` in the catalog snapshot and calls existing `openDetail` / overlay with that Printing; overlay close leaves `/trends` movers. Extend `apps/web/tests/pages/SetList.test.jsx` so a Browse Sets search result overlay close stays on `/sets`

### Implementation for User Story 3

- [X] T031 [US3] On row select, open existing `apps/mobile/lib/features/card_detail/card_detail_screen.dart` keyed by `card_id` from `apps/mobile/lib/features/search/recent_movers_section.dart` (do not add a ranking-only details page or duplicate the history chart)
- [X] T032 [US3] On row select, look up the snapshot Printing by `card_id` (`_uniqueId`) and open the existing overlay via `apps/web/src/contexts/CardDetailContext.jsx` from `apps/web/src/components/movers/RecentMoversSection.jsx` / `apps/web/src/pages/Trends.jsx` — do not synthesize a partial card from RPC identity fields alone — until T029 and T030 pass

**Checkpoint**: Lists are a scan; inspect is existing details; movers are not a dead end

---

## Phase 6: User Story 4 - Honest empty, ineligible, and failure states (Priority: P4)

**Goal**: Short lists are short (never padded). No qualifying Printings → honest empty copy, never a fake `$0.00` row. Fetch failure → retry on the movers slot only; search, mobile set list, web Browse Sets, Binder, and trade still work. Offline does not block the rest of the app. A Trends fetch failure MUST NOT blank `/sets`.

**Independent Test**: Open the movers landing with fewer than 10 qualifiers, with no gainers or no losers, and with the RPC failing / offline. Each state is clear, non-zeroing, and does not block search or other destinations. Web Browse Sets still opens and searches.

### Tests for User Story 4 ⚠️

- [X] T033 [P] [US4] Extend `apps/mobile/test/widgets/home_movers_test.dart`: 3 qualifying gainers → 3 rows not padded to 10; empty gainers copy without `$0.00`; `recentMovers` throw → error+retry while search/set list still interactable; owned error does not hide catalog-wide
- [X] T034 [P] [US4] Extend `apps/web/tests/pages/Trends.test.jsx` with the same empty/error/non-blocking assertions (search still works on failure). Extend `apps/web/tests/pages/SetList.test.jsx` so Browse Sets search still works when Trends would be in error (SetList never calls the RPC)

### Implementation for User Story 4

- [X] T035 [US4] Render only returned rows (no placeholder movers); empty copy per list (gainers vs losers) that does not invent prices in `apps/mobile/lib/features/search/recent_movers_section.dart` and `apps/web/src/components/movers/RecentMoversSection.jsx`
- [X] T036 [US4] Error+retry on the movers slot only; CardMarket `[]` is empty copy that names CardMarket, not a silent TCG list, in those same files until T033 and T034 pass
- [X] T037 [US4] Keep owned and catalog-wide fetches independent (one failure does not blank the other) in `apps/mobile/lib/features/search/search_screen.dart` and `apps/web/src/pages/Trends.jsx`

**Checkpoint**: All four stories independently functional; bad catalog days cannot look like $0 movers or a crashed Home/Trends; Browse Sets stays usable

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Label drift, vocabulary, SEO/snapshot isolation, and quickstart validation

- [X] T038 [P] Replace remaining first-tab **Browse** expectations with **Home** in `apps/mobile/test/widgets/app_smoke_test.dart`, `apps/mobile/integration_test/app_test.dart`, and `apps/mobile/test/features/onboarding/welcome_carousel_test.dart` (carousel may still mention browsing sets; it MUST NOT require a tab labeled Browse)
- [X] T039 Confirm player-facing copy says **recent movers** (not weekly / “this week”), web destination **Trends**, Printing / Binder / Collection-as-name / Want List-not-owned in `apps/mobile/lib/features/search/search_screen.dart`, `apps/mobile/lib/features/search/recent_movers_section.dart`, `apps/web/src/pages/Trends.jsx`, `apps/web/src/pages/SetList.jsx`, `apps/web/src/components/movers/RecentMoversSection.jsx`, and `apps/web/src/components/elements/Header.jsx`
- [X] T040 [P] Confirm no Pro CTA, no alerts chrome, no movers bake-in of the catalog snapshot, and no `/trends` SEO page in `apps/web/src/services/fabDb.js`, `apps/web/scripts/generateCatalog.js` (snapshot version unchanged), and `apps/web/scripts/generateSeoPages.js` (`canonicalPath: '/sets'` stays)
- [X] T041 Run `cd apps/mobile && flutter test` and `cd apps/web && npm test`, then walk [quickstart.md](./quickstart.md) (mobile Home landing, web Trends vs Browse Sets, search cover on both web destinations, catalog-wide signed-out, owned hide vs empty, row → details, marketplace rebuild, error/retry, web `/` still trade)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational
  - US2 assumes US1 movers landing exists (owned section is prepended there)
  - US3 assumes US1 (and US2 if testing owned rows) lists exist
  - US4 assumes US1 lists exist (empty/error polish); can start once US1 chrome is in
- **Polish (Phase 7)**: After desired stories are complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — MVP movers landing (mobile Home + web Trends) + catalog-wide movers + search on Trends and Browse Sets
- **User Story 2 (P2)**: After US1 landing — owned section on Home/Trends only; helpers already exist from Phase 2
- **User Story 3 (P3)**: After US1 rows exist — details navigation
- **User Story 4 (P4)**: After US1 (and US2 for owned-error independence) — honesty states

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Fixture + SQL + helpers (Phase 2) before any movers-landing UI
- Catalog-wide fetch before owned ids
- Row display before row navigation
- Story complete before the next priority if one person is editing `search_screen.dart` / `Trends.jsx`

### Parallel Opportunities

- T001 then T002
- T004 and T005 in parallel after T001
- T006 and T007 in parallel after their failing tests
- T008, T009, T011 in parallel after T003 (T010 after T009)
- T012, T013, T014 in parallel; T015 and T016 in parallel; T018 and T019 in parallel
- T020+T021 (web Trends route) in parallel with T022 (Browse Sets search) after T016/T019
- T024 and T025 in parallel; T026 and T027 in parallel (then T028)
- T029 and T030 in parallel; T031 and T032 in parallel
- T033 and T034 in parallel; T035/T036 after those tests
- T038 and T040 in parallel beside T039

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Widget tests in apps/mobile/test/widgets/home_movers_test.dart"
Task: "Page tests in apps/web/tests/pages/Trends.test.jsx"
Task: "Page tests in apps/web/tests/pages/SetList.test.jsx"

# Chrome together:
Task: "recent_movers_section.dart in apps/mobile/lib/features/search/"
Task: "RecentMoversSection.jsx in apps/web/src/components/movers/"

# Web destinations together after chrome:
Task: "Trends.jsx + /trends route in App.jsx"
Task: "Printing search on SetList.jsx (no movers)"
```

## Parallel Example: User Story 2

```bash
# After US1, owned tests then wiring (mobile vs web Trends):
Task: "owned ids from binderProvider in apps/mobile/lib/features/search/"
Task: "signed-in binder.js ids in apps/web/src/pages/Trends.jsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (fixture + README)
2. Complete Phase 2: Foundational (RPC, helpers, catalog clients)
3. Complete Phase 3: User Story 1 (mobile Home + web Trends catalog-wide movers + search on both web destinations)
4. **STOP and VALIDATE**: Open mobile Home signed-out, see recent movers, search a card; open web Trends (no Home nav, no set list); open Browse Sets and search a card; confirm `/` is still the trade calculator
5. Demo if ready; US2 is the sell-timing slice and should follow before calling the movers landing done for players who already have Binders

### Incremental Delivery

1. Setup + Foundational → ranking is honest and shared
2. US1 → movers landing is the market pulse (MVP)
3. US2 → owned movers on the same landing
4. US3 → row opens existing details
5. US4 → empty/error cannot look like $0 or a crash
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With two developers after Foundational:

1. Developer A: mobile Home (US1 → US4)
2. Developer B: web Trends + Browse Sets search (US1 → US4)
3. Integrate at `recent_movers.json`, the SQL function, and the two RPC wrappers

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story
- Do not invent Lows, mix marketplaces, pad lists, add a Movers tab, label any web page or nav item Home, replace web `/` with Trends, put the set list on Trends, put movers on Browse Sets, require an account for catalog-wide, hide movers behind Pro, treat Want List as owned, invent signed-out web Binder, or write entitlements
- `CURRENT_DATE` (UTC, matching pipeline `captured_on`) owns the 3–5 day window — do not compute it in device local time
- If SQL ranking disagrees with the fixture, fix SQL (or change the product rule in the fixture **and** both helpers)
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
