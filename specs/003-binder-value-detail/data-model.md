# Data Model: Binder Value Detail

No new Postgres tables. The overlay reads the in-memory Binder and the catalog snapshot already used by the Binder list.

## Binder entry (existing)

Owner’s tradeable stock. Want List rows (`isWanted = true`) are **not** inputs.

| Field | Meaning |
| --- | --- |
| `printingId` | Printing key (`<product_id>-<subtype>`) |
| `quantity` | Copies; integer ≥ 1. Quantity &lt; 1 is treated as absent. |
| `card` / catalog row | Live Printing: name, finish, `isFoil`, TCG and CardMarket price fields |
| `condition` | Descriptive only; **not** a price input |
| Lent | Copies that remain in the Binder are included |

Validation: overlay input is the same Binder list the total control used. Do not mix Want List rows. Prefer live catalog prices over a stale Binder stub when both exist (web already merges via `catalogById`).

## Printing prices (catalog)

Observed fields only. Unpriced = `null` / missing / `NaN` / numeric `0`.

| Field | Marketplace | Currency | Overlay use |
| --- | --- | --- | --- |
| TCG Market (`tcgMarket` / `marketPrice`) | TCGplayer | USD | Market total |
| TCG Low (`tcgLow` / `lowPrice`) | TCGplayer | USD | Low total |
| CM Trend (`cmTrend` / `cardmarketTrend`, foil: `cmTrendFoil`) | CardMarket | EUR | Trend total |
| CM Low (`cmLow` / `cardmarketLow`, foil: `cmLowFoil`) | CardMarket | EUR | Low total |

Foil CardMarket: if `isFoil` (or finish name contains “foil”) and the foil field is priced, use it; else the non-foil field. Never substitute TCG for CM or the reverse.

Mid / High / Direct / Avg are **not** in this snapshot.

## Binder-value snapshot (derived)

Pure function of Binder entries + catalog + `source` (`tcgplayer` \| `cardmarket`). No I/O. Recomputed when the overlay opens (and if Binder/catalog change while open).

| Field | Rule |
| --- | --- |
| `copies` | Sum of quantities |
| `distinctPrintings` | Count of Binder rows (one Printing per row) |
| `foilCopies` | Sum of quantities where the Printing is foil |
| `regularCopies` | `copies − foilCopies` (must equal remaining Regular copies) |
| `tcgMarket` / `tcgLow` | `MoneyTotal` USD — see below |
| `cmTrend` / `cmLow` | `MoneyTotal` EUR — foil-aware |
| `tcgUnpricedCopies` | Copies with **neither** TCG Market nor TCG Low priced |
| `cmUnpricedCopies` | Copies with **neither** CardMarket Trend nor Low priced |
| `topPrintings` | 0–5 `TopPrinting`, never padded |

### MoneyTotal

| Field | Rule |
| --- | --- |
| `amount` | Sum of `qty × field` over priced copies; **`null` when `pricedCopies = 0`** (including empty Binder) |
| `pricedCopies` | Copies included in `amount` |
| `unpricedCopies` | Copies omitted because the field is unpriced |

`pricedCopies + unpricedCopies = copies` for that field.

### TopPrinting

| Field | Rule |
| --- | --- |
| `printingId` | Printing key |
| `name` | Card name (not a derived display string that hides finish) |
| `finish` | Finish / subtype as the Binder list already shows |
| `quantity` | Binder quantity |
| `contribution` | `qty × sourceValue` where `sourceValue` is priced |

Ranking: `contribution` descending, then `name` ascending, then `printingId` ascending. Skip printings with unpriced `sourceValue`. Cap at 5.

`sourceValue` for ranking / mobile chip:

- `tcgplayer`: TCG Market, else Low, else Mid, else High (`Pricing.value`)
- `cardmarket`: foil Trend if priced else Trend, else Avg, else Low (`Pricing.value`)

Web Binder header ranking uses TCG Market only (see research). Fixture cases split `headline: "pricingValue"` vs `headline: "tcgMarketOnly"`.

## Headline Binder value (display, not a third formula)

The string (or number) **already shown** on the Binder total control. The overlay copies it. It is not a `MoneyTotal` and may still treat missing source prices as contributing nothing (`?? 0` / `\|\| 0`) — that existing chip behavior stays. Marketplace `MoneyTotal`s stay honest (`—`).

## Overlay session (client UI state)

| Field | Rule |
| --- | --- |
| `open` | Boolean |
| `snapshot` | Derived from current Binder + catalog |
| `headline` | The Binder total as currently formatted on that surface |

State transitions:

```text
closed (Binder total hidden if empty)
  -- activate Binder total --> open (snapshot from current Binder)
open
  -- activate total again --> still one overlay (replace/refresh; never stack)
  -- Binder qty/catalog changes while open --> snapshot refreshes; headline follows the total control
  -- dismiss (close, backdrop, back/Escape/drag) --> closed; Binder list/tab/scroll unchanged
```

No mutations: opening or closing MUST NOT add, remove, or edit Binder rows.

## Out of model

- Want List totals
- Public shared Binder
- Price history / value-over-time
- Condition-adjusted prices
- Currency conversion
- New Settings keys
