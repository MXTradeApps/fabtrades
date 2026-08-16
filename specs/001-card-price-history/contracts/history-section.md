# Contract: Card details history section

UI contract for card details on **both** surfaces. Shared series math: [price-history-series.md](./price-history-series.md). Read: [price-history-read.md](./price-history-read.md).

## Placement

| Surface | Where |
| --- | --- |
| Mobile | Same page. Immediately **below** `_PriceCard`, above the rest of the scroll content / action bar. No new route. |
| Web | Existing card overlay (`CardDetailModal`). Immediately **below** `CardDetailPrices`, above Add to trade / Want List. No new route, no set-browse widget. |

Must not cover, replace, or delay the Prices box.

## Inputs

| Input | Mobile | Web |
| --- | --- | --- |
| Printing id | Selected Version (`CardModel.id`) | Selected Version (`shown._uniqueId`) |
| Marketplace | `AppSettings.source` | `PriceContext.priceSource` (default `tcgplayer`) |
| Pro | `isProProvider` (signed-out ⇒ false) | `useEntitlement().isPro` (signed-out ⇒ false) |
| Snapshots | [price-history-read](./price-history-read.md) | same |
| Span (Pro) | Local: `last30` (default on open) or `full` | Local: `last30` (default on overlay open) or `full` |

## Visible series

Same on both surfaces (fixture-backed):

1. Map each snapshot to Low for the selected marketplace only (`tcg_low` or `cm_low`).
2. Drop null Lows (gaps). Do not plot 0.
3. Default clip: last 30 **calendar** days, every player.
4. Pro may switch to all remaining observations; free/signed-out cannot.
5. Chart iff ≥ 2 Lows remain in the visible window.
6. Numeric change = last visible Low − first visible Low, formatted in that marketplace’s currency.

## States

| State | History section shows | Prices box | Pro CTA | Span control |
| --- | --- | --- | --- | --- |
| Loading | Compact placeholder / spinner | Visible | No | No |
| Error | Short failure + Retry | Visible | No | No |
| Empty (< 2 Lows) | “History not available yet” (or marketplace-specific empty when the other market would have had points) | Visible | No | No |
| Chartable, no older | Line + change summary + catalog attribution | Visible | No | No |
| Chartable, older, free, **mobile** | 30-day line + change + “See full history with Pro” | Visible | Yes | No |
| Chartable, older, free, **web** | 30-day line + change; **no** upgrade copy | Visible | No | No |
| Chartable, older, Pro | 30-day line by default + control to show full span / back | Visible | No | Yes |

## Interactions

| Action | Result |
| --- | --- |
| Mobile: tap / hold a point | Readout of that day’s date and Low. Does not navigate. Never `$0.00` / `€0.00` for a gap. |
| Web: hover (pointer) or tap (touch) a point | Same readout. Does not close the overlay. |
| Mobile: tap “See full history with Pro” | Existing paywall (`presentProPaywall`, trigger `price_history`). 30-day chart stays. |
| Web: (no equivalent) | Free players have no unlock control. |
| Pro: switch to full span | Older Lows appear; change summary recomputes for the new window. |
| Pro: switch back to 30 days | Window and summary revert. |
| Change Version | Load that Printing’s snapshots; previous line must not linger after the new series settles. |
| Change marketplace | Recompute Low from the same snapshots; empty if that Low series has no points. |
| Mobile: upgrade from CTA | Stay on 30-day default; span control appears if older snapshots exist. |
| Web: close overlay | Span choice resets; next open is 30-day default. |

## Copy constraints

- Credit that values are observed catalog Low, same source as today’s prices — not an appraisal.
- Do not promise history from before ingest started.
- Do not use “collection”; the rest of the surface already says Binder / Want List.
- Web empty-for-CardMarket copy should name the marketplace, not claim the Printing is unpriced in general.

## Non-goals (must not appear)

- Second line (Market / Mid / High).
- Blocking paywall or faded overlay over the 30-day chart.
- Web upgrade CTA, in-browser paywall, or app-store link from this section.
- Scrollable table of every day as the primary UI.
- Pinch-zoom required to read the default view.
- Set browse sparklines or a new full-page card route.
