# Contract: Binders, tiles, names, cover

Dual-client rules. Golden cases:

- `packages/contracts/binder_cover.json`
- `packages/contracts/binder_names.json`

Implementations: `binderCover` / `BinderCover` and `binderNames` / `BinderNames` on each client.

Not an HTTP API. Both suites MUST assert the same JSON.

## Defaults

| `clientId` | Default name | `role` | Seed |
| --- | --- | --- | --- |
| `system:trade` | Trade Binder | `trade` | Always, if missing |
| `system:collection` | Collection | `standard` | Always, if missing |

User Binders: `role = standard`, `clientId` = UUID.

## Name uniqueness

Normalize: `trim`, then case-fold. Empty after trim is invalid.

- Create/rename to a name that matches another **live** Binder → refuse, no write.
- Rename to the same Binder’s current name → success.
- Deleted Binder’s name may be reused.
- Trade Binder may be renamed; `role` stays `trade`.

## Tile value

Same helper as that Binder’s existing total (mobile Settings source / `Pricing.value`; web TCG Market). Input = that Binder’s owned rows only. Unpriced copies do not display as `$0.00` / `€0.00` when the Binder is non-empty. Empty Binder: true zero.

## Cover

Input: owned rows + the same `source` / `headline` split as `binder_value_snapshot.json` (`pricingValue` vs `tcgMarketOnly`).

| Situation | Cover |
| --- | --- |
| `cardCount = 0` | none (`printingId` null) |
| At least one priced contribution | Printing with max `qty × sourceValue`; ties: name A–Z, then printing id, then condition |
| Copies exist but none priced for source | First Printing by name A–Z, then printing id, then condition (must not look empty) |

Cover art is the catalog/stub image URL of that Printing. Do not fetch a new image pipeline. Missing URL: still pick the Printing; UI may show a blank image slot.

## Grid order

1. `role = trade`
2. `clientId = system:collection` if live
3. Remaining live Binders by `createdAt` ascending, then `clientId`
