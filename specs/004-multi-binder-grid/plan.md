# Implementation Plan: Multi-Binder Grid

**Branch**: `004-multi-binder-grid` | **Date**: 2026-08-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-multi-binder-grid/spec.md`

## Summary

The Binder destination becomes a **grid of Binders**. Every player gets **Trade Binder** (tradeable stock, never deletable) and **Collection** (keep pile). Tiles show name, copy count, Binder value, and a cover of the highest-value Printing (none when empty). Players open a Binder, move copies between Binders, create/rename/delete (empty only; Trade Binder never). Want List stays a sibling, not a tile. Free: **50 distinct owned Printings shared across Binders**, **4 Binders**; a 5th create shows the **Pro upgrade**. Names are unique per player and sync to web. Confirm Trade, Trade Filler, and public share use Trade Binder only.

Schema: new `binders` table; `binder_id` + condition on owned `binder_entries`. Dual-client fixtures for limits, move, cover, and names. Constitution / `docs/CONTEXT.md` vocabulary update in the same change.

## Technical Context

**Language/Version**: Dart SDK ^3.12 (Flutter, `apps/mobile`) and JavaScript ES modules + React 19 (`apps/web`); Postgres via Supabase migrations

**Primary Dependencies**: Existing Flutter Binder tab + MUI Binder page. Existing `Pricing` / catalog images. Existing Pro upgrade (`presentProPaywall` / web Pro CTA). Sync adapters (`BinderSyncAdapter` + a new binders adapter). No new pricing library.

**Storage**: Mobile SharedPreferences (`collection_entries` plus a binders list). Postgres `binders` (new) and `binder_entries` (altered). Device storage remains the read source; sync is background last-write-wins per record.

**Testing**: `cd apps/mobile && flutter test`; `cd apps/web && npm test`. Golden fixtures asserted by both. Widget/page tests for grid, Want List sibling, Trade Binder delete refusal, Pro upgrade on 5th Binder. Move/cover/name unit tests use catalog-shaped rows, not mocks that return the answer.

**Target Platform**: FAB Trades mobile (iOS/Android) Binder tab and web `/binder`. Want List (`/wants`, mobile tab) and public `/b/:token` stay; share content is Trade Binder only.

**Project Type**: Dual-client product feature. Shared *fixtures and vocabulary*, two native UIs. Schema in `supabase/migrations`.

**Performance Goals**: Grid paints from on-device (mobile) / already-loaded (web) Binders without a blocking network round-trip (SC-001, FR-022). Tile math is O(n) per Binder; cover is the same pass as value. Binders: 4 free, low tens for Pro.

**Constraints**: Signed-out mobile grid/move/create. No account gate to read local Binders. Unpriced never `$0` on a non-empty tile. Do not invent signed-out web Binder. Pipeline unchanged. Clients MUST NOT write entitlements. Free `binderCards` is shared; moves must not refuse on that cap.

**Scale/Scope**: Grid + drill-in on two surfaces. One migration. Confirm Trade / filler scoped to Trade Binder. Free limits fixture extension. Vocabulary docs + constitution MINOR.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / constraint | Status | How this plan complies |
| --- | --- | --- |
| I. Good Enough Ships | Pass | Grid, two defaults, move, limits. No folders, no share-all-Binders, no Collection-in-Confirm-Trade. |
| II. Code That Reveals Intent | Pass | `role=trade` vs display name. Want List is `is_wanted`, not a Binder. Cover/value are derived, not stored prices. |
| III. Fail Fast, Never Silent | Pass | Duplicate name refused. Delete Trade Binder refused. Non-empty delete refused. Unique index on live names. Unpriced tile value is unpriced, not $0. |
| IV. Honest Tests, Shared Contracts | Pass | Extend `free_limits.json`; add `binder_move.json`, `binder_cover.json`, `binder_names.json`. Both suites assert them. |
| V. Reproducible Ingest | Pass | Pipeline unchanged. Covers use catalog `image_url` already on the Printing. |
| Table is the deadline | Pass | Trade Filler / Confirm Trade still one pile (Trade Binder). Grid is Binder maintenance, not a mid-trade extra step. |
| No gate before value | Pass | No sign-in to use on-device Binders. Web keeps today’s `/binder` account rule. Pro upgrade only on **creating** a 5th Binder, not on opening the grid or reading value. |
| One brand, two peer surfaces | Pass | Same names, counts, values, move rules, uniqueness, limits; native grid/list. |
| Vocabulary | **Amend** | Collection as a Binder **name** is spec-required. MINOR update to Constraint 4 and `docs/CONTEXT.md` in this change: type stays Binder; Trade Binder = tradeable stock; Collection = default keep pile; do not rename the Binder tab. |
| Real prices or nothing | Pass | Tile value = existing Binder total for that pile. Cover ranking uses that source; unpriced never shown as $0. |
| Local reads | Pass | Grid from device / already-fetched rows. Names already on device show without waiting on sync. |
| Dual-client DRY | Pass | Shared fixtures, not a shared runtime. Scan/filler remain mobile-native; web gets the same Binder rules without a fake scanner. |
| Server-owned Pro | Pass | Clients read entitlement; 5th Binder is blocked unless Pro is already true. Paywall does not write `entitlements`. |

No unjustified violations. Vocabulary amendment is required and scoped (Complexity Tracking).

### Post-design re-check

Phase 1 adds `binders`, `binder_id`, condition in the owned unique key, three fixtures, and overlay/grid UI contracts. Confirm Trade is scoped to `role=trade`. Share RPC filters Trade Binder. Gates still pass **if** CONTEXT + constitution vocabulary land in the same implementation change as the UI.

## Project Structure

### Documentation (this feature)

```text
specs/004-multi-binder-grid/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── entry-points.md
│   ├── binders.md
│   ├── binder-move.md
│   └── free-limits.md
└── tasks.md             # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
.specify/memory/constitution.md          # MINOR: Collection as Binder name
docs/CONTEXT.md                          # Trade Binder vs Collection
docs/CLOUD_SYNC.md                       # binders domain + entry identity
packages/contracts/
├── free_limits.json                     # binders: 4; binderCards shared
├── binder_move.json                     # NEW
├── binder_cover.json                    # NEW
├── binder_names.json                    # NEW
└── README.md

supabase/migrations/
└── YYYYMMDDHHMMSS_multi_binders.sql     # binders table, binder_id, uniques, share RPC

apps/mobile/lib/
├── core/models/binder.dart              # NEW: Binder record (id, name, role)
├── core/models/binder_entry.dart        # binderId
├── core/data/binder_repository.dart     # seed defaults, migrate entries
├── core/sync/binder_sync.dart           # identity includes binder + condition
├── core/sync/binders_sync.dart          # NEW: binders table adapter
├── core/logic/free_limits.dart          # binders cap; shared binderCards
├── core/logic/binder_move.dart          # NEW
├── core/logic/binder_cover.dart         # NEW
├── core/logic/binder_names.dart         # NEW
├── core/logic/confirm_trade.dart        # Trade Binder only
├── core/providers.dart
└── features/binder/
    ├── binder_screen.dart               # Want List tab + grid vs drill-in
    ├── binder_grid.dart                 # NEW
    └── binder_list.dart                 # existing list, scoped to one Binder

apps/mobile/test/contracts/ + widgets/

apps/web/src/
├── utils/freeLimits.js
├── utils/binderMove.js                  # NEW
├── utils/binderCover.js                 # NEW
├── utils/binderNames.js                 # NEW
├── services/binder.js                   # binders CRUD, scoped entries
├── pages/BinderCollection.jsx           # grid when !isWanted; list drill-in
└── components/binder/BinderGrid.jsx     # NEW

apps/web/tests/contracts/ + pages/
```

**Structure Decision**: Dual-client feature. Shared contract JSON under `packages/contracts`. Schema in `supabase/migrations`. Mobile UI stays under `features/binder/` (grid + existing list). Web grid lives next to Binder (`components/binder/`) and `/binder` becomes grid-first; `/wants` unchanged. Pipeline and card-detail add-to-list gain a target Binder (open Binder or Trade Binder).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| MINOR constitution / CONTEXT vocabulary change (Collection as a Binder name) | Spec default keep pile is named Collection; Constraint 4 currently forbids that word | Renaming to “Keep Binder” contradicts the spec; shipping without the amendment fails the vocabulary gate |
