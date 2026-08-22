# Contract: Binder move

Dual-client write rule. Golden cases: `packages/contracts/binder_move.json`.

Implementations: `apps/web/src/utils/binderMove.js`, `apps/mobile/lib/core/logic/binder_move.dart`.

Both suites MUST assert the same JSON. This is not an HTTP API.

## Input

```text
binders: [{ clientId, role, deletedAt }]
entries: [{
  printingId, binderId, isWanted, quantity, condition
}]
fromBinderId, toBinderId
printingId, condition
quantity: int
```

Want List rows (`isWanted = true`) are never moved by this helper.

## Success

When `fromBinderId ≠ toBinderId`, both Binders are live, `quantity` is 1…source qty, and the source row exists:

- Source quantity decreases by `quantity` (row removed at 0).
- Destination: if a row with the same `printingId` **and** `condition` exists, add `quantity`; else insert that condition.
- Other Binders and Want List unchanged.
- Distinct owned `printingId` count across Binders is unchanged.

## Refuse (entries unchanged)

- `quantity < 1` or `quantity >` source qty
- `fromBinderId === toBinderId`
- Missing source row
- Destination is not a live Binder (unknown, tombstoned, or Want List)
- Trade Binder as destination is allowed (it is a Binder)

The shared `binderCards` cap MUST NOT refuse a valid move.

## Confirm Trade (related, not this helper)

`reconcileBinderAfterTrade` decrements/adds **Trade Binder** (`role = trade`) only. Do not call move for confirm.
