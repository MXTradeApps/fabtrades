---

description: "Task list for Fabrary CSV Binder import implementation"
---

# Tasks: Fabrary CSV Binder Import

**Input**: Design documents from `/specs/008-fabrary-csv-import/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. [plan.md](./plan.md) and constitution IV require shared goldens plus widget/page tests for Settings entry, preview (owned counts + unmatched **names** before confirm), cancel, confirm add-on-top, second-import doubling, and refuse (bad file / empty Have / no match). Suites: `cd apps/web && npm test`; `cd apps/mobile && flutter test`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Shared fixtures: `packages/contracts/fabrary_printing_match.json` (NEW), `packages/contracts/fabrary_import_apply.json` (NEW), `packages/contracts/free_limits.json` (EXTEND), `packages/contracts/README.md`
- Web helpers: `apps/web/src/utils/fabraryCsv.js`, `apps/web/src/utils/fabraryMatch.js`, `apps/web/src/utils/fabraryImportApply.js`, `apps/web/src/utils/freeLimits.js`
- Web Binder: `apps/web/src/pages/BinderSettings.jsx` (NEW), `apps/web/src/pages/BinderCollection.jsx`, `apps/web/src/components/binder/BinderGrid.jsx`, `apps/web/src/App.jsx`, `apps/web/src/services/binder.js`
- Web tests: `apps/web/tests/contracts/`, `apps/web/tests/pages/BinderSettings.test.jsx` (NEW), `apps/web/tests/components/BinderGrid.test.jsx`
- Mobile helpers: `apps/mobile/lib/core/logic/fabrary_csv.dart`, `apps/mobile/lib/core/logic/fabrary_match.dart`, `apps/mobile/lib/core/logic/fabrary_import_apply.dart`, `apps/mobile/lib/core/logic/free_limits.dart`, `apps/mobile/lib/core/providers.dart`
- Mobile Binder: `apps/mobile/lib/features/binder/binder_settings_screen.dart` (NEW), `apps/mobile/lib/features/binder/binder_screen.dart`, `apps/mobile/lib/features/binder/binder_grid.dart`
- Mobile tests: `apps/mobile/test/contracts/`, `apps/mobile/test/widgets/binder_settings_test.dart` (NEW)
- Mobile picker: `apps/mobile/pubspec.yaml` (`file_picker`)
- Schema: none — no new migration

## Constitution

Touches **I** (reuse Binder write + in-memory catalog; settings page only; no Edge Function, no import table, no relocate of rename/delete; one batch write instead of 3,800 `add()` calls), **II** (`fabraryMatch` vs `fabraryImportApply` vs persist stay separate; Printing id is catalog id, not Fabrary Identifier), **III** (bad file / no owned / no matched refuse; unmatched named before confirm; no partial batch; import is not capped), **IV** (new `fabrary_printing_match.json` + `fabrary_import_apply.json`; both suites assert the same JSON), **V** (pipeline unchanged; unmatched ≠ invented card). Also: table is the deadline (import off Trade), no gate before value (mobile signed-out; web keeps `/binder` gate), one brand two peer surfaces, vocabulary (Binder; Collection is a name; Want List not written), real prices or nothing, local reads (parse/match on device), dual-client DRY (shared fixtures).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the new goldens and the mobile file picker. No Binder UI yet.

- [X] T001 Register `fabrary_printing_match.json` and `fabrary_import_apply.json` in `packages/contracts/README.md` (web `apps/web/src/utils/fabraryMatch.js` + `apps/web/src/utils/fabraryImportApply.js`; mobile `apps/mobile/lib/core/logic/fabrary_match.dart` + `apps/mobile/lib/core/logic/fabrary_import_apply.dart`). Note that import reuses `free_limits.json` for the batch cap and MUST NOT fork a second binder-card number
- [X] T002 Add `file_picker` to `apps/mobile/pubspec.yaml` (version compatible with SDK ^3.12) and run `flutter pub get` from `apps/mobile`
- [X] T003 [P] Add any iOS document-picker usage description `file_picker` requires to `apps/mobile/ios/Runner/Info.plist` (skip if the plugin does not need a new key)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared parse / match / plan / cap so every story uses the same rules. No Settings page yet.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `packages/contracts/fabrary_printing_match.json` with the cases in [contracts/fabrary-printing-match.md](./contracts/fabrary-printing-match.md) (regular vs foil, treatment blank vs set, First/Unlimited/Alpha, pitch, ambiguous regular-wins, ambiguous sort, SC-012 same id twice, quoted comma name). Catalog rows MUST be catalog-shaped (`collectorNumber`/`extNumber`, `subTypeName`, `name`, `pitch`, `id`)
- [X] T005 [P] Create `packages/contracts/fabrary_import_apply.json` with the cases in [contracts/fabrary-import-apply.md](./contracts/fabrary-import-apply.md) (Have-only counts, Want/Extra ignored, qty sum, NM combine + LP untouched, other Binder unchanged, `free_cap`, already-owned allowed, Pro allowed, `no_matched`, `no_owned`, `not_fabrary`)
- [X] T006 [P] Add batch-import cases to `packages/contracts/free_limits.json` for `canImportDistinctPrintings` (resulting distinct = existing ∪ incoming; already-owned ids consume no slot; Pro always allowed; over 50 refuses)
- [X] T007 [P] Write failing contract tests in `apps/web/tests/contracts/fabraryPrintingMatch.contract.test.js` that import `packages/contracts/fabrary_printing_match.json` and call `matchFabraryRow` from `apps/web/src/utils/fabraryMatch.js`
- [X] T008 [P] Write failing contract tests in `apps/mobile/test/contracts/fabrary_printing_match_contract_test.dart` that load the same JSON via `apps/mobile/test/contracts/contract_fixtures.dart` and call `matchFabraryRow` from `apps/mobile/lib/core/logic/fabrary_match.dart`
- [X] T009 [P] Write failing contract tests in `apps/web/tests/contracts/fabraryImportApply.contract.test.js` that import `packages/contracts/fabrary_import_apply.json` and call `planFabraryImport` from `apps/web/src/utils/fabraryImportApply.js`
- [X] T010 [P] Write failing contract tests in `apps/mobile/test/contracts/fabrary_import_apply_contract_test.dart` that call `planFabraryImport` from `apps/mobile/lib/core/logic/fabrary_import_apply.dart`
- [X] T011 [P] Extend `apps/web/tests/contracts/freeLimits.contract.test.js` so new `free_limits.json` batch-import cases call `canImportDistinctPrintings` from `apps/web/src/utils/freeLimits.js`
- [X] T012 [P] Extend `apps/mobile/test/contracts/free_limits_contract_test.dart` the same way against `apps/mobile/lib/core/logic/free_limits.dart`
- [X] T013 [P] Implement RFC4180 parse + required-header check in `apps/web/src/utils/fabraryCsv.js` (`parseFabraryCsv`). Missing Identifier/Name/Pitch/Set/Set number/Edition/Foiling/Treatment/Have → not Fabrary. Quoted `"10,000 Year Reunion"` MUST survive as one Name
- [X] T014 [P] Implement the same parser in `apps/mobile/lib/core/logic/fabrary_csv.dart`
- [X] T015 [P] Implement `matchFabraryRow` in `apps/web/src/utils/fabraryMatch.js` (set-code index + pitch + foil + treatment + edition; FR-010 stable pick). Do not match on Identifier alone
- [X] T016 [P] Implement `matchFabraryRow` in `apps/mobile/lib/core/logic/fabrary_match.dart` (reuse `collectorNumberKey` / `buildSetCodeIndex` / `nameQualifier` from `apps/mobile/lib/core/data/card_repository.dart` where they already exist)
- [X] T017 Implement `planFabraryImport` in `apps/web/src/utils/fabraryImportApply.js` using T013, T015, and T019 (`canImportDistinctPrintings`). Want/Extra MUST NOT appear in `adds`
- [X] T018 [P] Implement `planFabraryImport` in `apps/mobile/lib/core/logic/fabrary_import_apply.dart` using T014, T016, and T020
- [X] T019 [P] Add `canImportDistinctPrintings(existingOwnedIds, incomingIds, { isPro })` to `apps/web/src/utils/freeLimits.js` (Pro allow; else `|existing ∪ incoming| ≤ FreeLimits.binderCards`)
- [X] T020 [P] Add `canImportDistinctPrintings` to `apps/mobile/lib/core/logic/free_limits.dart` with the same rule
- [X] T021 Run `cd apps/web && npm test` and `cd apps/mobile && flutter test` until T007–T012 pass. If JS and Dart disagree, fix the implementation that drifted, not the fixture, unless the product rule in [spec.md](./spec.md) changed

**Checkpoint**: Foundation ready — both clients parse a Fabrary table, match printings, plan an add-on-top import, and refuse a free-tier over-cap batch. No Settings UI yet

---

## Phase 3: User Story 1 - Open Binder settings and start a Fabrary import (Priority: P1) 🎯 MVP

**Goal**: Each Binder has a **Settings** surface (open Binder + tile menu) that names that Binder and offers **Import from Fabrary**. App-wide Settings and Want List do not. Destination is scoped to that Binder only.

**Independent Test**: Open Collection → Settings → Import from Fabrary is there and names Collection. Trade Binder Settings is Trade Binder only. App-wide Settings has no Fabrary import. Want List has no Binder Settings. Mobile works signed out. Web uses the existing `/binder` sign-in gate.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T022 [P] [US1] Create `apps/mobile/test/widgets/binder_settings_test.dart`: open Binder shows a Settings control (`Key('binderSettings')`); tile menu has Settings (`Key('binderTileSettings-{id}')`); activating either pushes a page titled Settings that shows that Binder’s name and **Import from Fabrary** (`Key('importFabrary')`); Want List tab has neither control; `apps/mobile/lib/features/settings/settings_screen.dart` has no Fabrary import
- [X] T023 [P] [US1] Create `apps/web/tests/pages/BinderSettings.test.jsx` (and extend `apps/web/tests/components/BinderGrid.test.jsx`): open Binder header Settings (`data-testid="binder-settings"`) and tile menu Settings navigate to `/binder/settings?b={clientId}`; page shows Binder name + **Import from Fabrary** (`data-testid="import-fabrary"`); `/wants` has no Settings import; app-wide Settings has no Fabrary import; signed-out `/binder/settings` uses the same gate as `/binder`

### Implementation for User Story 1

- [X] T024 [P] [US1] Create `apps/mobile/lib/features/binder/binder_settings_screen.dart`: pushed page, title Settings, shows the passed `binderId` name from `bindersProvider`, **Import from Fabrary** control (picker wiring can no-op until US2). Back pops. No Binder mutations. Empty Binder MUST still show Settings
- [X] T025 [P] [US1] Create `apps/web/src/pages/BinderSettings.jsx`: title Settings, reads `?b=` / `getOpenBinderId()` / `targetOwnedBinderId()` from `apps/web/src/utils/openBinder.js`, shows that Binder’s name and **Import from Fabrary**. `useDocumentHead` title. No Binder edits. Empty Binder still shows Settings
- [X] T026 [US1] Register `<Route path="/binder/settings" element={<BinderSettings />} />` in `apps/web/src/App.jsx` next to `/binder`. Missing `?b=` falls back the same way `/binder` does (Trade Binder). Signed-out uses the `/binder` gate. Do not add `/binder/settings` to `apps/web/src/components/elements/Header.jsx` or `apps/web/scripts/generateSeoPages.js`. Do not add a `netlify.toml` redirect
- [X] T027 [US1] Add Settings to the open-Binder app bar in `apps/mobile/lib/features/binder/binder_screen.dart` and a Settings item on the tile `PopupMenuButton` in `apps/mobile/lib/features/binder/binder_grid.dart`. Both push T024 with that `binderId`. Hide on Want List. Keep Rename/Delete on the tile menu (do not move them)
- [X] T028 [US1] Add Settings on the open-Binder header in `apps/web/src/pages/BinderCollection.jsx` and a Settings `MenuItem` in `apps/web/src/components/binder/BinderGrid.jsx` that goes to `/binder/settings?b=`. Do not touch `apps/web/src/pages/SharedBinder.jsx`. Keep Rename/Delete on the tile menu
- [X] T029 [US1] Wire T024–T028 until T022 and T023 pass. Mobile signed-out with on-device Binders can open Settings with no account wall

**Checkpoint**: User Story 1 is fully functional and testable independently (Settings entry + Import label). Preview and writes not required yet

---

## Phase 4: User Story 2 - Preview owned cards before the Binder changes (Priority: P1)

**Goal**: Picking a Fabrary file shows a preview for **this** Binder: owned count (Have>0), matched count, unmatched count, copies to add, **unmatched names** (set/finish/treatment/edition), and copy that confirm **adds** (does not replace). Cancel leaves every Binder unchanged. Working state while parse+match run.

**Independent Test**: Full-catalog-style file: preview owned count is Have>0, not total rows; unmatched names visible before confirm; Cancel leaves the Binder as it was; Want/Extra do not change the preview quantities.

### Tests for User Story 2 ⚠️

- [X] T030 [P] [US2] Extend `apps/mobile/test/widgets/binder_settings_test.dart`: after a fixture CSV, preview shows owned/matched/unmatched/copies (`Key('fabraryPreview')`), lists unmatched names before confirm, states add-on-top, Confirm stays enabled when unmatched exist; Cancel / back leaves `binderProvider` unchanged; Want/Extra-filled rows do not increase copiesToAdd; working indicator appears before preview
- [X] T031 [P] [US2] Extend `apps/web/tests/pages/BinderSettings.test.jsx` with the same preview / unmatched-names / cancel / Want-Extra assertions (`data-testid="fabrary-preview"`)

### Implementation for User Story 2

- [X] T032 [US2] On `apps/mobile/lib/features/binder/binder_settings_screen.dart`, Import from Fabrary opens `file_picker` (`.csv` / `.txt`), reads UTF-8, runs `parseFabraryCsv` + `planFabraryImport` against `catalogProvider` + this `binderId` + current entries + `isProProvider`. Render T030 preview. Do not call `BinderNotifier.add` yet. Show a working state from pick until preview/refuse
- [X] T033 [P] [US2] On `apps/web/src/pages/BinderSettings.jsx`, Import uses `<input type="file" accept=".csv,text/csv,.txt">`, same plan against `useCardData` + open Binder + `getBinderEntries` + entitlement. Same preview. No `upsertEntry` yet
- [X] T034 [US2] Cancel / back from preview on both T032 and T033 MUST NOT write Binders or Want List. Confirm control is visible but can remain inert until US3. Until T030 and T031 pass: unmatched names are on the preview, not only a count

**Checkpoint**: User Stories 1 and 2 work independently (pick → preview → cancel). No cards added yet

---

## Phase 5: User Story 3 - Confirm and see imported cards added (Priority: P1)

**Goal**: Confirm adds matched Have copies as Near Mint to **this** Binder (existing cards stay; NM qty combines; LP/other conditions untouched). One batch persist + one mobile sync. Other Binders and Want List unchanged. Unmatched list still available after the add. Second import of the same file adds the same Printings again.

**Independent Test**: Confirm a fixture with normal/foil/treated/edition rows plus unmatched names. This Binder gains matched Have; a second Binder and Want List do not change; NM 2 + Have 3 = 5; second run adds again; unmatched names still visible.

### Tests for User Story 3 ⚠️

- [X] T035 [P] [US3] Extend `apps/mobile/test/widgets/binder_settings_test.dart` (and a notifier test in `apps/mobile/test/core/providers/` or existing binder notifier tests): confirm applies `adds` to this Binder only; previous rows remain; new Printing qty = Have, condition NM; existing NM qty increases by Have; LP row of that Printing unchanged; other Binder + Want List unchanged; second confirm of the same plan doubles again; unmatched names remain after apply
- [X] T036 [P] [US3] Extend `apps/web/tests/pages/BinderSettings.test.jsx` (mock `upsertEntries`) with the same add-on-top / other-Binder / second-import assertions

### Implementation for User Story 3

- [X] T037 [US3] Add `BinderNotifier.applyImportAdds(binderId, adds)` in `apps/mobile/lib/core/providers.dart`: one state replace combining NM qty, one `save`, then a single `syncAfterBinderMutation`. Do not loop `add()`. Do not write Want List or other `binderId`s. Failed persist MUST leave prior state
- [X] T038 [P] [US3] Add `upsertEntries(rows)` in `apps/web/src/services/binder.js` (one or chunked `.upsert([...], { onConflict: 'user_id,client_id' })` using `entryClientId` + `cardStub` + NM + this `binderId`). Re-check `canImportDistinctPrintings` before the request. Failed upsert MUST NOT leave a half-import in local UI state
- [X] T039 [US3] Wire Confirm on `apps/mobile/lib/features/binder/binder_settings_screen.dart` to T037 when `plan.ok`. After success, return to the Binder list (or stay with unmatched still visible — unmatched MUST remain available per FR-012). Collection Stats / tile count will follow existing Binder totals
- [X] T040 [US3] Wire Confirm on `apps/web/src/pages/BinderSettings.jsx` to T038 the same way; refresh `getBinderEntries` after success
- [X] T041 [US3] Keep the unmatched list available after a successful add on both T039 and T040 (summary they can dismiss is enough). Until T035 and T036 pass: a second import of the same file adds Have again (SC-012)

**Checkpoint**: User Story 3 is independently testable (preview + confirm actually stocks the Binder)

---

## Phase 6: User Story 4 - Clear refusal when the file cannot import (Priority: P2)

**Goal**: Not-Fabrary, empty Have, and zero matched all refuse with plain copy. Binder unchanged. Dismiss lets them pick another file. Fabrary import is not capped and MUST NOT show Upgrade to Pro.

**Independent Test**: Random non-Fabrary file and Fabrary with all Have empty: Binder unchanged, message says what to do next. A large owned set previews with no Pro upgrade.

### Tests for User Story 4 ⚠️

- [X] T042 [P] [US4] Extend `apps/mobile/test/widgets/binder_settings_test.dart`: wrong headers → not-Fabrary copy, no write; all Have empty → no-owned copy; owned but zero matches → no-matched copy; large existing Binder still previews (no Upgrade to Pro)
- [X] T043 [P] [US4] Extend `apps/web/tests/pages/BinderSettings.test.jsx` with refuse reasons (`not_fabrary`, `no_owned`, `no_matched`) and no `upsertEntries` call; large Binder still previews with no Upgrade to Pro

### Implementation for User Story 4

- [X] T044 [P] [US4] Surface `plan.refuseReason` on `apps/mobile/lib/features/binder/binder_settings_screen.dart` with the player-facing lines in [contracts/binder-settings.md](./contracts/binder-settings.md). Do not apply adds when `!plan.ok`
- [X] T045 [P] [US4] Surface the same refuse reasons on `apps/web/src/pages/BinderSettings.jsx`. Do not show Upgrade to Pro.
- [X] T046 [US4] Fabrary import is uncapped on mobile (no `presentProPaywall` on this screen). Until T042 and T043 pass: every refuse leaves Binders and Want List unchanged

**Checkpoint**: All four user stories are independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Docs and a table-side pass after the stories work

- [X] T047 [P] Add a one-line note to `docs/CONTEXT.md` under Binder that a Fabrary collection export can be imported from that Binder’s settings (Have adds Near Mint copies; Want List is not written)
- [X] T048 [P] Confirm `packages/contracts/README.md` lists both new fixtures and the `free_limits.json` batch-import cases after T021
- [X] T049 Run the automated + manual checks in [quickstart.md](./quickstart.md) (`cd apps/web && npm test`; `cd apps/mobile && flutter test`; Settings entry, preview, confirm, refuse)
- [X] T050 Confirm web `/binder/settings` is not in `apps/web/src/components/elements/Header.jsx` and shared `apps/web/src/pages/SharedBinder.jsx` cannot import

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational
  - US1 (Settings chrome) can proceed without US2–US4
  - US2 (preview) needs US1 page to exist, or can mount `BinderSettingsScreen` in tests alone after Foundational
  - US3 (confirm) needs US2 preview/plan on screen
  - US4 (refuse) can share the US2 plan output; implement after or beside US3
- **Polish (Phase 7)**: Depends on the stories you intend to ship

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — Settings entry only
- **User Story 2 (P1)**: After US1 page exists (or test-harness the page) + Foundational planner
- **User Story 3 (P1)**: After US2 preview; batch write
- **User Story 4 (P2)**: After US2 refuse reasons exist in the planner; UI can land with or after US3

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Helpers before pages
- Pages before wiring Confirm
- Story complete before moving to the next priority when staffing is sequential

### Parallel Opportunities

- T003 with T002
- T005–T006 with T004
- T007–T012 (all failing contract tests)
- T013–T016 and T019–T020 (csv/match/cap on both clients)
- T017 vs T018 after match+cap exist
- T022 vs T023; T024 vs T025
- T030 vs T031; T035 vs T036; T042 vs T043
- T044 vs T045
- T047 vs T048 vs T050

---

## Parallel Example: Foundational contract tests

```bash
Task: "Failing match contract tests in apps/web/tests/contracts/fabraryPrintingMatch.contract.test.js"
Task: "Failing match contract tests in apps/mobile/test/contracts/fabrary_printing_match_contract_test.dart"
Task: "Failing apply contract tests in apps/web/tests/contracts/fabraryImportApply.contract.test.js"
Task: "Failing apply contract tests in apps/mobile/test/contracts/fabrary_import_apply_contract_test.dart"
Task: "Extend freeLimits.contract.test.js for batch import"
Task: "Extend free_limits_contract_test.dart for batch import"
```

## Parallel Example: User Story 1

```bash
Task: "Failing binder_settings_test.dart entry cases"
Task: "Failing BinderSettings.test.jsx entry cases"
Task: "Create binder_settings_screen.dart"
Task: "Create BinderSettings.jsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Collection Settings shows Import from Fabrary
5. Demo the entry (preview/confirm not required for this checkpoint)

A **useful** first ship is US1 + US2 + US3 (pick file, preview unmatched names, add Have copies). US4 is the safety rail for free-tier dumps.

### Incremental Delivery

1. Setup + Foundational → goldens green
2. US1 → Settings entry → demo
3. US2 → preview + cancel → demo
4. US3 → confirm add-on-top → demo
5. US4 → refuses + Pro → demo
6. Polish / quickstart

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Then:
   - Developer A: US1 chrome
   - Developer B: can start US2 tests against the page once T024/T025 exist
   - Developer C: T037/T038 batch write in parallel with US1
3. Integrate on Confirm (US3)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to spec user stories US1–US4
- Verify contract and widget tests fail before implementing
- Commit after each task or logical group
- Do not upload the CSV; do not invent catalog printings; do not write Want List
- Do not loop `BinderNotifier.add` / `upsertEntry` per row
- Stop at any checkpoint to validate the story independently
