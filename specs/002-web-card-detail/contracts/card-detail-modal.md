# Contract: Card detail modal

Web-only UI contract. Peer to mobile card details; not a public HTTP API.

## Open / close

| Input | Behavior |
| --- | --- |
| `openDetail(printing)` | Opens or replaces the single modal for that Printing. Page route unchanged. |
| Dismiss (close control, backdrop click, Escape) | Closes. Live trade, Binder, filters, scroll remain. Focus returns to the page. |
| Second `openDetail` while open | Replaces contents; no second dialog. |

Must not navigate to a card URL in v1.

## Contents (selected Printing)

Top to bottom, matching mobile’s glance:

1. Art (tap → zoom inside this experience; dismiss zoom returns here)
2. Name, set / collector identity, finish
3. Own N if signed in and this Printing is in Binder
4. Versions (when ≥2 siblings) — selecting one updates 1–3 and Prices
5. **Prices** — TCGplayer group and CardMarket group; unpriced is — never $0 / €0; catalog attribution
6. Actions

Loading/missing art must not hide name or Prices. Failed image: missing-art state, not a blank dialog.

## Actions

| Action | When shown | Result | Modal |
| --- | --- | --- | --- |
| **Add to trade** | `pathname === '/'` and Want-add is registered | Adds this Printing to live trade **Want** | Stays open + brief success confirmation |
| **Want List** | Always offered | Signed in + under cap: upsert Want List; over cap: existing limit/upgrade; signed out: SignInDialog | Stays open; success confirmation only when the add actually happened |
| Scan / lends / Trade Filler | Never | — | — |

**Add to trade** from Have-pile inspect still goes to **Want**.

## Prices display

| Marketplace | Fields | Currency |
| --- | --- | --- |
| TCGplayer | Market, Low, Mid, High, Direct low | USD |
| CardMarket | Trend, Low, Avg | EUR |

A missing or zero catalog value renders as unpriced (`—`). Do not substitute the other marketplace.

## Confirmation

Reuse the existing success Snackbar pattern (short, bottom, dismissable). Do not close the dialog as the confirmation.
