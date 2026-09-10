# Implementation Plan: Fabrary CSV Binder Import

**Branch**: `008-fabrary-csv-import` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-fabrary-csv-import/spec.md`

## Summary

Players open **a Binder’s settings** (not app-wide Settings) and **Import from Fabrary**. A Fabrary collection export is parsed on the device. Only **Have > 0** rows are owned. Each owned row is matched to a catalog Printing (set number + pitch + foil + treatment + edition; ambiguous rows pick regular, else a fixed order). Preview lists unmatched **names** before confirm. Confirm **adds** Near Mint copies to **this** Binder (existing cards stay; NM quantities combine). Other Binders and Want List are untouched. Free-tier shared distinct-card cap is evaluated on the *resulting* collection; over-cap imports are refused in full. Matching and apply rules are shared goldens; each client has a native settings page and a single batch write.

## Technical Context

**Language/Version**: Dart SDK ^3.12 (Flutter, `apps/mobile`) and JavaScript ES modules + React 19 (`apps/web`)

**Primary Dependencies**: Existing Binder add/upsert (`BinderNotifier.add` / `upsertEntry`) generalized to one batch write. Existing catalog (`catalogProvider` / `useCardData`). Existing `FreeLimits` / `free_limits.json` (new batch-import cases). New dual helpers pinned to `fabrary_printing_match.json` and `fabrary_import_apply.json`. Mobile: `file_picker` for a local CSV. Web: native file input. No new chart library, price source, or SQL function.

**Storage**: Device Binder (mobile SharedPreferences + existing sync) and existing `binder_entries` (web). Catalog already in memory. **No new tables.** The CSV is not stored after apply.

**Testing**: `cd apps/web && npm test`; `cd apps/mobile && flutter test`. New contract tests for both goldens. Widget/page tests: Settings entry (open Binder + tile), not on Want List / app Settings; preview counts + unmatched names; cancel; confirm adds; second import doubles NM qty; free-cap refuse; bad file refuse. Do not mock the matcher to return the answer the test wanted — use catalog-shaped fixtures.

**Target Platform**: FAB Trades mobile Binder tab (pushed Binder Settings) and web `/binder/settings` (not in the hamburger; reached from `/binder` only). Shared Binder `/b/:token` and Want List out of scope.

**Project Type**: Dual-client product feature. Shared *fixtures and vocabulary*, two native settings pages, local parse + match.

**Performance Goals**: Preview ready without appearing stuck on a full-catalog Fabrary export (~17k rows, ~3.8k owned). Player time to confirm under 2 minutes (SC-001), not counting their own file-pick. One persist/sync after confirm, not one per row.

**Constraints**: Have-only. Add-on-top, not replace. NM default. Unmatched named on preview. Stable pick when ambiguous. Free cap refuse-all. No account gate on mobile when Binder is on device. Web keeps today’s `/binder` sign-in gate. Do not upload the file. Do not invent printings or prices. Do not write Want List. Pipeline unchanged.

**Scale/Scope**: One settings page per client, two shared goldens, one batch write path each. Typical import: thousands of owned printings (Pro). Free users with a real Fabrary dump hit the 50-card cap and see Pro.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / constraint | Status | How this plan complies |
| --- | --- | --- |
| I. Good Enough Ships | Pass | Reuse Binder write + catalog. No Edge Function, no import table, no relocate of rename/delete. Batch write instead of 3,800 `add()` calls because that *is* the failure mode. |
| II. Code That Reveals Intent | Pass | `fabraryMatch` vs `fabraryImportApply` vs Binder persist stay separate. Printing id is catalog id, not Fabrary Identifier. Preview is derived, not a stored job. |
| III. Fail Fast, Never Silent | Pass | Bad file / no owned / no matched / free cap refuse with a clear reason. Unmatched named before confirm. Ambiguous rows pick by a documented rule, not a random first hash. Partial batch does not commit. |
| IV. Honest Tests, Shared Contracts | Pass | New `fabrary_printing_match.json` and `fabrary_import_apply.json`. Both suites assert the same JSON. Cap cases extend `free_limits.json`. Catalog-shaped fixtures, not dummy ids that skip the matcher. |
| V. Reproducible Ingest | Pass | Pipeline unchanged. Apps only read the catalog they already have. Unmatched ≠ invented card. |
| Table is the deadline | Pass | Import is off the Trade tab. Settings is one tap from the Binder they are stocking. |
| No gate before value | Pass | Mobile signed-out import works. Web does not invent a signed-out Binder (existing `/binder` gate). Balancing a trade is unchanged. |
| One brand, two peer surfaces | Pass | Same vocabulary (Binder, Have, unmatched), same match/apply/cap. Native chrome. |
| Speak the trader's language | Pass | Destination is a **Binder**. Collection is a name. Want List is not a Binder and is not written. Printing = catalog `<product>-<subtype>`. Condition NM, descriptive only. |
| Real prices or nothing | Pass | No new prices. Unmatched unpriced, not $0. |
| Local reads, background sync | Pass | Parse/match from local file + cached catalog. Mobile write is local then one sync. Preview does not wait on the network if the catalog is already on device. |
| Server-owned Pro | Pass | Clients **read** entitlement for the cap. They do not write Pro. |
| Dual-client DRY | Pass | Shared fixtures. Scan stays mobile-only. Web file input vs mobile `file_picker`. |

No unjustified violations. Complexity Tracking left empty.

### Post-design re-check

Phase 1 adds settings/entry contracts, a match contract, and an apply/read contract. It does not add ingest, a fifth tab, Want List import, or a replace mode. Gates still pass. If JS and Dart matchers disagree, fix the implementation that drifted, not the fixture, unless the product rule changed.

## Project Structure

### Documentation (this feature)

```text
specs/008-fabrary-csv-import/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── entry-points.md
│   ├── binder-settings.md
│   ├── fabrary-printing-match.md
│   └── fabrary-import-apply.md
└── tasks.md             # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
packages/contracts/
├── fabrary_printing_match.json   # NEW: row → printing id / unmatched
├── fabrary_import_apply.json     # NEW: owned filter, preview, combine, cap
├── free_limits.json              # ADD batch-import refuse cases
└── README.md                     # register the two new fixtures

apps/web/
├── src/App.jsx                              # NEW route /binder/settings
├── src/pages/BinderSettings.jsx             # NEW: import for open Binder
├── src/pages/BinderCollection.jsx           # Settings entry on open Binder + tile
├── src/components/binder/BinderGrid.jsx     # tile menu Settings
├── src/utils/fabraryMatch.js                # NEW
├── src/utils/fabraryImportApply.js          # NEW
├── src/utils/fabraryCsv.js                  # NEW: RFC4180 + header check
├── src/utils/freeLimits.js                  # canImportDistinctPrintings
├── src/services/binder.js                   # upsertEntries batch
└── tests/                                   # contracts + BinderSettings

apps/mobile/
├── lib/features/binder/binder_settings_screen.dart  # NEW
├── lib/features/binder/binder_screen.dart           # Settings on open Binder
├── lib/features/binder/binder_grid.dart             # tile menu Settings
├── lib/core/logic/fabrary_match.dart                # NEW
├── lib/core/logic/fabrary_import_apply.dart          # NEW
├── lib/core/logic/fabrary_csv.dart                  # NEW
├── lib/core/logic/free_limits.dart                  # canImportDistinctPrintings
├── lib/core/providers.dart                          # BinderNotifier.applyImportAdds
├── pubspec.yaml                                     # file_picker
└── test/                                            # contracts + settings widgets
```

**Structure Decision**: Dual-client feature. Match/apply live next to other shared logic (`core/logic` / `src/utils`). Settings is a real page in the Binder feature, not a global Settings tile. Pipeline and schema stay as they are.

## Complexity Tracking

> No constitution violations to justify.
