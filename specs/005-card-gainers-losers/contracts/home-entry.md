# Contract: Movers landing (recent movers)

UI contract for where recent movers live and how they compose with search. Web destination split: [web-destinations.md](./web-destinations.md). Ranking/read: [recent-movers.md](./recent-movers.md), [recent-movers-read.md](./recent-movers-read.md).

## In scope

| Surface | Control | When shown | Action |
| --- | --- | --- | --- |
| Mobile tab 0 | Navigation label **Home** | Always | Was Browse. Not a fifth tab. Trade, Binder, Lend unchanged |
| Mobile tab 0 | App bar title **Home** | Root of tab 0 | Was Browse |
| Mobile tab 0 | `CardSearchBar` “Search all cards…” | Always | Existing global Printing search; does not wait on movers |
| Mobile tab 0 | Recent movers (owned + catalog-wide) | Empty search | Owned first if Binders have qty > 0; catalog-wide below |
| Mobile tab 0 | Existing set list | Empty search, below movers | One step (scroll). Drill-in to a set is unchanged |
| Mobile tab 0 | Scan action | Unchanged | Still from Home app bar |
| Web hamburger / drawer | Nav item **Trends** → `/trends` | Always | New. Not labeled Home. Insert immediately before Browse Sets |
| Web hamburger / drawer | Nav item **Browse Sets** → `/sets` | Always | Unchanged label and route. Must not become Home |
| Web hamburger / drawer | Home item | Never | Website MUST NOT have a Home page or Home nav item |
| Web `/trends` | Catalog Printing search | Always | Find Printings across every set without opening a set (FR-017) |
| Web `/trends` | Recent movers | Empty search | Same owned-then-catalog composition as mobile Home. No set list |
| Web `/sets` | Catalog Printing search | Always | Primary search is Printings, not set-name-only (FR-017) |
| Web `/sets` | Existing set list | Empty search | No movers on this page (FR-021). `/sets/:groupId` unchanged |
| Either movers row | Select | Always when a row exists | Open **that** Printing’s existing details (mobile screen / web overlay) |
| Either Printing search result | Select | Search non-empty | Same existing details |
| Either movers list | Marketplace | Follows existing source | Rebuild both owned and catalog-wide; drop leftover rows |

## Labels and credit

- Player-facing name of the lists: **recent movers** (not weekly, not “this week”).
- Web destination that hosts those lists: **Trends**.
- Two distinct views: **owned** vs **catalog-wide** (section headings the tester can tell apart without a tutorial — SC-011).
- Gainers vs losers visually distinct (up vs down) without reading every number (SC-002).
- Caption that values are **observed catalog Lows** (same catalog as today’s prices), not a brokered sale (FR-014).
- Currency and % both visible on each row (FR-004). Existing price formatters; never `$0.00` / `€0.00` for a missing Low.

## Search cover

| Surface | Search | Body |
| --- | --- | --- |
| Mobile Home | Empty | Movers (as composed above) + set list |
| Mobile Home | Non-empty | Catalog Printing results only. Movers and set list are not shown underneath |
| Web Trends | Empty | Movers only (no set list) |
| Web Trends | Non-empty | Catalog Printing results only. Clearing search returns to movers, not to Browse Sets |
| Web Browse Sets | Empty | Set list (no movers) |
| Web Browse Sets | Non-empty | Catalog Printing results only. Clearing search returns to the set list, not to Trends |

Selecting a Printing result opens that Printing’s details. Search MUST remain usable when movers are loading, empty, or in error (FR-011, FR-017, SC-007). Web Browse Sets does not fetch movers; search there must not wait on Trends.

Printing search uses the catalog already in memory (mobile `catalogProvider`; web `useCardData`). Reuse existing name matching (`filterCards` / `searchUtils.js`). Do not cap at the trade-autocomplete 10. Do not require opening a set first.

## Owned section visibility

Applies only on the movers landing (mobile Home; web Trends). Not on web Browse Sets.

| Local Binder state | Owned section |
| --- | --- |
| No Printings with qty > 0 in any Binder (including signed-out web) | **Omitted** — not a blank card |
| ≥1 owned Printing, RPC returns rows | Gainers/losers lists (≤10 each) |
| ≥1 owned Printing, RPC returns `[]` | Honest empty copy first; catalog-wide still below |
| Owned fetch error | Brief failure/retry in the owned slot; catalog-wide independent |

Catalog-wide empty vs error follow the same pattern in the catalog-wide slot.

## Out of scope (must not)

| Surface | Why |
| --- | --- |
| Fifth tab or primary “Movers” dest | FR-001 / FR-016 |
| First mobile tab still labeled Browse | FR-016 |
| Mobile Home landing = set catalog only | Clarification |
| Web page or hamburger item labeled Home | FR-016 / 2026-08-26 |
| Movers on web Browse Sets, or set list on web Trends | FR-021 |
| Replace web `/` trade calculator | Spec assumption |
| Require sign-in for catalog-wide | FR-012 |
| Pro gate / upgrade CTA on movers | Assumptions |
| Want List on owned lists | FR-019 |
| Single list with a catalog/owned switcher | FR-018 |
| Alerts, extra windows, dollar-primary sort | Out of scope |
| History chart duplicated on the movers landing | Card details already owns it |
| Pad lists to 10 with invented rows | FR-008 |
| Catalog search on only one of web Trends or Browse Sets | FR-017 |

## Navigation back

Details opened from a movers row: back / overlay close returns to the movers landing (same tab / `/trends`), not to a stranded set page. Details opened from Browse Sets search: overlay close stays on `/sets`. Switching Versions on details follows existing details rules; the movers lists themselves stay as last fetched until marketplace change or retry.

## Tests that must move with the label

Mobile smoke, integration, and onboarding copy that `find.text('Browse')` on the tab bar must expect **Home**. Welcome carousel may still mention browsing sets; it MUST NOT require a tab labeled Browse.

Web Header tests MUST assert **Trends** and **Browse Sets**, and MUST NOT assert a Home nav item. `pages/Home.jsx` remaining the trade calculator is not a player-facing Home.
