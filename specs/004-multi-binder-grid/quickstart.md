# Quickstart: Multi-Binder Grid

Validation after implementation. Model: [data-model.md](./data-model.md). UI: [contracts/entry-points.md](./contracts/entry-points.md). Rules: [contracts/binders.md](./contracts/binders.md), [contracts/binder-move.md](./contracts/binder-move.md), [contracts/free-limits.md](./contracts/free-limits.md).

## Prerequisites

```bash
cd apps/web && npm install && npm test
cd apps/mobile && flutter test
```

Apply the multi-binders migration to the local/staging Supabase the apps already use. Catalog snapshot unchanged.

## Automated checks

```bash
cd apps/web && npm test
cd apps/mobile && flutter test
```

Expected:

- Both suites pass extended `free_limits.json` (`binders: 4`, shared `binderCards`, move does not consume slots).
- Both suites pass `binder_move.json`, `binder_cover.json`, `binder_names.json`.
- Confirm Trade tests decrement/add **Trade Binder** only.
- Public binder helper / RPC tests return Trade Binder rows, not Collection.

## Manual — grid (P1)

1. Mobile signed-out: Binder tab shows Trade Binder and Collection. Empty Collection has 0, zero value, no cover. Open Trade Binder; back returns to the grid. Want List tab still works and is not a tile.
2. Mobile with existing Binder cards (pre-update data): those cards are in Trade Binder; Collection is empty; tile count/value match the list.
3. Web signed-in `/binder`: same two tiles; `/wants` unchanged. Tile cover on a non-empty Trade Binder is that Binder’s highest-value card art.

## Manual — Want List (P1)

1. From the Binder grid, open Want List in one step (mobile tab / web `/wants`).
2. Want List cards do not change any Binder tile count or value.

## Manual — move (P2)

1. Put qty 3 of a Printing in Trade Binder. Move 2 to Collection. Lists and tiles match (1 vs 2). Covers update if the top card changed.
2. Move into a Binder that already has that Printing + condition: quantities merge.
3. Want List is not offered as a destination.

## Manual — manage (P3)

1. Free player: create a third Binder with a unique name; rename it; delete it while empty.
2. Rename collision (including `collection` vs `Collection`) is refused.
3. Delete Trade Binder is refused (empty or not).
4. Delete Collection with cards is refused until moved/removed.
5. Fourth Binder allowed on free; fifth opens Pro upgrade and does not create a Binder.
6. Signed-in: rename on mobile appears on web after Binders are available there (no wait to show the name already on the device).

## Done when

- [ ] Web `npm test` and mobile `flutter test` green, including the new/extended fixtures on **both**
- [ ] Grid is the Binder home; Want List is still reachable and not a Binder
- [ ] Trade Binder is not deletable; Collection is empty-to-delete
- [ ] Shared 50-card cap and 4-Binder cap match the fixture; 5th create is Pro upgrade
- [ ] Confirm Trade / share / filler use Trade Binder only
- [ ] `docs/CONTEXT.md` and constitution vocabulary updated in the same change
- [ ] Pipeline ingest unchanged
