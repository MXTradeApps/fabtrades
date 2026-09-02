# Contract: Movers-landing search presentation

UI contract for catalog search **while it is covering** the movers landing. Ranking chrome for empty search remains [../../005-card-gainers-losers/contracts/home-entry.md](../../005-card-gainers-losers/contracts/home-entry.md). Overlay math/read: [printing-recent-changes.md](./printing-recent-changes.md), [printing-recent-changes-read.md](./printing-recent-changes-read.md).

## In scope

| Surface | Search empty | Search non-empty |
| --- | --- | --- |
| Web `/trends` | Ranked recent movers (005). No set list | **Trend boxes** for matching Printings. Ranked movers not shown underneath |
| Mobile Home (tab 0 root) | Ranked movers + set list (005) | **Trend boxes** for matching Printings. Movers and set list not shown underneath |
| Web `/sets` | Set list | **Existing catalog list** (`CatalogPrintingResults`). Not trend boxes |
| Mobile `SetCardsScreen` | — | **Existing in-set list**. Not trend boxes |

Clearing search on Trends/Home restores that surface’s empty-search body (movers; mobile also the set list). Clearing Browse Sets search restores the set list.

## Trend box (Trends / Home search only)

Visually consistent with ranked mover boxes (same chrome: thumbnail treatment, identity, current Low, change when present).

| Element | Rule |
| --- | --- |
| Identity | Name, set, finish (one box per Printing) |
| Current Low | Selected marketplace catalog Low; unpriced if null, never `$0.00` / `€0.00` |
| Change | Overlay percent + currency, up vs down color, only when a displayable overlay exists |
| No overlay | Omit the change line. No 0%, dash, or “No recent move” copy |
| Under-floor | If overlay exists, **show** it |
| Select | Existing card details for **that** catalog Printing |
| Back from details | Same query; same boxes still visible |

Testers must tell matches from a re-ranked “biggest movers” list: one result stream, name-match (plus Home’s existing sort), not two gainer/loser sections.

## Sort

| Surface | Sort |
| --- | --- |
| Mobile Home global search | Keep existing catalog-search sort on these boxes |
| Web Trends | No new sort control |
| Either | MUST NOT add percent-change as a dedicated sort |

## Loading and failure

- Boxes paint from in-memory catalog without waiting on `fab_printing_recent_changes`.
- Overlay fetch is debounced; stale responses ignored.
- Overlay error: boxes remain; retry control may sit with the figures, not replace the whole body with a spinner.
- Ranked movers loading/error MUST NOT disable search (005 FR-011). Overlay error MUST NOT disable ranked movers after clear.
- Signed-out: same catalog-wide boxes as signed-in free. No account wall.

## Out of scope (must not)

| Change | Why |
| --- | --- |
| Trend boxes on Browse Sets | FR-009 |
| Trend boxes on in-set mobile search | FR-010 |
| Sparkline / history chart in the box | Out of scope; details owns history |
| Split search into gainers vs losers | FR-005 |
| Hide under-floor name matches or their honest change | Clarification A |
| Remove Home sort or add Trends sort | Clarification B |
| Call `fab_recent_movers` to populate search boxes | Wrong eligibility |
| Pad missing change with 0% / dash / copy | Clarification C / FR-006 |

## Tests

- Web Trends: type a name → boxes (not `ListItem` name-and-price rows); percent visible when overlay exists; under-floor fixture card still shows change; no-overlay omits change line; clear → ranked movers; select → details for that Printing.
- Web Browse Sets: type a name → still list; no mover-box grid.
- Mobile Home: global search → boxes; existing sort still changes order; in-set search stays a list.
- Signed-out Trends/Home: search boxes without sign-in.
- Overlay RPC failure: boxes still listed; no invented percents.
