# Research: Multi-Binder Grid

## Decision: `binders` table + `binder_id` on owned entries

**Rationale**: Today `binder_entries` is one pile (`UNIQUE (user_id, card_id, is_wanted)`). A copy cannot live in two Binders, names cannot persist, and Trade Binder cannot be a stable role. A first-class Binder record (name, role, tombstone) plus `binder_id` on owned rows is the smallest model that matches FR-002, FR-011, FR-019, and FR-022.

Want List stays `is_wanted = true` with `binder_id` null. It is not a Binder.

**Alternatives considered**:
- Encode Binder as a tag string on each entry, no `binders` table — names, delete, uniqueness, and “always one Trade Binder” have nowhere to live.
- Want List as a Binder tile — forbidden by FR-007.
- One row per copy (no merge) — fights existing qty-merge and sync identity.

## Decision: Stable system `client_id`s for the two defaults

**Rationale**: Both clients and a SQL backfill must converge on the same Trade Binder and Collection. Minting random UUIDs on each device would duplicate defaults on first sync.

| Binder | `client_id` | `role` | Deletable |
| --- | --- | --- | --- |
| Trade Binder | `system:trade` | `trade` | never |
| Collection | `system:collection` | `standard` | when empty |
| User-created | client-minted UUID | `standard` | when empty |

`role = trade` is the identity Confirm Trade, Trade Filler, scan-from-grid, and public share use — **not** the display name (FR-011, FR-015).

**Alternatives considered**: Name-equals-“Trade Binder” as identity — breaks on rename. Per-user UUID assigned only on the server — signed-out mobile cannot create Collection until sign-in.

## Decision: Owned identity is `(binder_id, card_id, condition)`

**Rationale**: Two devices adding the same Printing to the **same** Binder must still merge quantity. The same Printing in Trade Binder and Collection must be two rows. Spec FR-008: merge when printing **and** condition match; do not merge across conditions. Drop `UNIQUE (user_id, card_id, is_wanted)`.

Want List keeps a partial unique `(user_id, card_id) WHERE is_wanted`. Owned live unique: `(user_id, card_id, binder_id, condition)`.

Sync `idOf` owned: `binder|{binderId}|{cardId}|{condition}`. Want: `want|{cardId}`.

**Alternatives considered**: Keep the old unique and forbid the same Printing in two Binders — makes move a delete+blocked-add. One row per Printing per Binder that overwrites condition — violates FR-008.

## Decision: Shared `binderCards` cap; new `binders: 4` with paywall behaviour

**Rationale**: Clarifications. Distinct owned Printings are counted **across all Binders** (Want List unchanged). Moves do not consume slots. Free players may hold 4 Binder records (Trade + Collection + two more). Creating a 5th presents the **Pro upgrade** and creates nothing.

`packages/contracts/free_limits.json` is data-loss-sensitive (constitution IV). Add `binders` + cases. `binderCards` cases stay 50; helpers must count `!isWanted` across binder ids.

Creating a 5th Binder is an explicit “I want more piles” action — present the Pro upgrade (spec option A). Distinct-card overflow stays the existing refuse path (snackbar + Upgrade on mobile; equivalent on web). Do not launch a paywall on every capped add.

**Alternatives considered**: Cap per Binder — free loophole. Cap Trade Binder only — Collection becomes unlimited inventory. Hide Create at 4 — weaker than a Pro upgrade.

## Decision: Constitution + CONTEXT vocabulary update in the same change

**Rationale**: Product Constraint 4 and `docs/CONTEXT.md` currently say Binder is the only owned pile and to avoid “Collection.” This feature makes Collection a **default Binder name** for owned-not-for-trade stock. That is an intentional product expansion, not a silent rename of the Binder tab.

Amendment (MINOR — expand guidance, do not drop the Binder type):

- The product noun remains **Binder**.
- **Trade Binder** is tradeable stock (Confirm Trade, Trade Filler, share).
- **Collection** is allowed as the default keep-pile Binder name.
- Do not rename the Binder destination to “Collection.” Want List is still not a Binder.

Without this, shipping FR-002 violates the constitution.

**Alternatives considered**: Call the keep pile “Keep Binder” to dodge the word Collection — contradicts the spec. Ship without amending — gate fail.

## Decision: Dual-client fixtures for move, cover, and limits — not a shared runtime

**Rationale**: Move, name uniqueness, shared card cap, binder count, and cover pick exist on web and mobile. Constitution IV: golden JSON, two implementations.

| Fixture | Rule |
| --- | --- |
| `free_limits.json` (extend) | `binders: 4`, paywall; `binderCards` shared across Binders |
| `binder_move.json` (new) | Partial qty, merge on printing+condition, refuse invalid qty, move does not change shared distinct count |
| `binder_cover.json` (new) | Highest contribution; empty → no cover; all-unpriced → name-stable pick |
| `binder_names.json` (new) | Unique after trim + case-fold; own-name rename ok; Trade Binder still `role=trade` |

**Alternatives considered**: Widget tests only — web and mobile will drift on merge/condition. Shared Dart/JS package — forbidden fake monorepo runtime.

## Decision: Confirm Trade and Trade Filler touch Trade Binder only

**Rationale**: FR-015. Today reconcile matches `isWanted: false` (first owned row). After this change that would steal from Collection if it appears first. Scope decrement/add to `role = trade`. Want List decrement unchanged.

Scan/pick while a Binder is open adds to that Binder. From the grid, tradeable adds go to Trade Binder (FR-016).

**Alternatives considered**: Remove given copies from whichever Binder has them — silent Collection edits. Auto-move Collection → Trade Binder on confirm — out of scope.

## Decision: Public share stays Trade Binder

**Rationale**: Spec out of scope for sharing Collection. `get_public_binder` today is `is_wanted = false`. After migration that would leak Collection. Filter rows whose Binder `role = trade`.

**Alternatives considered**: Share all owned Binders — out of scope. Share whichever Binder is open — new product surface.

## Decision: Native grid + drill-in; no new wait-on-network screen

**Rationale**: Local reads. Mobile Binder tab: grid is the Binder half of the existing Binder | Want List tabs; opening a tile pushes (or replaces in-tab) the existing list UI with a back affordance. Web `/binder`: grid first; drill-in is the current list chrome (sort, add, value overlay) for one Binder. `/wants` unchanged. Signed-out web Binder stays today’s sign-in page — do not invent an on-device web Binder (same as 003).

Cover image is catalog art already on the Printing (`image_url`). Highest-value Printing uses the same per-copy value as that surface’s Binder total (mobile `Pricing.value`, web TCG Market — honest with 003). Tile value is that Binder’s existing total helper, not a third formula.

**Alternatives considered**: Separate `/binders` route and leave `/binder` as Trade-only — two Binder homes. Compute cover on the server — unnecessary and slower.

## Decision: Sync Binders as their own domain; entries last-write-wins per row

**Rationale**: `docs/CLOUD_SYNC.md`: last write wins per record. Binder metadata (`name`, `role`, tombstone) is a new table with `client_id`, matching lend groups. Entries keep `updated_at` / `deleted_at`. Moving a Printing is: update/delete source row + upsert destination row (two records). A rare two-device race on the same Printing can lose one qty edit — same class of conflict as today, now per Binder.

Name uniqueness: client check + unique index on `lower(btrim(name))` for live Binders. Unique-violation on sync is a surfaced error, not a silent rename.

**Alternatives considered**: Fold Binder name into every entry — rename becomes N writes. Server-assigned Binder ids — breaks signed-out create.

## Open facts (resolved)

- Empty Binder names: refuse create/rename.
- Grid order: Trade Binder, then live Collection, then others by `createdAt` ascending (SC-010).
- 5th Binder: Pro upgrade UI, not a snackbar-only dead end.
- Distinct-card cap: existing refuse + Upgrade snackbar (mobile) / equivalent (web); not a mandatory paywall modal.
