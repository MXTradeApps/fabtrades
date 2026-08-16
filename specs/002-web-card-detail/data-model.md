# Data Model: Web Card Detail Modal

No new Postgres tables. The modal reads the in-memory catalog and existing Binder/trade stores.

## Printing (catalog card object)

Already produced by `createCardObject` in `useCardData.jsx`. Modal identity is `_uniqueId`.

| Field | Meaning |
| --- | --- |
| `_uniqueId` | Printing key `"<product_id>-<subtype>"` |
| `name` | Card name |
| `displayName` | Name plus finish label |
| `_setName`, `extNumber`, `subTypeName` | Set / collector / finish |
| `imageUrl`, `imageUrlFallback` | Art |
| `marketPrice`, `lowPrice`, `midPrice`, `highPrice`, `directLowPrice` | TCGplayer USD (0 used internally today; UI treats 0 as unpriced) |
| `cardmarketTrend`, `cardmarketLow`, `cardmarketAvg` (+ foil variants if mapped) | CardMarket EUR; null/absent until ingest fills them |

Validation:
- Open only when `_uniqueId` (or a resolvable catalog match) exists.
- Do not display 0 / null prices as currency zero.

Relationship: one Printing has many sibling Printings (Versions). One Printing may have a Binder entry and zero or more trade-line copies.

## Card detail session (client UI state)

| Field | Rule |
| --- | --- |
| `open` | Boolean |
| `printing` | Currently shown Printing; initial value is the entry-point Printing |
| `siblings` | `printingsForCard(catalog, printing)` |
| `addWant` | Callback registered by Home; `null` off the balancer |

State transitions:

```text
closed
  -- openDetail(printing) --> open (selected = that Printing)
open
  -- openDetail(other) --> open (replace; never stack)
  -- select Version --> selected Printing changes; art + Prices follow
  -- Add to trade (only if pathname / and addWant) --> Want line added; session stays open
  -- Want List add (auth + under cap) --> entry upserted; session stays open
  -- Want List add (no user) --> SignInDialog; session stays open
  -- Want List add (over cap) --> existing upgrade/limit message; session stays open
  -- zoom art --> nested art overlay; dismiss zoom returns to detail
  -- dismiss (close, backdrop, Escape) --> closed; page state unchanged
```

## Prices view-model (derived)

Built only for display from the selected Printing.

| Group | Fields | Empty |
| --- | --- | --- |
| TCGplayer (USD) | Market, Low, Mid, High, Direct low | — |
| CardMarket (EUR) | Trend, Low, Avg (foil-aware when those fields exist) | — |

Attribution: same catalog freshness as the rest of web (`pricesUpdatedAt` when known).

## Binder / Want / trade (existing)

| Store | Modal use |
| --- | --- |
| Binder entries (`cardId`, `quantity`, `isWanted`) | Own N when `!isWanted` and signed in; Want List add when `isWanted` |
| `useTradeState` Have/Want lists | **Add to trade** → Want only, balancer only |
| `user` (auth) | Inspect without it; mutations follow existing web rules |

## Entry point

A visible catalog **name** or **thumbnail** bound to a Printing. Decorative names without a resolvable `_uniqueId` are not controls.

## Out of model

- Price history series
- Condition-adjusted prices
- Shareable card URL
- Local signed-out Binder on web
