# Research: Fabrary CSV Binder Import

## Decision: Shared match + apply goldens, two native UIs

**Rationale**: FR-018 requires the same Have-only, add-on-top, matching, cap, and unmatched rules on web and mobile. Constitution IV: when both clients implement a rule, `packages/contracts` is the source of truth.

Two fixtures, not one kitchen-sink file:

| Fixture | Rule |
| --- | --- |
| `packages/contracts/fabrary_printing_match.json` | Fabrary owned row → catalog Printing id, or unmatched |
| `packages/contracts/fabrary_import_apply.json` | Owned-row filter, preview counts, NM combine, batch cap, unmatched list |

Helpers: `apps/web/src/utils/fabraryMatch.js` + `fabraryImportApply.js`; `apps/mobile/lib/core/logic/fabrary_match.dart` + `fabrary_import_apply.dart`.

**Alternatives considered**:

- Match only in one client — the other will drift (forbidden).
- One giant fixture — harder to fail the right test.
- Server-side match Edge Function — uploads the player’s collection, extra round-trip, contradicts local Binder writes (constitution: local reads). Rejected.

## Decision: Match in memory against the live catalog

**Rationale**: Catalog is already on device (`catalogProvider` / `useCardData`). Fabrary `Set number` is the same TCGplayer-style collector code stored as `collector_number` / `extNumber` / `collectorNumber` (`MST131`, `FAB101`, `LGS282`). `collector_number` is **not unique** (same code, different finish or `(Extended Art)` name). Matching MUST filter, then apply FR-010.

Pipeline (owned row → candidates → one Printing or unmatched):

1. Normalize `Set number` the way mobile `collectorNumberKey` does (lowercase, strip non-alphanumerics). Index catalog the same way (`buildSetCodeIndex` on mobile; add the same index on web — web has no set-code index today).
2. Pitch: Fabrary `Red`/`Yellow`/`Blue` ↔ catalog `pitch` `1`/`2`/`3` or `(Red)` / `(Yellow)` / `(Blue)` in `name`. Blank pitch: do not require a color.
3. Foiling: blank → regular / `Normal` (no Rainbow/Cold/Gold in `subTypeName`). Rainbow / Cold / Gold → that foil in `subTypeName` (including `1st Edition Rainbow Foil` style compounds).
4. Treatment: blank → catalog `name` has **no** art parenthetical (`Extended Art`, `Full Art`, `Alternate Art`, `Alternate Text`, `Alternate Border`). Filled treatment → that parenthetical in `name` (reuse mobile `nameQualifier` / web Discord name parse rules).
5. Edition: `First` → `1st` / `first` in `subTypeName` / `setName` / `name`. `Unlimited` → `unlimited`. `Alpha` → token `alpha` in those fields. Blank edition → **exclude** First / Unlimited / Alpha candidates.
6. If zero candidates: unmatched.
7. If more than one: pick regular (no treatment qualifier) when it is a candidate; else first by name, then set number, then finish (`subTypeName`). Same file + same catalog → same id (SC-012).

Do **not** match on Fabrary `Identifier` alone. Reused across variants.

**Alternatives considered**:

- Identifier → slug lookup table — Fabrary slugs are not catalog ids; would invent a second catalog.
- Name-only match — collisions across sets and finishes.
- SQL `findByCollectorNumber` per row — 3,800 round-trips; catalog is already loaded.
- Map Alpha → First silently — wrong Unlimited/First cards. Alpha is unmatched unless the catalog row actually says alpha.

## Decision: Parse the file on the device; do not upload it

**Rationale**: The export is the player’s collection. Writes go to the on-device Binder (mobile) or the existing signed-in `binder_entries` upsert (web). Matching uses the in-memory catalog. No new Edge Function, no Blob, no `fab_import_*` table.

CSV: Fabrary quotes names with commas (`"10,000 Year Reunion"`). Each client gets a small RFC4180 reader (header row + records). Do not add `papaparse` / a heavy CSV package unless the 40-line reader fails a fixture case. Put 2–3 quoted-field rows in `fabrary_printing_match.json` (or a `parse` section) so both readers stay honest.

Required headers (case-sensitive as exported): `Identifier`, `Name`, `Pitch`, `Set`, `Set number`, `Edition`, `Foiling`, `Treatment`, `Have`. Extra columns (`Want in trade`, …) are ignored. Missing required headers → not a Fabrary collection file (FR-004).

**Alternatives considered**:

- Upload to an Edge Function — privacy + hosting complexity; constitution I.
- Papa Parse on web only — parse drift vs Dart.
- Treat the whole 17k-row file as an error — that **is** the normal Fabrary export.

## Decision: Binder Settings is a new per-Binder page

**Rationale**: There is no Binder settings screen today. Rename/delete live on the grid tile menu. Spec FR-001 requires Import on **that Binder’s settings**, not app-wide Settings.

v1 chrome (native layout, same meaning):

| Surface | Entry | Destination |
| --- | --- | --- |
| Mobile | Open-Binder app bar **Settings**; tile menu **Settings** | Pushed `BinderSettingsScreen` for that `binderId` |
| Web | Open-Binder header **Settings**; tile menu **Settings** | `/binder/settings` (query `?b=` same as the open Binder) |

The page names the Binder and offers **Import from Fabrary** (file pick → preview → confirm). Rename/delete stay on the tile menu (constitution I: do not relocate them). Want List and app-wide Settings do not grow this action. Shared Binder `/b/:token` does not import.

Web signed-out `/binder` keeps today’s sign-in gate (004: do not invent a local web Binder). Mobile signed-out import writes SharedPreferences like a manual add.

**Alternatives considered**:

- Only a tile-menu “Import” with no settings page — weaker than “settings of a specific binder” (SC-006).
- Move rename/delete onto the new page in the same change — extra surface, not required to import.
- App-wide Settings — forbidden by FR-001.

## Decision: Preview + apply are one pure function; writes are one batch

**Rationale**: `planFabraryImport({ rows, catalog, binderId, existingEntries })` returns:

- `ok` / `refuseReason` (`not_fabrary` | `no_owned` | `no_matched`)
- preview: owned count, matched count, unmatched rows (name + set number + finish + treatment + edition), copies to add
- `adds`: `{ printingId, quantity }[]` already combined by Printing (Have sums)

Confirm maps `adds` onto existing NM rows in **this** Binder (qty += Have) or new NM rows. Other conditions unchanged. Other Binders unchanged.

**Cap**: none for Fabrary import. A large owned set is allowed. Binder Settings MUST NOT show Upgrade to Pro.

**Write path** (do not call `add()` / `upsertEntry()` 3,800 times):

- Mobile: `BinderNotifier.applyImportAdds(binderId, adds)` — one state replace, one `save`, one `syncAfterBinderMutation`.
- Web: `upsertEntries(rows)` — one (or chunked) Supabase `.upsert([...])` on `user_id,client_id`.

Failed confirm: Binder unchanged (no partial batch). Show retry.

**Alternatives considered**:

- Loop existing `add()` — 3,800 persists and syncs; looks stuck (spec large-file edge).
- Per-row cap (import first 50) — forbidden by FR-015 (import is uncapped).
- Server transaction — web already upserts; batch upsert is enough. Mobile is local-first.

## Decision: file_picker on mobile; file input on web

**Rationale**: Mobile `pubspec.yaml` has no document picker. `file_picker` is the smallest way to get a `.csv` / `.txt` off iOS/Android. Web uses a hidden `<input type="file" accept=".csv,text/csv,.txt">`. Read as UTF-8 text. Show a working state from pick until preview is ready (17k rows is fine on the UI isolate if parse+match stay linear; do not add a Worker/Isolate unless a test device janks).

**Alternatives considered**:

- Paste-the-CSV textarea — extra UX, not requested.
- Share-sheet only — no web equivalent.

## Decision: Do not invent catalog printings or prices

**Rationale**: Constitution V / Product Constraint 5. Unmatched rows are listed, never created, never priced as $0. Import does not touch the price pipeline.

## Decision: Want / extra columns stay unread

**Rationale**: Clarified spec. Parser may keep the columns; apply ignores them. No Want List writes.

## Open items deferred to implementation (not product)

- Exact `file_picker` version (compatible with current Flutter SDK).
- iOS usage-description copy for document picker if the plugin requires it.
- Web upsert chunk size if PostgREST payload limits appear (start with one upsert; split only if it fails).
