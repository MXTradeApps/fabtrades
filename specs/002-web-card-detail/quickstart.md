# Quickstart: Web Card Detail Modal

Validation after implementation. States and entry rules: [data-model.md](./data-model.md), [contracts/card-detail-modal.md](./contracts/card-detail-modal.md), [contracts/entry-points.md](./contracts/entry-points.md).

## Prerequisites

```bash
cd apps/web
npm install
npm test
npm run dev
```

Catalog snapshot from a normal web build/dev flow is enough. No new migration. Sign-in (optional) for Want List / Own N. A live trade on `/` for **Add to trade**.

## Automated checks

```bash
cd apps/web
npm test
```

Expected:
- `printingsForCard` returns only siblings of the opened Printing; switching input Printing changes the set.
- Prices helper: `null` and `0` render as `—`, never `$0.00` / `€0.00`.
- Modal: dismiss leaves parent; **Add to trade** absent when not on `/`; present on `/` and calls Want add; success does not unmount the dialog.
- `SearchOption`: activating name/thumb does not call `onSelect`; add control still does.
- List/set tests: thumb/name no longer only open a standalone art overlay.

## Manual — inspect (P1)

1. Open `/` with two piles. Click a Have **name**. Modal overlays Home; Prices (TCG + CM) visible; piles still there behind.
2. Dismiss (X, backdrop, Escape). Trade unchanged.
3. Signed out: still see art + Prices.

## Manual — entry points (P2)

1. Name and thumbnail on: trade piles, search result, `/sets/:id`, `/binder` or `/wants` (signed in), `/b/:token`, `/history`.
2. Each opens the **same** detail pattern, not an art-only overlay.
3. Search: click name → details, card **not** added; use add control to add.

## Manual — Versions (P3)

1. Open a card with Normal + foil (or two sets). Initial Printing matches what you clicked.
2. Switch Version: art and Prices follow; no leftover numbers from the previous finish.

## Manual — actions (P4)

1. On `/`: **Add to trade** present → Want side grows (even from a Have card); Snackbar; modal still open. Switch Version and add again.
2. On `/sets/:id`: **Add to trade** absent. Want List: signed out → sign-in; signed in under cap → added, modal stays; over cap → existing limit/upgrade, no fake success.
3. Signed in with that Printing in Binder: Own N visible.

## Done when

- [ ] `npm test` green
- [ ] Named cards + thumbs open details on every listed surface
- [ ] Art-only list overlay gone
- [ ] Balancer-only Want add; other pages inspect (+ Want List)
- [ ] Unpriced never shows as zero
- [ ] Mobile app unchanged
