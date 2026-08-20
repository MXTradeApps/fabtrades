# Quickstart: Binder Value Detail

Validation after implementation. Math: [data-model.md](./data-model.md), [contracts/binder-value-snapshot.md](./contracts/binder-value-snapshot.md). Overlay: [contracts/binder-value-modal.md](./contracts/binder-value-modal.md), [contracts/entry-points.md](./contracts/entry-points.md).

## Prerequisites

```bash
cd apps/web && npm install && npm test
cd apps/mobile && flutter test
```

No migration. Use the existing catalog snapshot and a Binder with a few Printings (priced, unpriced, foil, qty &gt; 1).

## Automated checks

```bash
cd apps/web && npm test
cd apps/mobile && flutter test
```

Expected:

- Both suites pass `binder_value_snapshot.json` (quantity, foil CM, null/0 omitted, all-unpriced `amount` null, top-five cap and ties).
- Unpriced fields never format as `$0.00` / `€0.00`.
- Mobile: tapping the green chip on a non-empty Binder tab opens the sheet; dismiss leaves the list; Want List tab has no chip.
- Web: clicking the `/binder` total opens the dialog; `/wants` total does not; dismiss leaves the list.

## Manual — open (P1)

1. Mobile: Binder tab with cards. Tap the green total. Sheet overlays Binder; headline matches the chip. Dismiss (drag/back). List and qty unchanged.
2. Web: signed in, `/binder` with cards. Click the header total. Dialog overlays Binder; headline matches the header. Dismiss (X, backdrop, Escape).
3. Empty Binder: no total control, no overlay.

## Manual — marketplace totals (P2)

1. Include at least one Printing with TCG Market and Low, one with a missing Low, one foil with distinct CM foil vs non-foil figures if the catalog has them.
2. Confirm TCG Market / Low (USD) and CardMarket Trend / Low (EUR) equal qty × field for priced copies only.
3. Missing/zero fields show `—` and an unpriced copy count, not `$0`.
4. Mobile: switch Settings to CardMarket. Chip/headline follow Settings; the four marketplace rows still both show.

## Manual — stock and top five (P3)

1. Copies, distinct Printings, foil vs Regular match the list.
2. Top rows are the largest contributors to the **headline** source, max five, with name, finish, qty, contribution.
3. A Binder of two priced Printings lists two, not five blank rows.

## Done when

- [ ] Web `npm test` and mobile `flutter test` green, including the new contract fixture on **both**
- [ ] Green chip / web Binder total opens one overlay; Want List and shared Binder do not
- [ ] Headline matches the control; TCG + CardMarket Low/Market (Trend) are honest field sums
- [ ] Unpriced never shows as zero
- [ ] Dismiss does not edit the Binder
- [ ] Pipeline / schema unchanged
