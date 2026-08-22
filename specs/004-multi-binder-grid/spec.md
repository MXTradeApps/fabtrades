# Feature Specification: Multi-Binder Grid

**Feature Branch**: `004-multi-binder-grid`

**Created**: 2026-08-21

**Status**: Draft

**Input**: User description: "in the binder tab, there should be a grid view of multiple binders that the user has. The default ones should be "Trade Binder" and "Collection". Want list should still be accessible. You should be able to move cards between binders. The thumbnail view of each binder should show the name, number of cards, and the value of the binder. The trade binder should not be deletable."

## Clarifications

### Session 2026-08-21

- Q: When a free player hits the distinct-card limit, does that limit apply to all Binders together, or separately to each Binder? → A: Shared distinct-card cap across all Binders (Want List stays separate); free users are limited to 4 Binders.
- Q: Can two Binders have the same name? → A: Duplicate names are not allowed. Binder names still persist on web as well as mobile.
- Q: Besides name, card count, and value, should each Binder tile also show a card image? → A: Yes — a cover image of the highest-value card in that Binder; empty Binders show no picture.
- Q: When a free player already has 4 Binders and tries to create another, should they see the Pro upgrade, or only a limit message? → A: Show the Pro upgrade; no 5th Binder is created until they have Pro.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See my Binders as a grid (Priority: P1)

A player opens the Binder destination. Instead of landing inside a single list of cards, they see a **grid of Binders they own**. Every new player has two Binders waiting for them:

- **Trade Binder** — the cards they are willing to trade away
- **Collection** — the cards they own but are not offering for trade

Each tile is a thumbnail of that Binder. At a glance they can read:

- the Binder **name**
- how many **cards** are in it
- the Binder **value** (the same kind of total they already trust from the green Binder value)
- a **cover image** of the highest-value card in that Binder (empty Binders show no picture)

Tapping or clicking a tile opens that Binder's card list. From there they work the list the way they already do (add, quantity, inspect, value detail). A clear back action returns them to the grid, not to a different destination.

**Why this priority**: Without the grid and the two defaults, there is no feature. This is the new home of the Binder tab.

**Independent Test**: Open the Binder destination as a new player (empty stock) and as a player who already had Binder cards. Confirm the grid shows Trade Binder and Collection, each with name, card count, and value. Non-empty Trade Binder shows a cover of its highest-value card; empty Collection shows no cover. Open Trade Binder, then return to the grid. Existing Binder cards appear in Trade Binder, not Collection.

**Acceptance Scenarios**:

1. **Given** a player who has never created extra Binders, **When** they open the Binder destination, **Then** they see a grid that includes Trade Binder and Collection.
2. **Given** the grid is showing, **When** they look at a tile for a Binder that has priced cards, **Then** it shows that Binder's name, card count, value, and a cover image of its highest-value card.
3. **Given** the grid is showing, **When** they look at an empty Binder tile, **Then** it shows name, card count 0, a true-zero value, and no cover image.
4. **Given** the grid is showing, **When** they activate a tile, **Then** they see that Binder's card list (not Want List, not another Binder's cards).
5. **Given** they are inside a Binder's card list, **When** they go back, **Then** they return to the Binder grid with the same Binders visible.
6. **Given** a player who already had tradeable-stock cards before this feature, **When** they open the grid, **Then** those cards are in Trade Binder and Collection starts empty.
7. **Given** a signed-out player with Binders already on the device, **When** they open the Binder destination, **Then** the grid and Binder lists are available without creating an account.

---

### User Story 2 - Reach Want List without losing it (Priority: P1)

Want List is not a Binder. The player can still get to their Want List from the same Binder area of the app they use today, in one obvious step, after the Binder destination becomes a grid.

They do not have to open Trade Binder or Collection to find Want List. Want List cards are not mixed into any Binder's count or value.

**Why this priority**: The request is explicit that Want List stays accessible. Hiding it behind a Binder would be a regression of a core trader surface.

**Independent Test**: From the Binder destination (grid showing), open Want List and confirm it is the existing Want List (not a Binder named Want List). Return to the Binder grid. Confirm Want List cards did not change any Binder tile's count or value.

**Acceptance Scenarios**:

1. **Given** the Binder grid is on screen, **When** the player looks for Want List, **Then** it is reachable without opening a Binder first.
2. **Given** they have cards on Want List and cards in Trade Binder, **When** they compare the two surfaces, **Then** Want List cards do not appear in any Binder tile's card count or value.
3. **Given** they open Want List and then return, **When** they are back, **Then** they see the Binder grid again (or the Want List surface they already used on that platform), not a blank Binder.

---

### User Story 3 - Move cards between Binders (Priority: P2)

The player has the same Printing in the wrong pile — for example in Collection when they now want to offer it, or in Trade Binder when they want to keep it. From a Binder's card list they move some or all copies of a Printing into another of their Binders.

The source Binder loses that quantity. The destination Binder gains it. If the destination already has that Printing, quantities combine. Binder tile counts and values on the grid update to match.

Moving is not deleting. It is not adding to Want List.

**Why this priority**: Two default Binders only pay off if stock can change piles. The grid can ship without move, but move is the reason Collection exists beside Trade Binder.

**Independent Test**: Put a Printing with quantity 3 in Trade Binder. Move 2 copies to Collection. Confirm Trade Binder shows 1 remaining, Collection shows 2, and both tiles' counts and values match the lists.

**Acceptance Scenarios**:

1. **Given** a Printing in Trade Binder and an empty Collection, **When** the player moves that Printing to Collection, **Then** it is gone from Trade Binder and present in Collection with the same quantity, finish, and condition.
2. **Given** quantity 4 of a Printing in one Binder, **When** they move 2 copies to another Binder, **Then** 2 remain in the source and 2 appear in the destination.
3. **Given** the destination already has that Printing, **When** they move more copies in, **Then** the destination quantity is the sum and there is still one row for that Printing.
4. **Given** they just moved cards, **When** they return to the grid, **Then** each tile's card count and value reflect the new piles.
5. **Given** they are looking at Want List, **When** they use Binder-to-Binder move, **Then** Want List is not offered as a destination (Want List is not a Binder).

---

### User Story 4 - Add, rename, and delete Binders (Priority: P3)

The player can create additional named Binders (for a side event, a keep pile, a friend's cards they are holding, and so on), up to **4 Binders total on the free tier**. Each Binder MUST have a unique name. They can rename any Binder to another unused name. They can delete Collection and user-created Binders once those Binders are empty.

**Trade Binder cannot be deleted.** It is always on the grid. The player cannot remove the tradeable-stock Binder from their set. They may rename Trade Binder; the renamed Binder is still the one used for trades.

Collection can be renamed or deleted (once empty). User-created Binders can be renamed or deleted (once empty). Deleting a Binder does not delete Trade Binder and does not strand cards in an invisible pile.

**Why this priority**: The grid is built for "Binders the user has," which can grow. The non-deletable Trade Binder is the safety rail. Creating extra Binders is valuable after the two defaults and move already work.

**Independent Test**: Create a Binder named "Side Event", add no cards, rename it, then delete it. Attempt to delete Trade Binder and confirm the product refuses. Confirm Trade Binder is still on the grid.

**Acceptance Scenarios**:

1. **Given** a free player with fewer than 4 Binders (or a Pro player), **When** they create a new Binder with a unique name, **Then** a new tile appears with that name, 0 cards, and an empty value.
2. **Given** a user-created Binder or Collection, **When** they rename it to a name no other Binder uses, **Then** the tile and the open Binder header show the new name.
3. **Given** a Binder already named "Side Event", **When** they try to create or rename another Binder to "Side Event" (including different capitalization or extra spaces), **Then** the change is refused and no second Binder has that name.
4. **Given** Trade Binder, **When** they rename it to a unique name, **Then** the tile shows the new name, it still cannot be deleted, and Trade Filler / Confirm Trade still use that Binder as tradeable stock.
5. **Given** Trade Binder, **When** they try to delete it, **Then** deletion is refused and Trade Binder remains on the grid (empty or not).
6. **Given** Collection or a user-created Binder that still has cards, **When** they try to delete it, **Then** deletion is refused until they move or remove the cards.
7. **Given** Collection or a user-created Binder with 0 cards, **When** they delete it, **Then** it leaves the grid and its cards are not in any other Binder (there were none).
8. **Given** they deleted Collection, **When** they view the grid, **Then** Trade Binder is still present and they can create a new Binder named Collection if they want that pile back and they are under their Binder-count limit.
9. **Given** a free player who already has 4 Binders, **When** they try to create another, **Then** they see the Pro upgrade, no 5th Binder is created, and their existing Binders are unchanged.
10. **Given** they renamed or created Binders on one surface while signed in, **When** they open Binder on the other peer surface after their Binders are available there, **Then** each Binder shows the same unique name.

---

### Edge Cases

- **Empty Binder tile**: Card count is 0. Value is a true zero in the player's chosen currency (no copies, so nothing is unpriced). There is no cover image. The tile is still tappable and opens an empty list.
- **Cover image with unpriced cards**: If the Binder has copies but none have a catalog price for the chosen source, the tile still shows a cover (a stable pick among those Printings, e.g. by name) rather than looking empty.
- **All copies unpriced**: Card count is still the number of copies. Value is shown as unpriced for that Binder, never as a fake $0.00 / €0.00 of missing catalog numbers — same rule as today's Binder total.
- **Duplicate Binder names**: Not allowed. Create or rename that would match another Binder's name (ignoring letter case and extra spaces) is refused. The player can reuse "Collection" only after that Binder is deleted. Renaming a Binder to its own current name is allowed.
- **Very long Binder names**: The tile remains identifiable (name is readable or truncates with a way to see the full name when opened).
- **Many Binders**: The grid scrolls. The player can still reach Trade Binder, Collection (if it exists), Want List, and create/delete actions without hunting off-screen with no way back.
- **Move and the shared distinct-card cap**: A move does not increase how many distinct cards the player owns, so it MUST NOT be refused for the shared card cap. Source and destination quantities still must stay valid.
- **Free player at 4 Binders**: Creating another Binder opens the Pro upgrade. No 5th Binder is created unless they already have Pro. They can still open, rename, move cards, and delete empty Binders (except Trade Binder). Deleting an empty Binder frees a slot so they can create without Pro.
- **Pro player past 4 Binders**: Creating further Binders is allowed; the 4-Binder limit is free-tier only.
- **Move of quantity 0 or more than the source holds**: Not allowed. Source quantity never goes negative.
- **Same Printing, different condition**: Condition stays with the copies that move. Copies do not merge across different conditions.
- **Confirm Trade / Trade Filler**: Only **Trade Binder** is tradeable stock. Filler suggests from Trade Binder. Confirm Trade removes given copies from Trade Binder and adds received copies to Trade Binder. Collection and other Binders are not auto-reconciled.
- **Scan or pick-add while a Binder is open**: New cards enter the open Binder. If the player adds from the grid (no Binder open), new tradeable adds go to Trade Binder.
- **Lent copies**: Copies that remain in a Binder still count toward that Binder's card count and value, matching today's Binder-value rule.
- **Want List vs Collection**: Collection is owned cards. Want List is cards to acquire. Moving between Binders never writes Want List.
- **Deleted Collection while Trade Binder exists**: Valid. Grid can show only Trade Binder plus any user-created Binders.
- **Offline / signed out**: Grid, open, move, create, rename, and delete work on Binders already on the device. An account is not required to organize local Binders.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Binder destination MUST open on a grid of the player's Binders rather than on a single undifferentiated card list.
- **FR-002**: Every player MUST start with two default Binders named **Trade Binder** and **Collection** if those Binders have not been removed by the player (Trade Binder cannot be removed).
- **FR-003**: Each Binder tile MUST show that Binder's **name**, **card count**, **value**, and a **cover image** of the Printing with the largest contribution to that Binder's value (quantity × the same price source as the tile total). An empty Binder MUST show no cover image. A Binder that has copies but no priced contribution MUST still show a cover (stable pick among those Printings) so it does not look empty.
- **FR-004**: Card count on a tile MUST be the total number of copies in that Binder (sum of quantities), not Want List copies, and not copies in other Binders.
- **FR-005**: Tile value MUST use the same price source and quantity-weighted rules as that Binder's green Binder total. Unpriced copies MUST NOT display as zero. An empty Binder MAY show a true zero.
- **FR-006**: Activating a tile MUST open that Binder's card list. Back MUST return to the Binder grid.
- **FR-007**: Want List MUST remain reachable from the Binder area of the app without opening a Binder first. Want List MUST NOT be modeled as a Binder tile, MUST NOT accept Binder-to-Binder moves, and MUST NOT contribute to Binder tile counts or values.
- **FR-008**: The player MUST be able to move some or all copies of a Printing from one of their Binders to another. Identity (Printing, finish, condition) MUST be preserved. Destination quantities MUST merge when the same Printing and condition already exist there.
- **FR-009**: After a move, both Binders' lists, tile card counts, tile values, and cover images MUST match the new quantities (covers follow the new highest-value Printing, or none if a Binder is now empty).
- **FR-010**: The player MUST be able to create additional named Binders while under their Binder-count limit. New Binders start empty. A free player MUST NOT have more than **4 Binders** (Trade Binder and Collection count toward the 4). A Pro player is not limited to 4 Binders. Creating a Binder that would exceed the free limit MUST show the **Pro upgrade**, MUST NOT create a 5th Binder, and MUST NOT delete existing Binders or cards.
- **FR-011**: The player MUST be able to rename any Binder, including Trade Binder. Binder names MUST be unique per player (letter case and extra spaces do not make a name distinct). Create or rename that would duplicate another Binder's name MUST be refused; the existing Binders MUST be unchanged. Renaming a Binder to its own current name MUST succeed. Renaming Trade Binder MUST NOT make it deletable and MUST NOT change which Binder is tradeable stock.
- **FR-012**: Trade Binder MUST NOT be deletable, including when it is empty.
- **FR-013**: Collection and user-created Binders MUST be deletable only when they contain zero copies. A delete attempt on a non-empty Binder MUST be refused and MUST tell the player to move or remove the cards first.
- **FR-014**: Existing tradeable-stock cards from before this feature MUST appear in Trade Binder. Want List entries MUST remain Want List entries. Collection MUST start empty for those players.
- **FR-015**: Trade Filler and Confirm Trade MUST use Trade Binder as the only tradeable stock. Received cards enter Trade Binder. Given cards leave Trade Binder. Other Binders MUST NOT be silently edited by Confirm Trade.
- **FR-016**: Adding a card while a Binder is open MUST add it to that Binder. Adding a tradeable card from the Binder grid (no Binder open) MUST add it to Trade Binder.
- **FR-017**: Organizing Binders (grid, open, move, create, rename, allowed delete) MUST work without an account when the data is already on the device.
- **FR-018**: The same Binder grid behavior MUST be available on both peer surfaces (mobile and web). Layout may be native to each surface; names, name uniqueness, counts, values, move rules, and the non-deletable Trade Binder MUST match.
- **FR-019**: A copy MUST belong to at most one Binder at a time. Moving is a transfer, not a duplicate, unless the player later adds another copy.
- **FR-020**: Free-tier distinct-card limits MUST be a **shared cap across all Binders** (not per Binder). Adding a new distinct Printing that would exceed the cap MUST be refused without deleting existing cards. Moving copies between Binders MUST NOT consume extra cap slots and MUST NOT be refused for that cap. Want List keeps its separate cap.
- **FR-021**: The free-tier Binder-count limit MUST be **4 Binders**. Trade Binder counts as one of the 4 even when empty. Collection counts as one of the 4 while it exists. Pro MUST be able to create more than 4 Binders. A free player who tries to create a 5th Binder MUST see the Pro upgrade rather than only a dead-end limit message.
- **FR-022**: Binder names MUST persist on the device that created or renamed them. For a signed-in player, those names MUST appear the same on web and mobile once Binders are available on that surface. Uniqueness MUST be enforced on both surfaces. The grid MUST NOT wait on the network to show names already on the device.

### Key Entities

- **Binder**: A named pile of owned Printings that belong to the player. A player can have several Binders. Display names MUST be unique per player. This is the type; **Collection** is a Binder's default display name, not a different product noun.
- **Trade Binder**: The default Binder that is **tradeable stock**. Always present. Not deletable. Used by Trade Filler and Confirm Trade. Existing pre-feature Binder cards live here.
- **Collection**: The default Binder for owned cards the player is **not offering for trade**. Present for new and migrating players. Can be renamed or deleted once empty.
- **Binder tile**: Grid thumbnail for one Binder, showing name, card count, value, and a cover image of the highest-value Printing (no cover when empty).
- **Want List**: Cards the player wants to acquire. Not a Binder. Unchanged in purpose; still accessible from the Binder area of the app.
- **Binder value**: Quantity-weighted total of a Binder's copies using the player's chosen price source (the same figure the green total already shows for a single Binder).
- **Move**: Transfer of one or more copies of a Printing from a source Binder to a destination Binder.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the Binder destination, a player can see all of their Binders, including Trade Binder and Collection (when Collection still exists), in one screen without opening each list first.
- **SC-002**: A first-time player can identify Trade Binder and Collection by name on that screen in under 10 seconds.
- **SC-003**: Each tile shows name, card count, value, and the correct cover (highest-value card when the Binder has copies; no cover when empty), and 100% of name/count/value figures match the Binder's list for the same snapshot (count = sum of quantities; value = that Binder's total).
- **SC-004**: A player can open a Binder from the grid and return to the grid in two actions (open, back) without losing their place in the app.
- **SC-005**: A player who already used Want List can open Want List from the Binder area without opening a Binder first, on the first attempt.
- **SC-006**: A player can move copies from Trade Binder to Collection (or the reverse) and see both lists and both tiles update correctly in one move, without recreating the cards.
- **SC-007**: 100% of attempts to delete Trade Binder fail, and Trade Binder remains on the grid.
- **SC-008**: A signed-out player with on-device Binders can complete grid, open, and move without creating an account.
- **SC-009**: After migration, 100% of previously tradeable Binder cards are in Trade Binder and 0% of Want List cards appear as Binder cards.
- **SC-010**: At least 90% of first-time testers asked "which pile is for trading?" choose Trade Binder from the grid without help.
- **SC-011**: A free player cannot create a 5th Binder; they see the Pro upgrade, and afterward they still have exactly 4 Binders and the same cards.
- **SC-012**: Moving a Printing from Trade Binder to Collection does not change the player's shared distinct-card count (no extra free slot is granted or consumed).
- **SC-013**: After a signed-in player names or renames a Binder on one surface, the other surface shows that same name for that Binder, and no two Binders share a name on either surface.

## Assumptions

- **Collection is owned-not-for-trade.** Naming the second default Collection is intentional. The domain type remains Binder. Trade Binder is the only tradeable stock. This expands the old "Binder is the only owned pile" model.
- **Want List stays a sibling, not a tile.** On mobile it remains the other view in the Binder destination. On web it remains the existing Want List destination. Either way it is one step from the Binder area and is not a Binder.
- **Players can create more Binders** beyond the two defaults. The grid is for N Binders, not a fixed pair.
- **Binder names are unique per player.** Letter case and extra spaces do not make a name distinct. Names persist locally and appear the same on web and mobile for a signed-in player; already-on-device names still show without waiting for the network.
- **Trade Binder can be renamed; its role cannot.** Deleting it is never allowed. Renaming it does not create a second tradeable Binder and does not make Collection tradeable. Renaming it to "Collection" is refused while Collection still exists.
- **Empty-to-delete.** Cards are never silently dumped into Trade Binder or destroyed by deleting a Binder.
- **Copies are exclusive.** A physical copy lives in one Binder. Move transfers it.
- **Partial quantity moves are allowed.**
- **Card count is copies**, because that is what traders mean by "how many cards are in this Binder." Distinct Printing count remains available inside Binder value detail when that overlay is open.
- **Cover image is the highest-value Printing** in that Binder using the same price source as the tile total. Empty Binders have no cover. Binders with only unpriced copies still show a cover (stable name order) so they do not look empty.
- **Tile value equals that Binder's existing total**, including lent copies that still sit in the Binder. Settings price source is unchanged. No new Settings control.
- **Migration is one-way and lossless** for existing Binder and Want List rows.
- **No account gate to use Binders already on the device.** Extra Binders beyond 4 are Pro: the create action shows the Pro upgrade instead of creating a 5th Binder. Free players have a shared distinct-card cap across all Binders and a maximum of 4 Binders. Want List stays on its own card cap. The grid is still shown to free players (they start with Trade Binder and Collection, so 2 of 4 slots used).
- **Both peer surfaces.** Mobile Binder tab and web Binder destination both become a grid. Want List accessibility follows each surface's current entry pattern.
- **Public Binder share (web)** continues to share Trade Binder (the trade list). Sharing Collection or custom Binders is out of scope.
- **Binder value detail** (the overlay from the green total) remains an inspect of the *open* Binder, not of the whole grid.

## Out of Scope

- Treating Want List as a Binder, or moving cards from a Binder onto Want List via this move action (existing "add to Want List" is unchanged).
- Nested Binders, folders, or tags.
- Sharing or publishing Collection and custom Binders.
- Decks, set-completion binders, or cost-basis / purchase-price tracking.
- Changing how catalog prices are sourced, or condition-adjusted pricing.
- Requiring an account to see or organize Binders.
- Automatically moving Collection cards during Confirm Trade.
- Binder value-over-time charts.
- Cross-player Binder transfer (giving a Binder to someone else).
