# Contract: Binder value snapshot

Dual-client math contract. Golden cases: `packages/contracts/binder_value_snapshot.json`.  
Implementations: `apps/web/src/utils/binderValueSnapshot.js` and `apps/mobile/lib/core/logic/binder_value_snapshot.dart`.

Not an HTTP API. Both test suites MUST assert the same JSON (constitution IV).

## Input

```text
entries: [{
  printingId: string,
  name: string,
  finish: string,
  isFoil: boolean,
  quantity: int (>= 1),
  tcgMarket, tcgLow, tcgMid, tcgHigh: number | null,
  cmTrend, cmLow, cmAvg: number | null,
  cmTrendFoil, cmLowFoil, cmAvgFoil: number | null
}]
source: "tcgplayer" | "cardmarket"
headline: "pricingValue" | "tcgMarketOnly"
```

Callers MUST pass Binder rows only (`!isWanted`). Quantity &lt; 1 is dropped.

## Unpriced

A field is unpriced when it is `null`, missing, `NaN`, or numeric `0`.  
Unpriced MUST NOT enter a sum as `0`.

## Field totals

| Output | Sum of (when priced) |
| --- | --- |
| `tcgMarket` | `quantity × tcgMarket` |
| `tcgLow` | `quantity × tcgLow` |
| `cmTrend` | `quantity ×` foil-aware Trend |
| `cmLow` | `quantity ×` foil-aware Low |

Foil-aware CardMarket: if `isFoil` and the `*Foil` field is priced, use it; else the non-foil field.

Each is a `MoneyTotal`: `{ amount: number | null, pricedCopies, unpricedCopies }`.  
`amount` is `null` iff `pricedCopies === 0`.

Also:

- `tcgUnpricedCopies`: quantity where TCG Market **and** TCG Low are unpriced
- `cmUnpricedCopies`: quantity where foil-aware Trend **and** Low are unpriced

## Counts

- `copies` = sum of quantities  
- `distinctPrintings` = number of input rows kept  
- `foilCopies` / `regularCopies` split on `isFoil`; they MUST sum to `copies`

## Top printings

`sourceValue`:

- `headline: "pricingValue"` + `source: tcgplayer"` → Market else Low else Mid else High  
- `headline: "pricingValue"` + `source: cardmarket"` → foil-aware Trend else Avg else Low  
- `headline: "tcgMarketOnly"` → TCG Market only (no fallback)

Skip unpriced `sourceValue`. Sort contribution desc, name asc, `printingId` asc. Take at most 5. Do not pad.

## Display (not in the JSON amounts)

- TCG amounts format as USD; CardMarket as EUR  
- `amount === null` → `—` never `$0.00` / `€0.00`  
- Overlay headline string is **out of this fixture** (copied from the Binder total control)

## Tolerance

Same as trade math: `1e-9` relative closeness on amounts.
