# Contract: Price history read

Public catalog read. No new endpoint. Clients use the existing Supabase table.

## Query

```text
GET /rest/v1/fab_price_history
  ?card_id=eq.{printing_id}
  &order=captured_on.asc
  &select=card_id,captured_on,tcg_low,tcg_market,cm_low,cm_trend
```

| Client | Call |
| --- | --- |
| Mobile | `CardRepository.priceHistory(cardId)` — `.from('fab_price_history').select().eq('card_id', cardId).order('captured_on')` |
| Web | `priceHistory(printingId)` on `apps/web/src/services/fabDb.js` — same path via existing `restGet` |

| Parameter | Required | Meaning |
| --- | --- | --- |
| `card_id` | yes | Printing id (`<product_id>-<subtype>`). Web: overlay `_uniqueId`. |
| `order` | yes | `captured_on` ascending (oldest → newest) |

No date filter in v1. Window clipping is client-side (see [price-history-series.md](./price-history-series.md) and [history-section.md](./history-section.md)).

Auth: `anon` or `authenticated` bearer (web `fabDb` uses the publishable key). RLS policy `"Public read fab_price_history"` (`using (true)`). Service role is the only writer (pipeline).

## Response row

```json
{
  "card_id": "684123-foil",
  "captured_on": "2026-08-14",
  "tcg_low": 4.25,
  "tcg_market": 5.10,
  "cm_low": null,
  "cm_trend": null
}
```

| Field | Type | Null | Notes |
| --- | --- | --- | --- |
| `card_id` | string | no | Must equal the requested Printing |
| `captured_on` | ISO date `YYYY-MM-DD` | no | Calendar day, not a timestamp |
| `tcg_low` | number | yes | TCGplayer Low (USD). Chart Y when source is TCGplayer |
| `tcg_market` | number | yes | Ignored by the history chart |
| `cm_low` | number | yes | CardMarket Low (EUR). Chart Y when source is CardMarket. Currently always null while CardMarket ingest is disabled |
| `cm_trend` | number | yes | Ignored by the history chart |

Empty list `[]` is success: Printing has no snapshots yet → client empty state, not an error.

## Errors

| Case | Client behavior |
| --- | --- |
| Network / 5xx / timeout | History **error + retry**. Prices box unchanged. Overlay (web) / page (mobile) still usable. |
| Unknown `card_id` | `[]` (no row), not 404. Empty state. |
| Malformed row | Skip or fail that parse; do not coerce null Low to 0. |
| Stale response after Printing switch | Ignore; do not paint the previous Printing’s line. |

## Writes

Not part of this contract. Upserts remain pipeline-only (`on conflict (card_id, captured_on)`).
