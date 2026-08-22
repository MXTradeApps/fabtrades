# Contract: Multi-Binder entry points

## In scope

| Surface | Control | When shown | Action |
| --- | --- | --- | --- |
| Mobile Binder tab (index 0) | Binder grid | Binder destination, Binder half selected | Default home. Tiles: name, count, value, cover |
| Mobile Binder tab | Tile | Live Binder | Opens that Binder’s existing list UI |
| Mobile Binder list | Back | Drill-in | Returns to grid, same Want List tab index |
| Mobile Binder tab (index 1) | Want List | Unchanged sibling tab | Existing Want List; not a Binder tile |
| Mobile Binder list | Move | Row in an open owned Binder | Destination = another live Binder; qty 1…n |
| Mobile Binder grid | Create | Always visible | Under cap: new Binder. At 4 free: Pro upgrade, no row |
| Web `/binder` | Binder grid | Owner Binder page | Same tile contract as mobile |
| Web `/binder` drill-in | Existing list chrome | One Binder selected | Add/qty/value overlay scoped to that Binder |
| Web `/wants` | Want List | Unchanged route | Not a Binder; no move-into-Want-List |

Add-to-Binder (search, scan, card detail): if a Binder is open, that Binder; if the player is on the grid (or no Binder open), Trade Binder. Want List adds still set `isWanted`.

## Out of scope (must not)

| Surface | Why |
| --- | --- |
| Want List as a grid tile | FR-007 |
| Move destination = Want List | FR-007 |
| Web `/b/:token` showing Collection | Share is Trade Binder only |
| Delete control on Trade Binder | FR-012 — hide or no-op with refusal |
| Signed-out web `/binder` local grid | Do not invent on-device web Binder |
| Confirm Trade editing Collection | FR-015 |

## Empty and missing

- New player: two tiles (Trade Binder, Collection), both empty (0, true-zero value, no cover).
- After migration: existing owned cards on Trade Binder; Collection empty.
- Catalog image missing for the cover Printing: tile still shows name/count/value; image slot empty is allowed, do not invent art.

## Onboarding / copy

Binder tour MAY mention the grid and Trade Binder vs Collection. Not a ship blocker. Do not teach Want List as a Binder.
