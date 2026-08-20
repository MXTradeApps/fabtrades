# Contract: Binder value detail overlay

UI contract for the inspect surface opened from the Binder total. Peer chrome; same content and vocabulary.

## Open / close

| Input | Behavior |
| --- | --- |
| Activate the Binder total control | Opens the overlay over the Binder. Route/tab unchanged. |
| Dismiss (close control, backdrop, back / Escape / drag-down on the sheet) | Closes. Binder list, tab, quantities, and scroll remain. |
| Activate the total while already open | One overlay; contents refresh. Never stack. |
| Empty Binder | Total control is hidden; overlay is not opened. |

Must not navigate to a new Binder-stats page. Must not mutate Binder rows.

## Contents (top to bottom)

1. **Binder value** — the same formatted total as the control that was activated, labeled Binder value. Show which source that number uses (TCGplayer / CardMarket) so it is not confused with the four rows below.
2. **TCGplayer (USD)** — Market, Low. Each shows amount or `—`, and unpriced copy count when `unpricedCopies > 0`.
3. **CardMarket (EUR)** — Trend, Low. Same unpriced rule. Foil-aware fields.
4. **Stock** — copies, distinct Printings, foil copies, Regular copies. Marketplace-level unpriced copies (neither figure) when &gt; 0.
5. **Top Printings** — up to five rows: name, finish, quantity, contribution in the headline source’s currency. Section omitted when the list is empty (all unpriced for source), not filled with placeholders.

Loading: Binder + catalog are already present; the overlay MUST NOT block on a new fetch. If a Printing has no live catalog row, still count it and treat missing fields as unpriced.

## Labels (trader language)

Use **Binder**, **Printing**, **TCGplayer**, **CardMarket**, **Market**, **Low**, **Trend**. Do not say Collection, inventory, or “CardMarket Market.”

## Surfaces

| Surface | Chrome | Headline source label |
| --- | --- | --- |
| Mobile Binder tab | Modal bottom sheet | Settings price source |
| Web `/binder` | Dialog (close, backdrop, Escape) | TCGplayer (header is Market today) |

Want List and `/b/:token` shared Binder: this overlay is not offered.

## Account

Inspect MUST work wherever the Binder total is already visible (mobile signed-out local Binder; web when the owner’s Binder page has loaded entries). Do not add a sign-in wall in front of the numbers.
