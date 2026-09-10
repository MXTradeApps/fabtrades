# Contract: Fabrary import plan + apply

Shared by web and mobile. Golden: `packages/contracts/fabrary_import_apply.json`.

This fixture describes **batch** behaviour (Have-only, add-on-top, refuse bad files). Both suites assert the same file. Fabrary import does not use `free_limits.json`.

## `planFabraryImport`

| Input | Notes |
| --- | --- |
| `headers` + `rows` | Parsed table, or a `not_fabrary` short-circuit |
| `catalog` | Printings for the matcher |
| `binderId` | Settings Binder only |
| `existingEntries` | All of the player’s Binder entries (all Binders, not Want List) |

| Output | Notes |
| --- | --- |
| `ok` | false ⇒ no writes |
| `refuseReason` | `not_fabrary` \| `no_owned` \| `no_matched` |
| `ownedCount` | Have > 0 |
| `matchedCount` / `unmatched[]` | After match |
| `copiesToAdd` | Sum of Have on matched rows |
| `adds[]` | `{ printingId, quantity }` combined by Printing |

### Fixture cases (minimum)

1. Full-catalog-shaped file: ownedCount is Have>0 only; copiesToAdd ignores blank Have.
2. Want / Extra columns do not change `adds` or Want List entries.
3. Two file rows, same Printing: quantities sum in one add.
4. Existing NM qty 2 + Have 3 → apply result qty 5 NM; LP row of that Printing unchanged.
5. Existing cards in this Binder remain when adds are applied.
6. Other Binder entries unchanged.
7. A large incoming set is allowed even when many printings are already owned.
8. Incoming printings already owned (any Binder) → allowed.
9. Zero matched owned rows → `no_matched`.
10. No Have>0 → `no_owned`.
11. Missing required headers → `not_fabrary`.
12. Unmatched owned names are listed before confirm; confirm stays planned.

## Apply (after confirm)

Callers MUST:

1. Refuse if `!ok`.
2. Persist **all** `adds` in one batch (mobile one `save`; web one/chunked `upsert`).
3. Use `entryClientId` / `(printing, binderId, NM)` so a second import adds qty again.
4. Sync once (mobile) after the batch.
5. Leave other Binders and Want List untouched.

If the batch persist fails, the Binder MUST look as it did before confirm (no half-import).

Fabrary import does not evaluate a distinct-card cap and does not show Upgrade to Pro.
