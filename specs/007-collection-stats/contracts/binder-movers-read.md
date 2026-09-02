# Contract: Binder movers read

Collection Stats does **not** add a SQL function. It reuses [recent-movers-read.md](../../005-card-gainers-losers/contracts/recent-movers-read.md).

## Call

Same as owned movers in 005, except the id list is **one Binder**:

```text
fab_recent_movers(p_source, p_card_ids)
```

| Client | Call |
| --- | --- |
| Mobile | `CardRepository.recentMovers(source, {cardIds: thisBinderIds})` |
| Web | `recentMovers(source, thisBinderIds)` on `fabDb.js` |

`p_source` is Settings marketplace (`tcgplayer` \| `cardmarket`). Invalid source → error, no TCG fallback.

## Id list

1. Take live entries for the **open Binder** only.
2. Pass that list to existing `ownedPrintingIds` (qty > 0, not Want List, not tombstoned, unique Printing id).

Empty list: **do not RPC**. Show movers empty copy; keep headline + snapshot.

Home / Trends MUST NOT pass an all-Binder id list anymore. Catalog-wide on those landings is `recentMovers(source)` with `p_card_ids` omitted.

## Response

RPC rows unchanged (direction, rank, card_id, identity, Lows, percent, amount).

The page **joins quantity** for display:

```text
quantity(card_id) = sum(entry.quantity) for entries in this Binder with that Printing id
```

Quantity MUST NOT be sent to SQL and MUST NOT change rank. Copies are missing from a row only if the Printing left the Binder between fetch and paint — then omit the row or refresh; do not invent qty 0 as a mover.

## Errors

Same as 005 catalog-wide: network/5xx → movers error + retry; rest of Collection Stats stays. Stale response after marketplace change or unmount → ignore. RPC missing → visible failure, do not invent lists from the snapshot.

## Caching

In-memory per session keyed by `(source, sorted this-Binder ids)` is allowed. Do not persist. Do not bake Binder movers into the catalog snapshot.

## Writes

None. History upserts remain pipeline-only.
