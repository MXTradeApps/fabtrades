# Feature Specification: Card Price History

**Feature Branch**: `001-card-price-history`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "Im trying to make a price history feature for fabtrades. It should live in the card details page underneath the pricing box."

## Clarifications

### Session 2026-08-14

- Q: Who can see the full price history under the Prices box? → A: Free players see a short recent window (last 30 days); Pro sees the full span
- Q: When a free player has more than 30 days of history, should the truncated chart offer a way to unlock the rest? → A: Quiet “See full history with Pro” under the chart; tap opens the upgrade flow
- Q: Which price should the history chart plot? → A: One line, Low only (TCGplayer Low, or CardMarket Low if that marketplace is selected)
- Q: Can a player inspect an exact day on the history chart? → A: Tap or hold a point to see that day’s date and Low
- Q: How should a long Pro history stay readable as months of daily Lows accumulate? → A: Default to show only the last 30 days (Pro can switch to the full recorded span)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See this printing's price over time (Priority: P1)

A player opens a card's details to decide whether a trade is fair. They already see today's prices. Directly under that Prices box they see how this **Printing**'s **Low** has moved — one line of observed Low prices, plus a short summary of the change (for example, up or down since the oldest Low point shown).

The chart **defaults to the last 30 days** for everyone, so the line stays readable at the table. Free and signed-out players cannot go further; they see a quiet “See full history with Pro” when older snapshots exist. FABTrades Pro players can switch from that default to the **full recorded span**, and back. Today's Prices box is never hidden.

They do not leave the page, hunt a separate history screen, or invent a trend from memory. Tapping or holding a point on the line shows that day’s date and Low.

**Why this priority**: This is the feature. Current prices answer "what is it now"; history answers "is this a spike or the usual." Both belong in the same glance at the table.

**Independent Test**: Open any card details page that has at least two days of recorded Low prices. Confirm a history section appears immediately under the Prices box and that the movement summary matches the first and last observed Low points.

**Acceptance Scenarios**:

1. **Given** a Printing with two or more recorded daily Low prices in the player's allowed window, **When** the player opens card details, **Then** a price history section appears directly under the Prices box (not above it, not on another tab).
2. **Given** the Prices box is visible, **When** history is loading, missing, or truncated, **Then** today's prices remain fully visible and usable.
3. **Given** a history with a first and last observed Low in the allowed window, **When** the section renders, **Then** the player can tell whether Low went up, down, or stayed flat over that span, including the size of the change in currency.
4. **Given** the player's selected marketplace (TCGplayer or CardMarket), **When** history is shown, **Then** the single line is that marketplace's Low, never Market/Mid/High, and never a second line.
5. **Given** a free or signed-out player and more than 30 days of snapshots, **When** they open card details, **Then** the history section only includes points from the last 30 days, and a quiet “See full history with Pro” control appears under the chart.
6. **Given** a Pro player and more than 30 days of snapshots, **When** they open card details, **Then** the chart still defaults to the last 30 days, no upgrade control is shown, and a control is available to show the full recorded span.
7. **Given** a Pro player on the default 30-day view with older snapshots, **When** they switch to the full span, **Then** older Low points appear and the change summary updates to that span; they can switch back to 30 days.
8. **Given** a free player with more than 30 days of snapshots, **When** they tap “See full history with Pro”, **Then** the existing upgrade flow opens and the 30-day chart stays visible underneath (not replaced by a blocking wall).
9. **Given** a chartable Low series, **When** the player taps or holds a point, **Then** they see that day’s date and Low, not a fabricated value for a gap.

---

### User Story 2 - History follows the selected Printing (Priority: P2)

A card has several Printings (Normal, Cold Foil, Rainbow Foil, alt art). The player taps a different version. The Prices box updates, and the history under it updates to that Printing — not the card name as a whole.

**Why this priority**: FAB Trades prices Printings, not names. A foil history mixed into a Normal chart would lie about the trade.

**Independent Test**: Open a card with at least two Printings that have different price paths. Switch versions and confirm the history series changes with the selection.

**Acceptance Scenarios**:

1. **Given** a card with multiple Printings, **When** the player selects another version, **Then** the history section shows that Printing's snapshots only.
2. **Given** a Printing with no recorded history, **When** the player selects it, **Then** they see an empty/unavailable history state, not another Printing's line.

---

### User Story 3 - Honest empty, sparse, and failure states (Priority: P3)

History only exists for days the catalog actually captured. New Printings, unpriced days, and a failed load must not look like a crash or like a $0 card.

**Why this priority**: Fake zeros and silent failures would undermine trust in the Prices box above. The constitution forbids inventing prices.

**Independent Test**: Open a Printing with one snapshot, a Printing with gaps, and a Printing whose history cannot be loaded. Confirm each has a clear, non-zeroing state and that current prices still show.

**Acceptance Scenarios**:

1. **Given** a Printing with fewer than two usable Low points, **When** details open, **Then** the player sees that history is not chartable yet (not a flat $0 line).
2. **Given** a day with no observed Low, **When** that day is in range, **Then** it is treated as unpriced (a gap), never as zero.
3. **Given** history cannot be loaded, **When** details are otherwise fine, **Then** the player sees a brief failure/retry state under the Prices box and can still use today's prices and the rest of the page.
4. **Given** the player is offline or on a slow connection, **When** details open, **Then** the page itself is not blocked waiting on history.

---

### Edge Cases

- History for a Printing that was just added to the catalog (only today's snapshot).
- Long gaps (ingest missed days, or the Printing was unpriced for a stretch).
- Switching Printings quickly before the previous history finishes loading.
- Player's selected marketplace has current prices but no historical Low (for example CardMarket when Low snapshots were never captured).
- A day with Market (or other) filled in but Low missing is still a gap on this chart.
- Very long series: the default 30-day view stays glanceable; Pro full-span is opt-in and may be denser.
- Signed-out players are treated as free: last 30 days only, no full-span control.
- A Printing whose entire recorded history is shorter than 30 days looks the same to free and Pro; the upgrade line and the Pro full-span control are omitted because there is nothing more to show.
- Empty, loading, and error history states do not show the upgrade line or a full-span control.
- A free player who upgrades to Pro from this control stays on the 30-day default and can then switch to the full span without leaving card details.
- Tapping a gap (unpriced day) must not show $0.00; it either snaps to the nearest observed Low or shows no readout.
- Inspecting a point does not navigate away from card details.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Card details MUST show a price history section immediately below the existing Prices box, on the same page, without a separate navigation step.
- **FR-002**: History MUST be for the currently selected Printing (`<product_id>-<subtype>` identity), not aggregated across finishes or sets that share a name.
- **FR-003**: History MUST use observed catalog snapshots only. The product MUST NOT invent, interpolate as if observed, or display unpriced days as zero.
- **FR-004**: The chart MUST plot exactly one line: **Low** for the player's selected marketplace (TCGplayer Low, or CardMarket Low). It MUST NOT plot Market, Mid, High, or a second series. If that Low series has no snapshots, show the empty state rather than silently substituting Market or another marketplace.
- **FR-005**: When two or more usable Low points exist, the section MUST show a trend visualization and a numeric change in Low over the span shown (amount and direction).
- **FR-006**: When fewer than two usable Low points exist, the section MUST explain that history is not available yet. It MUST NOT draw a misleading chart.
- **FR-007**: Loading, empty, and error for history MUST NOT hide, delay, or replace the Prices box or the rest of card details.
- **FR-008**: Changing the selected Printing MUST refresh history for the new Printing.
- **FR-009**: History MUST remain visible without an account. Signed-out and free players get the free window; they MUST NOT be required to sign in to see current prices or recent history.
- **FR-010**: The section MUST credit that values come from the same catalog as today's prices (observed Low, not an appraisal).
- **FR-011**: The history chart MUST default to Low snapshots from the last 30 calendar days for every player, including Pro. Free and signed-out players MUST NOT be able to extend that window. FABTrades Pro players MUST be able to switch the visible window to the full recorded span of observed Lows, and back to 30 days.
- **FR-012**: The numeric change summary MUST be computed over the points actually shown in the current window, not over hidden older points.
- **FR-013**: When a free or signed-out player’s Printing has observed snapshots older than the 30-day window, the history section MUST show a quiet “See full history with Pro” control under the chart. Tapping it MUST open the existing upgrade flow without hiding today’s prices or the 30-day chart. Pro players MUST NOT see this control. The control MUST NOT appear when there is no older history to unlock, or when history is empty, loading, or failed.
- **FR-014**: When a chartable Low series is shown, tapping or holding a point MUST reveal that day’s date and Low. The readout MUST use an observed Low only. A gap MUST NOT display as $0.00. Inspect MUST NOT leave card details or open a separate screen.
- **FR-015**: When a Pro player’s Printing has observed snapshots older than 30 days, the history section MUST offer a control to show the full recorded span. That control MUST NOT appear for free or signed-out players, or when there is no older history.

### Key Entities

- **Printing**: A specific physical version of a card (set + finish), keyed the same way Binder and trade rows are. History is per Printing.
- **Price snapshot**: One observed catalog capture for a Printing on a calendar day. History uses the Low value; other fields on the snapshot are ignored for this chart. Missing Low is unpriced, not zero.
- **Price series**: The sequence of Low snapshots for the selected marketplace, clipped to the current visible window (default last 30 days; Pro may switch to the full recorded span).
- **Prices box**: The existing current-price summary on card details. History is a sibling beneath it, not a replacement.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From card details, a player can see this Printing's price path without leaving the page or scrolling past unrelated sections first — history sits directly under Prices.
- **SC-002**: A player can tell direction and size of change (up, down, or flat) within 5 seconds of the section appearing, without reading a table of every day.
- **SC-003**: 100% of Printings with two or more observed Low points in the allowed window show a chartable history; Printings with fewer Low points show the empty state instead of a fabricated line.
- **SC-004**: Switching Printings updates history to the new selection; no leftover points from the previous Printing remain visible once the new series has loaded.
- **SC-005**: If history fails or is empty, the player can still read today's prices and take Binder / trade actions on that same visit.
- **SC-006**: Unpriced days never appear as $0.00 (or €0.00) on the history.
- **SC-007**: Given a Printing with snapshots both inside and older than 30 days, opening card details shows only the last 30 days for free and Pro alike.
- **SC-008**: In that same situation, a free player can start the upgrade flow from the history section in one tap, without losing sight of the Prices box; a Pro player sees no upgrade prompt there.
- **SC-009**: A player can reveal an observed day’s date and Low from the chart in one tap or hold, without opening another page or a full table of every day.
- **SC-010**: A Pro player with older snapshots can switch from the default 30-day view to the full recorded span (and back) without leaving card details; a free player cannot.

## Assumptions

- **Placement is the mobile card details page** that already has a Prices box. Web has set browse, not a comparable card-details Prices box, so web is out of scope for this feature. A later web card page SHOULD put history in the same spot.
- **Default view is the last 30 calendar days for everyone**, including Pro, so the line stays readable at the table. Free and signed-out stay on that window. Pro may switch to the full recorded span. When older snapshots exist, free players get a quiet “See full history with Pro” control under the chart (not a blocking overlay).
- **No promised depth we do not have.** Snapshots accumulate from the nightly catalog ingest. Pro “full span” (opt-in) means every captured day, which may be less than 30 days for new Printings. No backfill of dates before ingest began.
- **Default series is one Low line** for the selected marketplace (TCGplayer Low in USD, or CardMarket Low in EUR). Market/Mid/High are listed in the Prices box only. CardMarket Low is shown only if those snapshots actually exist.
- **v1 is this Printing's line, not portfolio value.** Binder value-over-time, set indexes, and "compare two cards" are out of scope.
- **No condition-adjusted history.** Condition is descriptive only and does not change price.
- **Signed-out works as free.** History is catalog data; access to the *full* span is the Pro entitlement. Signed-out players get the 30-day window.

## Out of Scope

- A standalone history screen or browse-level charts.
- Web set pages growing a per-card history widget before they have a card details page.
- Binder / Want List value-over-time.
- User-entered prices or sold-listing plots.
- Promising or backfilling history from before FAB Trades started capturing daily snapshots.
- Hiding the history section entirely from free players (they still get the last 30 days).
- A blocking paywall or faded overlay covering the 30-day chart.
- Plotting Market, Mid, High, or more than one history line.
- A scrollable table of every day’s Low as the primary history UI (inspect is point-based).
- Requiring pinch-zoom or pan to read the default history view.
