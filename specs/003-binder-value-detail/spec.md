# Feature Specification: Binder Value Detail

**Feature Branch**: `003-binder-value-detail`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "There should be a detail modal that comes up when you click on the green binder value. This should be a more detailed view of your binder value, TCG low, market, card market low, market, and other interesting stats."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Binder value from the green total (Priority: P1)

A player is on their Binder. They already see a green running total of what that Binder is worth. They tap or click that total. A **detail modal** opens over the Binder and shows a fuller picture of the same stock — not a different page, not a new account wall.

Closing the modal returns them to the same Binder list, tab, and scroll position. The Binder itself is unchanged.

**Why this priority**: This is the feature. The green total is already the glance; the request is that it opens a trustworthy breakdown instead of doing nothing.

**Independent Test**: With at least one Binder card, activate the green Binder total. Confirm a detail modal appears with a Binder value that matches the total they tapped, and that dismissing it leaves the Binder list unchanged.

**Acceptance Scenarios**:

1. **Given** the Binder tab is showing a green total (Binder is not empty), **When** the player activates that total, **Then** a detail modal appears over the Binder (the Binder behind is not replaced).
2. **Given** the modal is open, **When** they dismiss it (close control, tap/click outside, or the platform's back/Escape gesture), **Then** they are back on the same Binder with the same list and scroll context.
3. **Given** the modal is open, **When** they read the headline Binder value, **Then** it matches the green total they opened from, using the same price source they already chose in Settings.
4. **Given** a signed-out player with Binder cards already on the device, **When** they open the modal, **Then** they can read the breakdown without signing in.
5. **Given** the Binder tab is empty, **When** there is no green total, **Then** there is no Binder-value control to open (the modal is not a dead empty screen).

---

### User Story 2 - Compare marketplace Low and Market totals (Priority: P2)

Inside the modal the player can see what the whole Binder is worth under each marketplace figure they already trust on a single card:

- **TCGplayer Market** and **TCGplayer Low** (US dollars)
- **CardMarket Trend** (CardMarket's market-equivalent) and **CardMarket Low** (euros)

Each total is quantity-weighted: a Printing with quantity 3 contributes three times that Printing's catalog number. Missing catalog prices are **unpriced**, never zero. The player can tell how many copies were left out of a given total because they have no number for that marketplace.

They do not have to open every card, change Settings, or visit another site to get this comparison.

**Why this priority**: The green total is one number from one source. The request is specifically TCG Low/Market and CardMarket Low/Market. That comparison is the reason to open the modal.

**Independent Test**: Build a Binder with mixed priced and unpriced Printings. Open the modal and confirm the four marketplace totals equal quantity × catalog price for priced copies only, with unpriced copies counted separately and never shown as $0 / €0.

**Acceptance Scenarios**:

1. **Given** Binder Printings with TCGplayer Market and Low, **When** the modal is open, **Then** the player sees a TCGplayer Market total and a TCGplayer Low total in US dollars, each equal to the sum of (that field × quantity) across priced copies.
2. **Given** Binder Printings with CardMarket Trend and Low, **When** the modal is open, **Then** the player sees a CardMarket Trend total and a CardMarket Low total in euros, each equal to the sum of (that field × quantity) across priced copies. Foil Printings use CardMarket's foil figures when those exist.
3. **Given** a Printing with no TCGplayer Low (or no CardMarket Low), **When** that Printing is in the Binder, **Then** it does not contribute $0 / €0 to that marketplace total; the modal shows it as unpriced for that figure and reports how many copies were omitted.
4. **Given** the player's Settings use one marketplace, **When** they open the modal, **Then** they still see **both** TCGplayer and CardMarket totals (the modal is the comparison; Settings still drive the green chip).
5. **Given** lent cards that remain in the Binder, **When** the modal totals run, **Then** those copies are included in Binder value the same way they are included in the green total today.

---

### User Story 3 - See other Binder stats that explain the total (Priority: P3)

The same modal answers "what is this pile, besides the dollars?" without becoming a collection tracker. The player can see:

- **Copies** in the Binder (sum of quantities) and **distinct Printings**
- **Foil vs Regular** copy counts
- **Unpriced copies** per marketplace (so a surprisingly low total is explainable)
- **Top Printings by value** — the handful of Printings that make up most of the Binder, each with name, finish, quantity, and contribution using the same price source as the green total

This is a snapshot of current catalog numbers, not a value-over-time chart.

**Why this priority**: "Other interesting stats" only help if they explain the total at a glance. Counts, unpriced gaps, and concentration can ship after the marketplace totals already have value.

**Independent Test**: Open the modal on a Binder with several Printings, including at least one foil and one unpriced. Confirm copy/printing counts, foil vs Regular, unpriced counts, and a top-value list that a player can reconcile against the Binder list.

**Acceptance Scenarios**:

1. **Given** a Binder with multiple quantities, **When** the modal is open, **Then** the player sees total copies and distinct Printing count, and those numbers match the Binder list.
2. **Given** a mix of foil and Regular Printings, **When** the modal is open, **Then** foil copy count and Regular copy count are shown and sum to total copies.
3. **Given** some copies have no TCGplayer price and/or no CardMarket price, **When** the modal is open, **Then** the player can see how many copies are unpriced for each marketplace.
4. **Given** at least one priced Printing, **When** the modal is open, **Then** the player sees up to five Printings ranked by contribution to the green-total Binder value (quantity × that source's value), each labeled with name, finish, quantity, and contribution. Ties are ordered stably enough that the same Binder produces the same list.
5. **Given** fewer than five priced Printings, **When** the modal is open, **Then** the list includes every priced Printing and does not pad with empty rows or invent cards.

---

### Edge Cases

- Activating the total twice: only one Binder-value modal; a second activation does not stack a second copy on top.
- All copies unpriced for a marketplace: that marketplace's Low/Market (Trend) totals show as unpriced, with a copy count, never as $0.00 / €0.00.
- Quantity 0 must not occur; if a row would contribute nothing, it is not in the Binder and not in the modal.
- Very large Binders: the modal remains usable (scroll the stats if needed) and still opens from one tap on the total; it does not freeze the Binder behind.
- Want List tab: the green Binder-value control is Binder-tab only. Opening Want List does not show this modal's entry point.
- Condition grades (NM/LP/MP/HP/DMG): if mentioned at all, they stay descriptive. Totals MUST NOT be adjusted by condition.
- Currency: TCGplayer figures stay in US dollars and CardMarket figures stay in euros in the same view; the product does not silently convert one into the other.
- Catalog prices that later appear or disappear: the modal uses the same live catalog snapshot the Binder list uses; it does not cache a stale private total.
- Onboarding that highlights the green total: after the tour, that control still opens this modal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Binder total control (the green Binder value on the Binder tab) MUST be activatable and MUST open a Binder-value detail modal over the current Binder.
- **FR-002**: The modal MUST overlay the Binder and MUST NOT navigate the player away from it. Dismiss MUST restore the same Binder tab, list, and scroll context with no Binder edits as a side effect.
- **FR-003**: The modal MUST show a headline **Binder value** that matches the green total, using the player's chosen price source.
- **FR-004**: The modal MUST show quantity-weighted **TCGplayer Market** and **TCGplayer Low** totals in US dollars.
- **FR-005**: The modal MUST show quantity-weighted **CardMarket Trend** and **CardMarket Low** totals in euros. Foil Printings MUST use CardMarket foil figures when those exist for the Printing.
- **FR-006**: Totals MUST use observed catalog prices only. Unpriced MUST display as unpriced, never as zero. A copy missing a given field MUST be omitted from that field's total and counted in that field's unpriced copy count.
- **FR-007**: The four marketplace totals MUST appear regardless of which price source Settings currently uses. Settings continue to drive the green total and the headline Binder value.
- **FR-008**: The modal MUST show total copies, distinct Printing count, foil copy count, and Regular copy count for the Binder (not the Want List).
- **FR-009**: The modal MUST show how many copies are unpriced for TCGplayer and how many are unpriced for CardMarket.
- **FR-010**: The modal MUST list up to five Printings with the largest contribution to the headline Binder value, each with name, finish, quantity, and contribution. It MUST NOT invent Printings or pad the list.
- **FR-011**: Inspecting Binder value MUST work without an account when the Binder is already available on the device.
- **FR-012**: Lent copies that remain in the Binder MUST be included in every total the same way they are included in the green Binder value.
- **FR-013**: The same Binder-value detail MUST be available from the Binder total on both peer surfaces (mobile and web). Layout may be native to each surface; the numbers and vocabulary MUST match.
- **FR-014**: Loading or missing catalog data MUST be obvious (the rest of the modal still shows identity of the Binder snapshot). The product MUST NOT fabricate a price or a top Printing to fill space.
- **FR-015**: Marketplace groups MUST be labeled in the trader's language (TCGplayer, CardMarket, Market, Low, Trend) so a player can tell which number is which without guessing.

### Key Entities

- **Binder**: The player's tradeable stock. This modal is about Binder entries only (not Want List, not a full collection).
- **Printing**: A specific physical version of a card (set + finish). Binder rows and value contributions are always per Printing × quantity.
- **Binder value**: The headline total already shown in green, from the player's chosen price source, quantity-weighted across Binder Printings.
- **Marketplace totals**: Quantity-weighted sums of a single catalog field across the Binder: TCGplayer Market, TCGplayer Low, CardMarket Trend, CardMarket Low.
- **Binder-value detail modal**: Overlay inspect surface opened from the Binder total. Contains headline Binder value, marketplace totals, counts, unpriced gaps, and top Printings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a non-empty Binder, a player can open the value breakdown in one activation of the green total and see it without leaving the Binder.
- **SC-002**: After dismiss, they can continue Binder work immediately — same tab, same list, same quantities (no restart).
- **SC-003**: A player can read TCGplayer Market, TCGplayer Low, CardMarket Trend, and CardMarket Low for the whole Binder within 5 seconds of the modal opening.
- **SC-004**: 100% of priced copies are reflected in the matching marketplace total (quantity × catalog field). Unpriced copies never appear as $0.00 or €0.00.
- **SC-005**: A signed-out player with an on-device Binder can complete inspect without creating an account.
- **SC-006**: Copy count, distinct Printing count, and foil vs Regular counts match the Binder list for the same snapshot.
- **SC-007**: The headline Binder value in the modal matches the green total the player tapped, every time they open it on an unchanged Binder.
- **SC-008**: At least 90% of first-time testers who are asked "what is my Binder worth on TCG Low vs CardMarket Low?" can answer from the modal without opening individual cards.

## Assumptions

- **Entry point is the existing Binder total.** On mobile that is the green Binder-value chip on the Binder tab. On web that is the Binder's displayed total. Want List does not get this control.
- **CardMarket "market" is Trend.** Card details already treat Trend as CardMarket's market-equivalent. This modal uses the same names so one card and the whole Binder speak the same language.
- **Quantity-weighted, condition-blind.** Quantity multiplies each Printing's catalog number. Condition never changes a price.
- **Unpriced is omitted, not zeroed.** Today's green chip may still treat a missing chosen-source price as contributing nothing to the running total; the modal MUST still label those copies unpriced rather than showing $0 / €0 for a marketplace field.
- **Both surfaces, owner's Binder only.** Mobile and web Binder for the signed-in/on-device owner. A public shared Binder view is unchanged in v1.
- **Snapshot, not history.** No Binder value-over-time chart (already deferred as a later Binder idea). No user-entered sold prices.
- **Top five is enough.** Concentration is the interesting extra stat; a full sorted-by-value Binder rewrite is out of scope.
- **No new Settings.** The modal shows both marketplaces; it does not add a second price-source picker.
- **No account gate.** Same "no gate before value" rule as the rest of Binder inspect.
- **Lent copies stay in the total**, matching the existing Binder-value rule.

## Out of Scope

- Want List totals or a Want List version of this modal.
- Public shared Binder value breakdown.
- Binder value-over-time / portfolio charts.
- Additional catalog-field totals (TCGplayer Mid/High/Direct low, CardMarket Avg) as first-ship rows.
- Condition-adjusted pricing.
- Changing how the green chip itself is calculated beyond making it open this modal.
- Requiring an account to see Binder value.
- Export, share-image, or Discord paste of the breakdown.
