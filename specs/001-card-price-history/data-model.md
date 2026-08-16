# Data Model: Card Price History

No new Postgres tables. This feature reads existing catalog rows and derives a view-model for the chart. The derived rules are shared; chrome differs by surface.

## Existing storage

### Printing (`fab_cards` / catalog card)

Already on device (mobile cache) or in the web catalog snapshot. History is keyed by the same id Binder and trade rows use.

| Field | Source | Notes |
| --- | --- | --- |
| `id` | `fab_cards.id` | `"<product_id>-<subtype>"`, e.g. `684123-foil`. Mobile: `CardModel.id`. Web: `_uniqueId`. |
| current Low / Market / … | `fab_card_prices` via `fab_cards_with_prices` | Prices box only; not plotted |

Relationship: one Printing has many Price snapshots.

### Price snapshot (`fab_price_history`)

One observed catalog capture for a Printing on a calendar day. Written by the nightly pipeline; clients only SELECT.

| Field | Type | Chart use |
| --- | --- | --- |
| `card_id` | text → `fab_cards.id` | Filter |
| `captured_on` | date | X axis (date-only `YYYY-MM-DD`) |
| `tcg_low` | numeric, nullable | Y when marketplace is TCGplayer |
| `cm_low` | numeric, nullable | Y when marketplace is CardMarket |
| `tcg_market`, `cm_trend` | numeric, nullable | **Ignored** by this chart |

Constraints (already in schema):
- Unique `(card_id, captured_on)` — same-day re-ingest overwrites.
- Null Low means unpriced that day, not zero.
- Public read (`anon` + `authenticated`). No client writes.

Validation at the client boundary:
- `captured_on` is a calendar date (`YYYY-MM-DD`). Do not interpret as UTC midnight.
- Low values stay nullable numbers. Never default null to `0`.

## Derived entities (client)

Shared by Dart `PriceHistorySeries` and JS `priceHistorySeries`. Golden cases: [packages/contracts/price_history_series.json](../../packages/contracts/price_history_series.json).

### Low observation

A snapshot that has a usable Low for the **selected** marketplace.

| Field | Rule |
| --- | --- |
| `date` | Calendar date of `captured_on` |
| `low` | `tcg_low` or `cm_low` according to marketplace; must be non-null |

A snapshot with Market/Trend filled and Low missing is **not** an observation.

### Price series (visible window)

The sequence of Low observations shown on the chart.

| Field | Rule |
| --- | --- |
| `window` | `last30` (default) or `full` (Pro opt-in only) |
| `points` | Observations with `date >= windowStart` when `last30`; else all observations |
| `windowStart` | Today’s local calendar date minus 29 days (inclusive 30-day span) |
| `hasOlder` | At least one observation with `date < windowStart` |
| `chartable` | `points.length >= 2` |
| `delta` | `points.last.low - points.first.low` when chartable; else absent |
| `currency` | USD for TCGplayer, EUR for CardMarket |

Marketplace source:
- Mobile: `AppSettings.source`
- Web: `PriceContext.priceSource` (`tcgplayer` \| `cardmarket`)

State transitions:

```text
fetch idle/loading
    ├─ error ──────────────► error (retry) ──► loading
    ├─ 0–1 usable Lows in window ──► empty (not chartable)
    └─ ≥2 usable Lows in window ──► chartable
         ├─ mobile, free/signed-out + hasOlder ──► chart + Pro CTA
         ├─ web, free/signed-out + hasOlder ──► chart only (no CTA)
         ├─ Pro + hasOlder ──► chart + span control (default last30)
         │                      last30 ←→ full (local; resets on details open)
         └─ no older ──► chart only (no CTA, no span control)
```

Printing change (selected id changes) returns to **loading** for the new id; the previous series must not remain visible once the new fetch has settled (SC-004). Marketplace change recomputes the series from the same snapshots without a new fetch. Closing the web overlay resets Pro span to `last30`.

### Entitlement (read-only)

Mobile `isProProvider` / web `useEntitlement().isPro` → `true` / `false`. Signed-out is free. This feature never writes `entitlements`.

## UI sibling (not an entity)

**Prices box**:
- Mobile: `_PriceCard`
- Web: `CardDetailPrices` (lists both marketplaces; the chart still follows the selected one)

History must not hide, delay, or replace it.

## Out of model

- Condition-adjusted prices
- User-entered sold prices
- Binder / Want List value-over-time
- Aggregating multiple Printings that share a name
- Web set-browse sparklines or a full-page card route
- Web upgrade CTA / in-browser billing from this section
