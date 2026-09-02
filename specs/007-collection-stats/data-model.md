# Data Model: Binder Collection Stats

No new Postgres tables. Collection Stats composes two existing derived models: the Binder-value snapshot (003) and recent movers (005), scoped to the **currently open Binder**.

## Existing storage (unchanged)

### Binder entry

Owner’s tradeable stock. Want List rows (`isWanted = true`) are **not** inputs.

| Field | Collection Stats use |
| --- | --- |
| `printingId` / `card_id` | Snapshot row key; mover id; quantity join |
| `quantity` | Snapshot weights; copies shown on a mover row (summed if two condition rows share a Printing) |
| `binderId` | **Must equal the open Binder.** Other Binders are excluded |
| `isWanted` | Must be false |
| `deletedAt` | Tombstones excluded |
| `card` / catalog row | Live prices for the snapshot |
| `condition` | Descriptive only; not a price or rank input |
| Lent | Copies that remain in the Binder are included |

Validation: the page input is the same open-Binder list the Binder screen shows. Do not mix Want List. Do not union all Binders (that was the 005 owned landing; this feature removes it).

Signed-out mobile: on-device entries count. Signed-out web: no Binder store (004) → `/binder` (and therefore `/binder/stats`) stays behind the existing sign-in gate.

### Printing prices (catalog)

Observed fields only. Unpriced = `null` / missing / `NaN` / numeric `0`. Same field map as [specs/003-binder-value-detail/data-model.md](../003-binder-value-detail/data-model.md).

### Price history + current Low

Binder movers do not read history on the client. They call existing `fab_recent_movers` (see [specs/005-card-gainers-losers/data-model.md](../005-card-gainers-losers/data-model.md) and [binder-movers-read.md](./contracts/binder-movers-read.md)).

## Derived: current total value

Point-in-time figure. **Not** a series.

| Field | Rule |
| --- | --- |
| `amount` | `sum((chosen-source value ?? omitted) × qty)` over this Binder. Display uses the existing `Pricing.value` / chosen-source fallback chain (`pricingValue` headline). Unpriced copies do not contribute and MUST NOT render as `$0` / `€0` on the page’s money figures — the snapshot’s `MoneyTotal` rows already distinguish null vs chip `?? 0`. |
| `source` | Settings `tcgplayer` \| `cardmarket` |
| `binderId` | Open Binder |
| `binderName` | Display name so the player can tell which Binder they opened |

When Settings change, recompute headline and top-five; refresh movers for the new Low series.

## Derived: Binder-value snapshot

Unchanged helper: `buildBinderValueSnapshot` / `binderValueSnapshot.js`. Golden: `packages/contracts/binder_value_snapshot.json`.

Collection Stats always uses `headline: "pricingValue"` (chosen source). Web no longer has a TCG-Market-only header total to match.

Entities (`copies`, `distinctPrintings`, foil/regular, four `MoneyTotal`s, unpriced counts, `topPrintings` cap 5): see 003 data-model. Input rows = **this Binder only**.

## Derived: Binder movers

Production rows: `fab_recent_movers(p_source, p_card_ids)` where `p_card_ids` is this Binder’s distinct Printing ids (`ownedPrintingIds` on the filtered list). Ranking goldens: `packages/contracts/recent_movers.json`. Do not add a Collection-Stats ranker.

| Field | Source | Notes |
| --- | --- | --- |
| RPC mover row | `fab_recent_movers` | Same schema as catalog-wide ([recent-movers-read.md](../005-card-gainers-losers/contracts/recent-movers-read.md)) |
| `quantity` | Open Binder | Sum of qty for that `card_id` in this Binder. Display only; **not** sent to SQL; **not** a rank key |

Eligibility, floor, 0%, outlier caps, 10 per direction: 005 rules. A Printing in Binder A only never appears on Binder B’s page even if it is a catalog-wide gainer.

Empty `p_card_ids`: no RPC call; movers section honest empty. RPC `[]` with non-empty ids: honest empty (cards owned, none qualify). Error: retry on movers; snapshot remains.

## State transitions

| From | To | Trigger |
| --- | --- | --- |
| Binder (non-empty) | Collection Stats page | Collection Stats button |
| Collection Stats | Same Binder, same scroll | Back / close |
| Collection Stats | Card details | Mover row or top-printing row |
| Card details | Collection Stats | Back |
| Empty Binder | *(no stats entry)* | Button hidden |
| Want List | *(no stats entry)* | Button hidden |
| Home / Trends | *(catalog-wide movers only)* | Owned section removed; not a transition into Collection Stats |

No Binder-value overlay state. No persisted Collection Stats document.

## Validation summary

- One Binder per page load.
- Want List never in snapshot or movers.
- Unpriced omitted, never zero on snapshot/headline display.
- Mover rank is percent Low change; copies shown, not weighted.
- No Binder total time series.
