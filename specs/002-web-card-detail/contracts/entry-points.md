# Contract: Card detail entry points

Every catalog card **name** and **thumbnail** on web that represents a Printing opens the same detail modal ([card-detail-modal.md](./card-detail-modal.md)). Name/thumb never add, remove, or change quantity.

## Surfaces

| Surface | Route | Name | Thumbnail | Add-to-pile (unchanged, separate) |
| --- | --- | --- | --- | --- |
| Trade Have / Want | `/` | Opens details | Opens details | Panel search / qty / delete |
| Search results | `/` (and Binder search) | Opens details | Opens details | Distinct add / row-select (not the name) |
| Set detail | `/sets/:groupId` | Opens details | Opens details | TCGplayer buy link stays on the page |
| Binder | `/binder` | Opens details | Opens details | Page qty / version select |
| Want List | `/wants` | Opens details | Opens details | Page qty / version select |
| Shared Binder | `/b/:token` | Opens details | Opens details | Page **Add to trade** if present |
| Trade history lines | `/history` | Opens details when Printing is resolvable | Same | — |

Set **list** (`/sets`) shows sets, not cards — no change.

## Search split

| Control | Effect |
| --- | --- |
| Name | `openDetail`; does not add |
| Thumbnail | `openDetail`; does not add |
| Remaining add control / keyboard-select | Existing `onSelect` add |

## Art-only overlay

List and tile surfaces MUST NOT open `CardImageModal` as the inspect path. Zoom is only inside the detail modal.

## Unresolvable rows

If a displayed name has no Printing id and cannot be looked up in the catalog, it is not a details control (plain text).
