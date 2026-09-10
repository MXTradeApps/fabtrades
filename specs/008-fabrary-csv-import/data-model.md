# Data Model: Fabrary CSV Binder Import

No new Postgres tables. Import composes the existing **Binder entry** and **catalog Printing**, plus two derived documents that exist only in memory for the duration of a settings session.

## Existing storage (unchanged)

### Binder entry

Owned identity remains `(printingId, binderId, condition)`. Import always writes `condition = NM`, `isWanted = false`, `binderId` = the settings Binder.

| Field | Import use |
| --- | --- |
| `printingId` / `card_id` | Target of a matched Have row |
| `quantity` | Existing NM qty += Have; other-condition rows untouched |
| `binderId` | **Must equal the settings Binder.** Other Binders are not written |
| `isWanted` | Must stay false on imported rows. Want List is not written |
| `condition` | Imported copies are `NM` |
| `card` stub | From the matched catalog Printing (same stub as a manual add) |
| Lent | Existing lends stay; import does not tombstone them |

Validation: apply is additive. A successful import never deletes a row. Tombstones are not revived unless the same `client_id` is upserted (web `deleted_at: null` on upsert of that NM identity — same as a manual add of a previously removed card).

Signed-out mobile: on-device entries. Signed-out web: no Binder store (004) → settings lives behind the existing `/binder` sign-in gate.

### Catalog Printing

Live in-memory catalog. Fields used for match:

| Catalog field | Fabrary column |
| --- | --- |
| `collector_number` / `extNumber` / `collectorNumber` | `Set number` (normalized) |
| `pitch` or `(Red)`/`(Yellow)`/`(Blue)` in `name` | `Pitch` |
| `subTypeName` (Normal, Rainbow Foil, Cold Foil, Gold Foil, plus edition prefixes) | `Foiling`, `Edition` |
| `name` art parenthetical | `Treatment` |
| `setName` / `name` / `subTypeName` edition tokens | `Edition` |
| `id` / `_uniqueId` | Resulting Printing id |

Do not persist Fabrary `Identifier`. It is not a Printing key.

### Free-tier distinct owned printings

Unchanged cap: 50 distinct `card_id` across all live owned Binders (`free_limits.json` `binderCards`, behaviour `refuse`). Import evaluates the **post-add** set. New cases describe a batch of incoming ids (already-owned ids do not consume a slot).

## Derived: Fabrary collection file

Ephemeral. Parsed once per pick.

| Field | Rule |
| --- | --- |
| Headers | Must include Identifier, Name, Pitch, Set, Set number, Edition, Foiling, Treatment, Have |
| Record | One printing as exported by Fabrary |
| Owned row | `Have` is a finite number > 0 |
| Ignored | Blank/zero Have; Want in trade; Want to buy; Extra for trade; Extra to sell |
| Skipped owned | Non-numeric Have → listed with unmatched (not a Binder write) |

A typical file is the full catalog (~17k records) with Have filled on a subset.

## Derived: Printing match

Pure function. Input: owned row + catalog. Output: `printingId` or unmatched identity (name, set number, foiling, treatment, edition).

Tie-break (FR-010): prefer regular (no treatment qualifier); else sort by name, set number, finish and take first. Deterministic for SC-012.

See [fabrary-printing-match.md](./contracts/fabrary-printing-match.md) and `packages/contracts/fabrary_printing_match.json`.

## Derived: Import plan

Pure function. Input: parsed rows, catalog, target `binderId`, existing Binder entries, `isPro`. Output: refuse or preview + `adds[]`.

| Field | Rule |
| --- | --- |
| `ownedCount` | Rows with Have > 0 |
| `matchedCount` / `unmatched` | After match |
| `copiesToAdd` | Sum of Have on matched rows (after combining duplicate file rows) |
| `adds[]` | `{ printingId, quantity }` per Printing |
| `refuseReason` | `not_fabrary` \| `no_owned` \| `no_matched` |

Import is not capped. Binder Settings MUST NOT show Upgrade to Pro.

See [fabrary-import-apply.md](./contracts/fabrary-import-apply.md).

## State transitions

| From | To | Trigger |
| --- | --- | --- |
| Binder grid | Binder Settings (that tile) | Tile menu **Settings** |
| Open Binder | Binder Settings (that Binder) | App bar / header **Settings** |
| Binder Settings | File picker | Import from Fabrary |
| File picker | Preview (or refuse) | File read + plan |
| Preview | Same Binder Settings, Binder unchanged | Cancel / back |
| Preview | Open Binder list, cards added | Confirm (ok plan) |
| Preview | Refuse, Binder unchanged | Plan already refused (`not_fabrary` / `no_owned` / `no_matched`) |
| Want List | *(no settings import)* | Hidden |
| App-wide Settings | *(no Fabrary import)* | Hidden |
| Shared `/b/:token` | *(no import)* | Hidden |

No persisted import job. No Binder-replace document. Preview dies when the player leaves Settings.
