# Contract: Binder Settings page

Native page for **one** Binder. This is not app-wide Settings and not an overlay over the grid.

## Identity

| Surface | Route / stack | Title |
| --- | --- | --- |
| Mobile | Pushed `BinderSettingsScreen` | Settings; also show that Binder’s name |
| Web | `/binder/settings` (`?b=` open Binder; default Trade Binder if missing, same as `/binder`) | Settings; also show that Binder’s name |

Leave/back restores the screen the player came from (grid or that Binder’s list) without writing cards.

Direct `/binder/settings` with no valid Binder: fall back the same way `/binder` does (Trade Binder), or send the player back to `/binder`. Do not import into a missing id.

## Sections

1. **Binder name** — so they know which pile they will add to.
2. **Import from Fabrary** — control that opens the device file picker (`.csv` / `text/csv` / `.txt`).
3. After a valid pick: **preview** (see apply contract). Confirm and Cancel.
4. After a successful confirm: return to the Binder list **or** stay on Settings with the unmatched list still visible. Either is allowed; unmatched names MUST remain available (FR-012). Prefer returning to the Binder list with unmatched still reachable (e.g. a one-shot summary they can dismiss).

Layout may differ. Labels **Settings**, **Import from Fabrary**, and unmatched identity fields MUST match.

## Preview (before any write)

Must show:

- Owned-row count (Have > 0)
- Matched count
- Unmatched count
- Copies that will be added (sum of Have on matched rows)
- **Name of each unmatched owned card** (set number, finish, treatment, edition when present)
- Copy that confirming **adds** these copies to this Binder and does **not** remove existing cards; a second import of the same file will add again

Confirm stays enabled when unmatched rows exist (not option C). Cancel / back: Binder unchanged.

## Refuse (no write)

| Reason | Player-facing meaning |
| --- | --- |
| `not_fabrary` | This is not a Fabrary collection export |
| `no_owned` | No owned cards (Have) were found |
| `no_matched` | None of the owned cards were found in the catalog |
| `free_cap` | This import would exceed the free Binder card cap — show Pro upgrade |

## Working state

From file pick until preview or refuse, show that the product is working. Do not leave the last preview on screen for a new file.

## Must not

- Write other Binders or Want List
- Show Want / Extra columns as quantities
- Replace this Binder’s existing cards
- Live on app-wide Settings
