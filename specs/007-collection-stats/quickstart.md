# Quickstart: Binder Collection Stats

Manual check that the page, the deleted overlay, and the catalog-wide-only landing match [spec.md](./spec.md). Automated suites are the default; this is the table-side pass.

## Prerequisites

- Mobile: `apps/mobile` on a device/sim with a non-empty Binder (and a second Binder if you can).
- Web: signed-in owner on `/binder` with entries; catalog snapshot loaded.
- Backend already has `fab_recent_movers` (005 migration). No new migration for this feature.
- Price source set in Settings (try both TCGplayer and CardMarket).

## Automated

```bash
cd apps/web && npm test
cd apps/mobile && flutter test
```

Expect: snapshot and recent-movers goldens still pass; Collection Stats entry/page tests pass; Home/Trends owned-section tests now assert catalog-wide only; Binder-value sheet/dialog tests are gone or replaced.

## Manual — entry

1. Open a non-empty Binder. Confirm **Collection Stats** is visible and shows **no currency**.
2. Confirm the old floating/header total is gone.
3. Empty the Binder (or switch to an empty one). Confirm the button disappears.
4. Want List: no Collection Stats.
5. Activate Collection Stats. Confirm a **new page** (not a sheet/dialog over the list).

## Manual — page

1. Headline total uses the Settings source and names the Binder.
2. Snapshot: TCG Market/Low (USD), CardMarket Trend/Low (EUR), copies, foil/regular, unpriced counts, top five. Unpriced is `—`, never `$0.00`.
3. Movers: only Printings in **this** Binder; copies shown; up vs down obvious. A catalog-wide gainer you do not hold here is absent.
4. Open a second Binder that does not hold that Printing; its Collection Stats must not list it.
5. Select a mover → existing card details for that Printing → back to Collection Stats.
6. Back from Collection Stats → same Binder, same list.
7. Switch marketplace in Settings, reopen: movers and Low-based figures rebuild; no leftover other-source rows.
8. No value-over-time chart on the page.

## Manual — removals

1. Mobile Home / web Trends: catalog-wide movers and search still work. **No** owned movers section, empty state, or teaser, whether Binders are empty or full.
2. Cannot reopen the old Binder-value overlay (no chip, no dialog, no sheet).
3. Web hamburger has no Collection Stats item; `/binder/stats` is reached from `/binder` only.

## Expected outcomes

| Check | Pass |
| --- | --- |
| SC-001 | Page + headline within 5s of the button |
| SC-002 | Back restores Binder work |
| SC-004 / SC-014 | This-Binder movers only; Home/Trends owned section gone |
| SC-005 / SC-008 | Snapshot and headline honest vs Binder list |
| SC-015 | Overlay unreachable |
