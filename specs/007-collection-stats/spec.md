# Feature Specification: Binder Collection Stats

**Feature Branch**: `007-collection-stats`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "Actually, cards-in-binder price trend data should live in the binder page, within the binder itself. Replace the floating binder value with a button that says \"Collection Stats\". This button should bring up a new page that houses total value trend, top movers within the binder, etc."

## Clarifications

### Session 2026-08-26

- Q: Should the Binder's total-value trend be reconstructed from catalog price history using the player's current quantities, or built from Binder-value snapshots recorded once per day going forward? → A: **Neither — drop the total-value trend.** It is not valuable enough to build. Collection Stats shows a **current total value** only. No Binder value-over-time series, chart, or sparkline in this feature.
- Q: Now that cards-in-Binder movers live on Collection Stats, should the owned-cards movers section be removed from mobile Home and web Trends? → A: **Yes, remove it.** The movers landing becomes **catalog-wide only**. The existing owned-movers section (all Binders combined) is deleted from Home and Trends; owned movement is per-Binder on Collection Stats.
- Q: Should Binder movers be ranked by percent change (the same sort catalog-wide movers use), or by how much each Printing moved this Binder's total (copies × currency change)? → A: **Percent change, same as catalog-wide.** One shared definition of gainer/loser across surfaces. Rows still show copies and the currency change so impact is visible, but copies MUST NOT affect rank.
- Q: Should the Collection Stats button also display the Binder's current total value, or should the total appear only after opening the page? → A: **Label only.** The button reads **Collection Stats** with no value on it, and the Binder screen no longer shows a running total anywhere. The current total value is on the Collection Stats page.
- Q: Should the existing Binder-value modal (the overlay the green total used to open) be removed from the product entirely once Collection Stats ships? → A: **Yes, remove it entirely** on both web and mobile. Collection Stats becomes the only place a Binder's value is broken down. No second quick-peek surface, and no per-surface divergence.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Collection Stats from the Binder (Priority: P1)

A player is looking at a Binder they have cards in. Where they used to see a floating Binder-value total, they now see a **Collection Stats** button. The button carries that label and nothing else — no dollar figure rides along on it, and the Binder screen no longer shows a running total. Checking what a Binder is worth is now a deliberate step, not a glance. That button is part of the Binder screen (same place as the old total), not a new top-level tab and not a Home/Trends control.

They activate Collection Stats and go to a **new page** for *this* Binder — not an overlay that leaves the Binder list underneath. The page names the Binder they came from and shows that Binder's **current total value** using the same price source they already chose in Settings. The Binder list behind is not edited.

They leave Collection Stats (back/close) and return to the same Binder, same list, same scroll context.

**Why this priority**: This is the entry and destination. Binder movers and the snapshot stats have nowhere to live until the floating total is replaced and the page exists. The old value overlay is no longer the inspect surface.

**Independent Test**: With a non-empty Binder, confirm the floating value total is gone, a Collection Stats button is in its place, activating it opens a distinct page (not a sheet over the list), the current total value matches the Binder they left, and leaving the page restores that Binder unchanged.

**Acceptance Scenarios**:

1. **Given** the player is on a Binder that has at least one card, **When** they look at the Binder screen, **Then** they see a **Collection Stats** button and they do **not** see the floating Binder-value total in that control's place.
2. **Given** the Collection Stats button is on screen, **When** the player reads it, **Then** it shows the label only with no value on it, and no running Binder total appears elsewhere on the Binder screen.
3. **Given** the Collection Stats button is visible, **When** they activate it, **Then** they arrive on a Collection Stats page for that Binder (a new page, not an overlay on the Binder list).
4. **Given** Collection Stats is open, **When** they read the page, **Then** they can tell which Binder it belongs to and they see that Binder's current total value using their chosen price source.
5. **Given** Collection Stats is open, **When** they leave it (back/close or the platform's back gesture), **Then** they are on the same Binder with the same list and scroll context, and no Binder quantities changed as a side effect.
6. **Given** a signed-out player with Binder cards already on the device, **When** they open Collection Stats, **Then** they can read it without signing in.
7. **Given** the Binder is empty, **When** they look at the Binder screen, **Then** there is no Collection Stats button (the destination is not a dead empty screen).
8. **Given** the player is on Want List, **When** they look at that screen, **Then** there is no Collection Stats button (Want List is not a Binder).
9. **Given** the player uses web or mobile, **When** they open Collection Stats from a Binder, **Then** the button label, the fact that it is a new page, and the current total value meaning are the same; layout may be native to each surface.
10. **Given** the player has more than one Binder, **When** they open Binder A and activate Collection Stats, **Then** the page is about Binder A only — not a combined total of every Binder.
11. **Given** Collection Stats is open, **When** the player reads the page, **Then** there is no Binder value-over-time chart or sparkline; the value shown is the current total.

---

### User Story 2 - See top movers within this Binder (Priority: P2)

On the same page the player can see **top movers within this Binder**: biggest recent gainers and biggest recent losers among Printings they actually have in *this* Binder (quantity greater than zero). This is not the catalog-wide market pulse, and it is not a combined list of every Binder they own.

Ranking meaning matches catalog-wide recent movers: percent change in observed Low from a start Low 3–5 days ago to the latest Low, with the currency amount shown alongside, and the same general price floor so cheap cards that double in percent do not crowd the list. Gainers and losers are visually distinct.

Each row names the Printing (card name, set, finish), shows how many copies they hold in this Binder, current Low, percent change, and currency change. Copies are shown for context; they do not change a Printing's place in the ranking. Selecting a row opens that Printing's existing card details.

Want List cards do not appear. A Printing in this Binder and another Binder still appears here only because it is in *this* Binder; Collection Stats does not merge other Binders' stock.

**Why this priority**: Cards-in-Binder movement data belongs on the Binder, not on Home/Trends. This is the reason the page exists beyond a total, and it is the slice that answers "what I hold here moved."

**Independent Test**: Put qualifying Printings in Binder A only. Open Collection Stats from Binder A and confirm those Printings can appear as movers. Open Collection Stats from an empty-of-those-cards Binder B and confirm they do not. Confirm catalog-wide movers still live on Home/Trends, not on this page.

**Acceptance Scenarios**:

1. **Given** the player has Printings in this Binder that qualify as recent movers, **When** they open Collection Stats, **Then** they see gainers and losers drawn only from those Printings, ranked by percent Low change with currency amount shown.
2. **Given** a Printing that is a top catalog-wide gainer but is **not** in this Binder, **When** they read Collection Stats movers, **Then** that Printing is not on the lists.
3. **Given** a Printing in Binder A and not in Binder B, **When** they open Collection Stats from B, **Then** that Printing is not a mover on B's page.
4. **Given** a ranked mover row, **When** the player reads it, **Then** they see Printing identity (name, set, finish), copies in this Binder, current Low, percent change, and currency change, and they can tell up from down at a glance.
5. **Given** a mover row, **When** they select it, **Then** they reach that Printing's existing card details (same set and finish) and can return to Collection Stats.
6. **Given** this Binder has cards but none qualify as movers (window or price floor), **When** they open Collection Stats, **Then** the movers section explains there are no movers; it MUST NOT show a fake $0.00 row, and the rest of the page (current total value, snapshot stats) remains usable.
7. **Given** the player is on Home (mobile) or Trends (web) with cards in their Binders, **When** they read that landing, **Then** it shows catalog-wide movers only — no owned-cards movers section, no owned empty state, and no owned teaser — and cards-in-Binder movement is found by opening a Binder and its Collection Stats.

---

### User Story 3 - See snapshot stats that explain the current total (Priority: P3)

Collection Stats also answers "what is this pile worth *right now*, besides the headline number?" — the useful snapshot that used to live behind the floating total:

- Quantity-weighted **TCGplayer Market** and **TCGplayer Low** (US dollars)
- Quantity-weighted **CardMarket Trend** and **CardMarket Low** (euros)
- **Copies** and **distinct Printings**
- **Foil vs Regular** copy counts
- **Unpriced copies** per marketplace
- **Top Printings by current value** — the handful that make up most of this Binder, using the same price source as the current total value

Missing catalog prices stay **unpriced**, never zero. Condition grades never change a price.

**Why this priority**: Replacing the floating total would otherwise strand marketplace comparison and concentration stats. They ship on this page so the old overlay is not missed.

**Independent Test**: Open Collection Stats on a Binder with mixed priced, unpriced, foil, and Regular copies. Confirm the four marketplace totals, counts, unpriced gaps, and top-by-value list reconcile against the Binder list.

**Acceptance Scenarios**:

1. **Given** Binder Printings with TCGplayer Market and Low, **When** Collection Stats is open, **Then** the player sees quantity-weighted TCGplayer Market and Low totals in US dollars for this Binder only.
2. **Given** Binder Printings with CardMarket Trend and Low, **When** Collection Stats is open, **Then** the player sees quantity-weighted CardMarket Trend and Low totals in euros. Foil Printings use CardMarket foil figures when those exist.
3. **Given** copies with no price for a marketplace field, **When** the player reads that total, **Then** those copies are omitted from the money figure, counted as unpriced, and never shown as $0 / €0.
4. **Given** Settings use one marketplace, **When** they open Collection Stats, **Then** they still see **both** TCGplayer and CardMarket snapshot totals (the page is the comparison; Settings still drive the current total value).
5. **Given** multiple quantities and finishes, **When** they read counts, **Then** total copies, distinct Printings, foil copies, and Regular copies match this Binder's list and foil + Regular equal total copies.
6. **Given** at least one priced Printing, **When** they read top-by-value, **Then** they see up to five Printings ranked by contribution to the current total value (quantity × chosen source), each with name, finish, quantity, and contribution. Fewer than five priced Printings means the list is just those Printings — no padding.

---

### Edge Cases

- Empty Binder: no Collection Stats button; the player is not pushed into an empty stats page.
- Want List: no Collection Stats entry (Want List is not a Binder).
- Switching Binders: Collection Stats always reflects the Binder that was open when the player activated the button, not a previously viewed Binder's leftover numbers.
- All copies unpriced for a marketplace: that marketplace's snapshot totals show as unpriced with a copy count, never $0.00 / €0.00. The current total value follows the same honesty rule for the chosen source.
- A Printing with no Low in the 3–5 day start window, or no current Low, is ineligible as a Binder mover (same rule as catalog-wide movers). It may still appear on top-by-value if it has a current chosen-source price.
- Cheap Printings under the general price floor (start Low below $1.00 / €1.00) do not appear on Binder movers even if percent change is large.
- A Printing whose Low is unchanged is neither a gainer nor a loser on Binder movers.
- Outlier catalog Lows (start or latest above $10,000 / €10,000, or percent change above 1000% in the 3–5 day window) are ineligible as movers.
- Very large Binders: Collection Stats still opens from one activation and remains usable (the player can scroll the page). It does not freeze Binder work after they return.
- Condition (NM/LP/MP/HP/DMG): descriptive only; totals and movers MUST NOT be adjusted by condition.
- Currency: TCGplayer figures stay in US dollars and CardMarket figures stay in euros; the product does not silently convert one into the other.
- Signed-out is treated as free: Collection Stats uses Binder data already on the device; no account wall.
- Public shared Binder view is unchanged in this pass (owner's Binder only).
- Onboarding that previously highlighted the floating Binder total now points at Collection Stats; after the tour, that control still opens this page. The tour MUST NOT point at a control or overlay that no longer exists.
- The old Binder-value modal is gone, not orphaned: no leftover entry point (long-press, header action, deep link, or web route) reopens it, and no surface shows a Binder value breakdown other than Collection Stats.
- Catalog-wide recent movers stay on mobile Home and web Trends. This page MUST NOT become a second catalog-wide movers landing.
- The owned-cards movers section on Home/Trends is removed, not hidden or disabled. A player with empty Binders and a player with a full Binder both see the same catalog-wide-only landing. Removing it MUST NOT disturb catalog-wide movers or catalog search on that landing.
- Binder value-over-time is not part of this feature. A player looking for a value history chart does not find a half-built or disabled one on Collection Stats. Per-Printing price history on card details is unchanged.
- The Binder tab and Binder destination keep the product noun **Binder**. **Collection Stats** is the label of this stats control/page only. The keep pile may still be named Collection; that name is not a new product type and does not rename the Binder tab.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On a non-empty Binder, the floating Binder-value total control MUST be replaced by a button labeled **Collection Stats**. The button MUST show that label only — it MUST NOT display the Binder's value, and the Binder screen MUST NOT show a running Binder total anywhere else. The Binder tab/destination MUST remain labeled Binder. Want List MUST NOT show this button.
- **FR-002**: Activating Collection Stats MUST open a **new page** for the currently open Binder. It MUST NOT open an overlay/sheet on top of the Binder list as the primary destination. Leave/back MUST restore the same Binder, list, and scroll context with no Binder edits as a side effect.
- **FR-003**: The existing Binder-value detail modal MUST be removed from both web and mobile, along with every remaining way to reach it. Collection Stats MUST be the only surface that breaks down a Binder's value. The product MUST NOT keep a second quick-peek value overlay, and MUST NOT keep the modal on one surface while the other gets the page.
- **FR-004**: The Collection Stats page MUST identify the Binder it belongs to and MUST show that Binder's **current total value** using the player's chosen price source (quantity-weighted observed catalog prices; unpriced omitted, never zero).
- **FR-005**: Collection Stats MUST be scoped to **one Binder** — the Binder that was open when the player activated the button. It MUST NOT combine Trade Binder, the keep pile named Collection, and other Binders into one total or one movers list.
- **FR-006**: Collection Stats MUST NOT show a Binder value-over-time series, chart, sparkline, or period-change figure for the Binder total. Value over time for the whole Binder is out of this feature; per-Printing price history stays on card details.
- **FR-007**: The page MUST show **top movers within this Binder**: gainers and losers among Printings with quantity greater than zero in this Binder only. Ranking MUST be percent change in observed Low from the most recent observed Low whose capture day is 3–5 calendar days ago to the latest observed Low, for the player's selected marketplace. Each row MUST still show the currency amount of that change. The product MUST NOT rank on Market, Mid, High, a blended price, or currency amount as the primary sort, and MUST NOT weight rank by copies held or by a Printing's impact on this Binder's total.
- **FR-008**: Binder mover rows MUST show Printing identity (name, set, finish), copies in this Binder, current Low, percent change, and currency change. Gainers and losers MUST be visually distinct. Copies are context only and MUST NOT affect ranking.
- **FR-009**: A general price floor MUST exclude cheap Printings from Binder movers: start Low below USD $1.00 (TCGplayer) or EUR €1.00 (CardMarket) MUST NOT appear, regardless of percent change. Printings with no start Low in the 3–5 day window, no latest Low, 0% change, start or latest Low above 10000, or absolute percent change greater than 1000% MUST be omitted. The product MUST NOT interpolate or backfill Lows.
- **FR-010**: Each Binder movers list MUST show a short ranked set: up to 10 Printings when at least 10 qualify, otherwise every qualifying Printing. The view MUST NOT pad with ineligible or invented rows.
- **FR-011**: Selecting a Binder mover row MUST open that Printing's existing card details. It MUST NOT open a different Printing that shares the card name.
- **FR-012**: Want List entries MUST NOT appear on Collection Stats movers or totals. Want List is not a Binder.
- **FR-013**: The movers landing (mobile Home; web Trends) MUST become **catalog-wide only**. The existing owned-cards movers section on that landing MUST be removed, including its empty and hidden states. Catalog-wide recent movers MUST remain there unchanged. Collection Stats MUST NOT show catalog-wide movers. Owned movement MUST be reachable only per-Binder from Collection Stats, and the landing MUST NOT keep a partial owned list, teaser, or link-out list of owned movers.
- **FR-014**: The page MUST show quantity-weighted **TCGplayer Market** and **TCGplayer Low** totals in US dollars, and quantity-weighted **CardMarket Trend** and **CardMarket Low** totals in euros (foil Printings MUST use CardMarket foil figures when those exist). These snapshot totals MUST appear regardless of which price source Settings currently uses.
- **FR-015**: The page MUST show total copies, distinct Printing count, foil copy count, Regular copy count, and unpriced copy counts per marketplace for this Binder. Foil + Regular MUST equal total copies.
- **FR-016**: The page MUST list up to five Printings with the largest contribution to the current total value, each with name, finish, quantity, and contribution. It MUST NOT invent Printings or pad the list.
- **FR-017**: Totals and movers MUST use observed catalog prices only. Unpriced MUST display as unpriced, never as zero. A copy missing a given field MUST be omitted from that field's money figure and counted in that field's unpriced copy count.
- **FR-018**: Inspecting Collection Stats MUST work without an account when the Binder is already available on the device.
- **FR-019**: Lent copies that remain in the Binder MUST be included in the current total value, snapshot totals, counts, top-by-value, and movers eligibility the same way they are included in Binder value today.
- **FR-020**: Collection Stats MUST be available from the Binder on both peer surfaces (mobile and web). Layout may be native to each surface; numbers, vocabulary, and the Collection Stats label MUST match.
- **FR-021**: Loading, empty movers, and error MUST be obvious. They MUST NOT hide the rest of the page when other sections can still be shown, MUST NOT fabricate prices or movers to fill space, and MUST NOT block returning to the Binder or starting a trade.
- **FR-022**: Changing the selected marketplace MUST refresh Binder movers (and any Low-based figures) to that marketplace's Low series. Changing the chosen price source MUST refresh the current total value and top-by-value.
- **FR-023**: Marketplace groups MUST be labeled in the trader's language (TCGplayer, CardMarket, Market, Low, Trend). The player MUST be able to tell which number is which without guessing. The page MUST credit that values come from the same observed catalog as today's prices (not an appraisal, not a sale the product brokered).
- **FR-024**: An empty Binder MUST NOT show the Collection Stats button. A Binder with cards but no qualifying movers MUST still offer Collection Stats (current total value and snapshot remain).

### Key Entities

- **Binder**: The player's stock pile this page is about (Trade Binder, the keep pile that may be named Collection, or any other Binder). Collection Stats is always one Binder, never Want List, never all Binders combined.
- **Collection Stats**: Player-facing name of the button and the page opened from it. Stats for the currently open Binder. Does not rename the Binder tab or destination to Collection.
- **Printing**: A specific physical version of a card (set + finish). Totals and movers are always per Printing × quantity in this Binder.
- **Current total value**: This Binder's quantity-weighted total right now, using the player's chosen price source. Replaces the number that used to float on the Binder screen. A point-in-time figure, not a series.
- **Binder mover**: An eligible Printing in this Binder whose recent Low change (3–5 day start vs latest Low) qualifies as a gainer or loser under the same ranking and floor rules as catalog-wide recent movers. Copies held are shown on the row but never affect rank.
- **Marketplace snapshot totals**: Quantity-weighted sums of a single catalog field across this Binder: TCGplayer Market, TCGplayer Low, CardMarket Trend, CardMarket Low.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a non-empty Binder, a player can open Collection Stats in one activation of the Collection Stats button and see that Binder's current total value within 5 seconds, without the floating Binder-value total still occupying that control.
- **SC-002**: After leaving Collection Stats, they can continue Binder work immediately — same Binder, same list, same quantities (no restart).
- **SC-003**: 90% of first-time testers, asked "where do I see which of my cards in this Binder went up or down?", go to Collection Stats from the Binder rather than to Home/Trends or an individual card.
- **SC-004**: 100% of Binder mover rows are Printings currently in that Binder with quantity greater than zero; 0% are Want List-only, unowned catalog cards, or Printings that exist only in a different Binder.
- **SC-005**: 100% of priced copies are reflected in the matching marketplace snapshot total (quantity × catalog field). Unpriced copies never appear as $0.00 or €0.00 on snapshot totals or the current total value.
- **SC-006**: A signed-out player with an on-device Binder can complete inspect of Collection Stats without creating an account.
- **SC-007**: Copy count, distinct Printing count, and foil vs Regular counts match this Binder's list for the same snapshot.
- **SC-008**: The current total value on Collection Stats matches the worth of that Binder under the chosen price source every time they open it on an unchanged Binder.
- **SC-009**: At least 90% of first-time testers who are asked "what is this Binder worth on TCG Low vs CardMarket Low?" can answer from Collection Stats without opening individual cards.
- **SC-010**: Selecting a Binder mover row reaches that Printing's card details in one action; 100% of those openings match the Printing on the row (same set and finish).
- **SC-011**: A first-time tester looking at mobile tabs still identifies Binder as Binder (not Collection) and does not look for a new Collection Stats top-level tab.
- **SC-012**: Printings under the general price floor (start Low below $1.00 / €1.00) do not appear on Binder movers, even if their percent change would otherwise rank in the top 10.
- **SC-013**: If movers cannot be shown, the player can still read the current total value and snapshot stats when those are available, return to the Binder, and start a trade on that same visit.
- **SC-014**: After this change, the movers landing (mobile Home; web Trends) shows zero owned-cards movers sections in every Binder state (empty, partially qualifying, fully qualifying), while catalog-wide movers and catalog search on that landing still work.
- **SC-015**: Collection Stats is the only surface in the product that breaks down a Binder's value; the previous Binder-value modal cannot be reached from any control, gesture, or route on either surface.

## Assumptions

- **Entry point replaces the floating Binder value.** The green/floating total is gone from that slot; **Collection Stats** is the label. Clarified 2026-08-26: the button carries the label only — no value on the button and no running total elsewhere on the Binder screen, so seeing what a Binder is worth is a deliberate tap. Onboarding copy that pointed at the green total is rewritten to point at Collection Stats. The Add-card control on the Binder screen stays. Empty Binders still have no stats entry.
- **Destination is a new page, and the old overlay is gone.** Clarified 2026-08-26: the Binder-value detail modal is **removed** from web and mobile rather than kept as a second surface. This supersedes the earlier decision that made that modal the Binder-value inspect surface. Its content — marketplace totals, counts, unpriced gaps, top by value — moves onto Collection Stats so nothing is lost, and those numbers have exactly one home.
- **No Binder value-over-time in this feature.** Clarified 2026-08-26: the original request named a total value trend; it is not worth building. Collection Stats shows a current total value. Neither reconstructing history from catalog prices nor recording daily Binder snapshots is in scope, so no new value-history storage or sync is needed.
- **One Binder, not all Binders.** "Within the binder itself" means the currently open Binder. Players who want another Binder's movers open that Binder first.
- **Catalog-wide movers stay on Home/Trends; owned movers do not.** Clarified 2026-08-26: this feature **removes** the owned-cards movers section from the movers landing and replaces it with per-Binder movers on Collection Stats. This supersedes the earlier decision that put an all-Binders owned view on that landing. Catalog-wide recent movers and catalog search there are unchanged.
- **Movers rules match catalog-wide recent movers.** Percent ranking, 3–5 day start Low, Low-only series, $1 / €1 floor, 10-row cap, outlier caps. No second definition of "gainer" on this page. Clarified 2026-08-26: rank is percent only — copies held and impact on the Binder total are shown but never weighted into the sort. The existing shared movers fixtures stay the source of truth for what qualifies and in what order.
- **Current total value uses the chosen price source.** Snapshot still shows both marketplaces. No new Settings picker on this page.
- **Quantity-weighted, condition-blind.** Quantity multiplies each Printing's catalog number. Condition never changes a price.
- **Unpriced is omitted, not zeroed.**
- **Both surfaces, owner's Binder only.** Mobile and web. Public shared Binder is unchanged.
- **No account gate.** Same "no gate before value" rule as Binder inspect.
- **Lent copies stay in the totals**, matching existing Binder-value rules.
- **Collection Stats is a control/page label.** The product noun remains Binder. Collection remains allowed as the default keep-pile Binder *name*.
- **v1 has no alerts.** Price-spike notifications stay out of this pass.
- **Top five by current value is enough** for concentration. A full rewrite of the Binder list sorted by value is out of scope.

## Out of Scope

- **A Binder total value trend**, value-over-time chart, sparkline, or period-change figure on Collection Stats. Dropped in clarification; the page shows a current total value.
- Stored daily Binder-value snapshots, or reconstructing past Binder totals from catalog price history.
- Keeping the floating Binder-value total as the primary Binder control, showing the value on the Collection Stats button, or keeping a running Binder total elsewhere on the Binder screen.
- Opening Collection Stats as an overlay/sheet on the Binder list.
- A new top-level tab or hamburger destination named Collection (or Collection Stats) that bypasses the Binder.
- Renaming the Binder tab or Binder destination to Collection.
- Combining all Binders into one Collection Stats total or movers list.
- Want List stats or a Want List version of this page.
- Public shared Binder Collection Stats.
- Catalog-wide recent movers on Collection Stats.
- Binder-owned movers remaining on mobile Home or web Trends.
- Customizable price-spike alerts, push/email, or "time to sell" recommendations.
- Ranking Binder movers by absolute dollar change, by copies held, or by impact on the Binder total as the primary sort.
- Keeping the Binder-value detail modal alive on either surface, or as a secondary quick-peek next to Collection Stats.
- Other mover time windows (24 hours, 7 days, 30 days, custom ranges) beyond the 3–5 day start used by recent movers.
- User-entered prices, sold listings, or condition-adjusted values.
- Plotting Market, Mid, or High on Binder mover lists (snapshot Market/Trend totals are allowed; movers stay Low).
- A marketplace, listing, or checkout flow.
- Requiring an account to see Collection Stats.
- Hiding Collection Stats behind Pro in this pass.
- Replacing or relocating the per-Printing price history section on card details.
- Export, share-image, or Discord paste of Collection Stats.
- Additional catalog-field snapshot totals (TCGplayer Mid/High/Direct low, CardMarket Avg) as first-ship rows.
