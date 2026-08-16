# Contract: Card details history section

UI contract for the mobile card details page. Web has no equivalent surface.

## Placement

- Same page as card details. No new route.
- Immediately **below** the Prices box (`_PriceCard`), above the rest of the scroll content / action bar.
- Must not cover, replace, or delay the Prices box.

## Inputs

| Input | Source |
| --- | --- |
| Printing id | Currently selected Version (`CardModel.id`) |
| Marketplace | `AppSettings.source` (`tcgplayer` \| `cardmarket`) |
| Pro | `isProProvider` (signed-out ⇒ false) |
| Snapshots | Result of [price-history-read](./price-history-read.md) for that Printing |
| Span (Pro) | Local: `last30` (default on open) or `full` |

## Visible series

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
| Chartable, older, free | 30-day line + change + “See full history with Pro” | Visible | Yes | No |
| Chartable, older, Pro | 30-day line by default + control to show full span / back | Visible | No | Yes |

## Interactions

| Action | Result |
| --- | --- |
| Tap / hold a point | Readout of that day’s date and Low. Does not navigate. Never `$0.00` / `€0.00` for a gap. |
| Tap “See full history with Pro” | Existing paywall (`presentProPaywall`, trigger `price_history`). 30-day chart stays. |
| Pro: switch to full span | Older Lows appear; change summary recomputes for the new window. |
| Pro: switch back to 30 days | Window and summary revert. |
| Change Version | Load that Printing’s snapshots; previous line must not linger after the new series settles. |
| Change marketplace | Recompute Low from the same snapshots; empty if that Low series has no points. |
| Upgrade from CTA | Stay on 30-day default; span control appears if older snapshots exist. |

## Copy constraints

- Credit that values are observed catalog Low, same source as today’s prices — not an appraisal.
- Do not promise history from before ingest started.
- Do not use “collection”; the rest of the page already says Binder / Want List.

## Non-goals (must not appear)

- Second line (Market / Mid / High).
- Blocking paywall or faded overlay over the 30-day chart.
- Scrollable table of every day as the primary UI.
- Pinch-zoom required to read the default view.
