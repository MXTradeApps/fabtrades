# Contract: Collection Stats page

Native page for the Binder that was open when the player activated Collection Stats. Overlay/sheet is not this contract.

## Identity

| Surface | Route / stack | Title |
| --- | --- | --- |
| Mobile | Pushed on the Binder tab navigator (`CollectionStatsScreen`) | Collection Stats; also show the open Binder’s name |
| Web | `/binder/stats` (not in hamburger) | Collection Stats; also show the open Binder’s name |

Leave/back restores the Binder list and scroll context. The page MUST NOT edit Binder quantities.

## Sections (top to bottom, both surfaces)

1. **Current total value** — chosen price source, formatted with existing `Pricing` / currency helpers. Source label visible (TCGplayer vs CardMarket). Unpriced copies are not shown as `$0.00` / `€0.00` on snapshot money rows.
2. **Top movers in this Binder** — gainers and losers, visually distinct. Loading / empty / error + retry. Empty: honest copy, no fake `$0` row. Error MUST NOT hide sections 1 and 3.
3. **Snapshot stats** — same content as the retired overlay: copies, distinct Printings, foil vs Regular, unpriced counts per marketplace, TCG Market/Low (USD), CardMarket Trend/Low (EUR), top five by headline contribution.

No Binder value-over-time chart, sparkline, or period-change on the total.

Layout may differ (mobile `ListView` vs web page columns). Numbers, vocabulary, and section meaning MUST match.

## Snapshot

Compute with existing `buildBinderValueSnapshot` / `binderValueSnapshot.js`, `headline: "pricingValue"`, entries = open Binder only. Display rules (unpriced glyph, foil CardMarket) match the retired dialog/sheet — port that UI, do not re-derive field math in the widget.

## Movers

See [binder-movers-read.md](./binder-movers-read.md). Selecting a mover row opens **that** Printing’s existing card details (mobile `CardDetailScreen` / web `openDetail` from catalog lookup of `card_id`). Back returns to Collection Stats.

Top-five rows MAY also open that Printing’s details (same identity rule). Not required to ship if the retired overlay did not; prefer matching the overlay plus movers.

## Data freshness

Snapshot and headline: live Binder + catalog already in memory; qty edits that happen if the player somehow changes Binder while the page is mounted SHOULD refresh (mobile providers already do this). Movers: fetch on open and when marketplace changes; ignore stale responses after source change or unmount.

## Credit

Values are observed catalog numbers, not an appraisal or a brokered sale. Marketplace groups labeled TCGplayer, CardMarket, Market, Low, Trend.
