# Contract: Web destinations (Trends vs Browse Sets)

Web-only chrome for FR-016, FR-017, and FR-021. Ranking is unchanged: [recent-movers.md](./recent-movers.md). Shared landing composition: [home-entry.md](./home-entry.md).

Mobile does **not** follow this split. On mobile, Home is one tab: movers then the set list on the same scroll.

## Destinations

| Label | Route | Role | Empty-search body | Search |
| --- | --- | --- | --- | --- |
| Trade Calculator | `/` | Unchanged balancer | Have / Want piles | Existing trade search (unchanged) |
| **Trends** | `/trends` | Movers landing | Recent movers (owned then catalog-wide, or catalog-wide only) | Catalog-wide Printing search. Clear → movers |
| **Browse Sets** | `/sets` | Set catalog | Existing set list | Catalog-wide Printing search. Clear → set list |
| My Binders | `/binder` | Unchanged | — | — |
| Trade History | `/history` | Unchanged | — | — |
| Want List | `/wants` | Unchanged | — | — |

Hamburger order of *existing* items stays: Trade Calculator, My Binders, Trade History, Want List. Insert **Trends** immediately before **Browse Sets**. Do not add Home. Do not rename `/` to Home.

`pages/Home.jsx` remains the Trade Calculator component. That filename is not a nav label.

## Forbidden mixes

| Must not | Why |
| --- | --- |
| Set list (or set-name-only search as the sole search) on `/trends` | FR-021, FR-017 |
| Recent movers on `/sets` | FR-021 |
| A hamburger or page title **Home** | FR-016 |
| Replacing `/` with Trends | Spec assumption |
| Printing search on only one of `/trends` or `/sets` | FR-017 |
| Redirect `/sets` → `/trends` or the reverse | Breaks SEO canonical `/sets` and Browse Sets |

## Routes and SEO

- Add `<Route path="/trends" element={<Trends />} />` in `App.jsx`. SPA fallback already covers unknown paths; no `netlify.toml` redirect required for `/trends`.
- Keep `/sets` and `/sets/:groupId` as they are. `generateSeoPages.js` and `canonicalPath: '/sets'` stay on Browse Sets.
- Trends may set a document title via existing `useDocumentHead`. Do not add a static SEO page for movers in this pass.

## Printing search (both destinations)

Both pages read the in-memory catalog (`useCardData`) and match Printings the same way (reuse `searchUtils.js` / equivalent; not set-name-only). Selecting a result calls existing `openDetail(printing)` with the snapshot Printing (`_uniqueId`).

| Page | Empty query | Non-empty query |
| --- | --- | --- |
| Trends | Movers section(s) | Printing results cover movers |
| Browse Sets | Set list (today’s grouped list) | Printing results cover the set list |

Today’s `/sets` filter is set name + abbreviation. After this feature that is **not** the primary search. A query that happens to match a set name still shows **Printings**, not a filtered set list, until the player clears search.

## Trends-only behavior

- Fetches `fab_recent_movers` (catalog-wide, and owned when Binder ids exist).
- Signed-out: catalog-wide only; owned omitted (no web Binder store).
- Signed-in: owned ids from already-loaded Binder entries; same hide/empty/error rules as [home-entry.md](./home-entry.md).
- Does not import or render `SetList` body.

## Browse Sets-only behavior

- Does not call `fab_recent_movers`.
- Set drill-in to `/sets/:groupId` unchanged.
- Movers loading/error on Trends MUST NOT affect this page.

## Tests

- Header: Trends and Browse Sets present; Home absent; `/` still Trade Calculator.
- `/trends`: movers on empty search; Printing search; clear returns movers; no set list.
- `/sets`: set list on empty search; Printing search; clear returns set list; no movers.
- Signed-out `/trends` and `/sets`: catalog search works without sign-in.
