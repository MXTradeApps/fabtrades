# Feature Specification: Recent Card Gainers and Losers

**Feature Branch**: `005-card-gainers-losers`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "users should be able to see trends of cards aka biggest losers and biggest gainers over the last week. First pass of this feature should just be biggest gainers and losers of all cards with plans to be able to see trends of cards within their collection and even customizable alerts when cards you own spike in price so users know when the best time to sell their cards are"

## Clarifications

### Session 2026-08-25

- Q: Should this week’s biggest gainers and losers be ranked by percent change or by dollar (or euro) change? → A: Rank by percent change; show both percent and currency amount. Apply a general price floor so cheap cards (for example a 30¢ card spiking 100% to 60¢) never appear even with huge percent swings.
- Q: Where should a player open this week’s gainers and losers from? → A: A dedicated movers screen opened from Home (not a new top-level tab). The first tab, formerly labeled Browse, is rebranded to **Home**. Set browsing remains available from Home.
- Q: When a player opens the Home tab (the one just renamed from Browse), should they land on this week’s movers or still land on the set catalog? → A: Home lands on recent movers; the set catalog is one step from Home. Catalog search stays immediately available on Home (search all cards without opening a set first).
- Q: If a card has no observed Low on the exact day 7 days ago, but it does have an older Low (for example 8 days ago), should it still appear on this week’s movers? → A: Use the most recent observed Low in the allowed start window; do not require an exact calendar day. Never invent or fill a gap. (Start-window bounds superseded by the next answer.)
- Q: How old can that start Low be and still count as this week’s move? → A: Call the feature **recent movers** (not weekly). The start Low MUST be an observed Low from **3–5 days ago**. Newer than 3 days or older than 5 days is ineligible as a start.
- Q: Should Home’s recent movers show only cards the player owns, or keep the catalog-wide lists and add an owned-cards view as well? → A: **Both.** Catalog-wide recent movers stay. Home also has a separate owned-cards movers view. Not a single list with a switcher.
- Q: Which owned cards should appear on the owned movers lists? → A: **All Binders.** Any Printing with quantity greater than zero in any Binder (Trade Binder, the keep pile named Collection, and any other Binders). Want List does not count.
- Q: How should catalog-wide movers and owned movers sit on Home? → A: Same Home scroll: **owned first, catalog-wide below.** If Binders are empty (no owned Printings), hide the owned view and show **only catalog-wide** trends.
- Q: If the player owns cards, but none of those cards qualify as recent movers (price floor or no 3–5 day Low), should Home still show the owned section above catalog? → A: **Yes.** Owned empty state first, catalog-wide below. Hide the owned section only when Binders have zero cards.

### Session 2026-08-26

- Q: Should the website keep a single Home page that combines recent movers and set browsing? → A: No. Split that into **Trends** and **Browse Sets** as separate hamburger-menu destinations. The website MUST NOT have a Home page or a Home nav item. `/` stays the Trade Calculator.
- Q: On the website, after Trends and Browse Sets are separate hamburger destinations, where should a player search for a card by name without opening a set first? → A: **Both.** Catalog-wide card search on Trends and on Browse Sets.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See recent biggest gainers and losers (Priority: P1)

A player wants a market pulse before they trade or decide what to move. They open the **movers landing** and see **recent movers**. If they own cards, **owned movers come first**, then catalog-wide **biggest gainers** and **biggest losers** below. If they own nothing, the landing shows **only catalog-wide** lists. Both use the recent window (start Low from 3–5 days ago vs current Low). Owned-card movers is a separate view, not a filter on the catalog lists.

Surfaces differ (native to each, not a copy of the other):

- **Mobile:** The first tab is **Home** (no longer labeled Browse). Home *is* the movers landing — still not a fifth tab next to Trade, Binder, or Lend. The set catalog is one step on the same scroll, below movers. **Catalog search stays on Home**: they can type a card name immediately and find Printings across every set without opening a set first.
- **Web:** There is **no Home page** and no Home item in the hamburger. **Trends** is the movers landing (recent movers only). **Browse Sets** stays a separate hamburger destination for the set catalog. The Trade Calculator at `/` is unchanged. **Catalog-wide card search is on both Trends and Browse Sets**: they can type a card name on either destination and find Printings across every set without opening a set first.

Search does not wait on movers. When they clear search on Trends, the recent movers lists are back. When they clear search on Browse Sets, the set list is back.

Each row names the Printing (card name, set, finish), shows current Low, and shows how much Low changed recently — ranked by percent change, with the dollar (or euro) amount shown alongside. A **general price floor** keeps cheap Printings off the lists: a 30¢ card doubling to 60¢ is not a mover players care about. Gainers and losers are visually distinct (up vs down) so the player can tell direction at a glance.

The catalog-wide lists cover the **whole catalog**, not only cards the player owns. Signed-out players can use catalog-wide movers the same way signed-in players can.

**Why this priority**: Catalog-wide recent movers is the market pulse. It answers "what spiked or dumped lately" without requiring a Binder or an account. Owned-card movers is a separate story.

**Independent Test**: Open the movers landing (mobile Home tab; web Trends from the hamburger). Confirm the recent movers lists are what they land on, that catalog search is available without opening a set on the movers landing **and** on web Browse Sets, that web Browse Sets is a separate destination (not mixed onto Trends), and that each row's change uses the latest Low versus the most recent observed Low in the 3–5 day start window.

**Acceptance Scenarios**:

1. **Given** the player is in the app and has at least one Binder Printing, **When** they open the movers landing (mobile Home; web Trends), **Then** they land on recent movers with the owned view first and catalog-wide lists below, without first opening a specific card or a set.
2. **Given** the player has no Binder Printings, **When** they open the movers landing, **Then** they see only catalog-wide recent movers (no empty owned section).
3. **Given** the mobile main tab bar, **When** the player reads the first tab, **Then** it is labeled Home, not Browse, and movers is not a fifth top-level tab.
4. **Given** the web hamburger menu, **When** the player reads the destinations, **Then** they see **Trends** and **Browse Sets** as separate items, they do not see Home, and `/` is still the Trade Calculator.
5. **Given** the movers landing is open with an empty search, **When** the player types a card name, **Then** they see matching Printings from the whole catalog without opening a set first; clearing search returns them to the recent movers lists.
6. **Given** catalog search results on the movers landing, **When** the player selects a Printing, **Then** they reach that Printing's existing card details.
7. **Given** web Browse Sets is open with an empty search, **When** the player types a card name, **Then** they see matching Printings from the whole catalog without opening a set first; clearing search returns them to the set list (not to Trends).
8. **Given** catalog search results on web Browse Sets, **When** the player selects a Printing, **Then** they reach that Printing's existing card details.
9. **Given** enough catalog Printings qualify, **When** the view loads, **Then** gainers are ranked by largest percent increase in Low from the 3–5 day start to now, and losers are ranked by largest percent decrease.
10. **Given** a Printing with no Low exactly 3 days ago but with an observed Low 4 or 5 days ago and a current Low, **When** lists are ranked, **Then** that Printing is eligible and its start price is the most recent Low in the 3–5 day window, not an invented in-between value.
11. **Given** a ranked Printing, **When** the player reads its row, **Then** they see enough identity to tell which Printing it is (name, set, finish), the current Low, the percent change, and the currency amount of that change.
12. **Given** a gainer and a loser on the same view, **When** the player glances at the lists, **Then** they can tell which list is up and which is down without reading every number.
13. **Given** the player's selected marketplace (TCGplayer or CardMarket), **When** movers are shown, **Then** ranking and displayed Lows use that marketplace's Low only, never Market/Mid/High, and never a mix of marketplaces on one list.
14. **Given** a signed-out player, **When** they open the movers landing or web Browse Sets, **Then** they see the same catalog-wide card search as a signed-in free player; they are not asked to sign in. Catalog-wide movers on Trends work the same way. Owned movers follow Binder data on the device (hidden if Binders are empty).
15. **Given** a Printing whose start Low is below the general price floor, **When** lists are ranked, **Then** that Printing does not appear on gainers or losers even if its percent change is large (including a 30¢ card that doubled).
16. **Given** the player uses web or mobile, **When** they open recent movers, **Then** gainer vs loser meaning, the 3–5 day start window, the Low series, and the ranking order follow the same rules on both surfaces. Chrome may differ (mobile Home vs web Trends).
17. **Given** the movers view is visible, **When** the player reads it, **Then** they can tell the numbers are observed catalog Lows, not a sale the product offered to broker.
18. **Given** the movers landing is open and the player owns at least one Printing, **When** they look at recent movers, **Then** owned gainers/losers appear first, catalog-wide below, as separate views (not one list with a hidden filter), and they can tell which is which.
19. **Given** the player is on web Trends, **When** they want the set catalog, **Then** they open **Browse Sets** from the hamburger — Trends does not include the set list.

---

### User Story 2 - See recent movers among owned cards (Priority: P2)

A player who already owns cards wants to know which of *their* Printings moved, not only what moved in the whole game. On the movers landing (mobile Home; web Trends), beside (not instead of) the catalog-wide lists, they open a separate owned-cards recent movers view: biggest gainers and biggest losers among Printings they have in **any Binder** (Trade Binder, the keep pile named Collection, and any other Binders). Ranking, Low series, 3–5 day start, percent sort, currency amount, and the $1 / €1 floor are the same rules as catalog-wide. The same Printing in two Binders is still one owned row.

Want List cards do not count as owned. If Binders are empty, the owned view is **hidden** and the landing shows only catalog-wide trends. If the player owns cards but none qualify for the lists, the owned view still sits first with an honest empty state; catalog-wide lists remain below. Signed-out players still see catalog-wide movers; owned movers use whatever Binder data is already on the device.

**Why this priority**: This is the sell-timing slice. Catalog-wide answers the market; owned answers "did anything I hold spike or dump." Independently testable with Binder entries present or absent.

**Independent Test**: Add qualifying Printings to a Binder. Open the movers landing (mobile Home; web Trends). Confirm the owned movers lists only include those owned Printings, ranked the same way as catalog-wide, and that catalog-wide lists still show market-wide movers (including cards the player does not own).

**Acceptance Scenarios**:

1. **Given** the player has Printings in any Binder that qualify for the recent window, **When** they open the owned-cards movers view on the movers landing, **Then** they see gainers and losers drawn only from those owned Printings, using the same percent ranking, 3–5 day start Low, and price floor as catalog-wide.
2. **Given** a Printing the player does not own that is a top catalog-wide gainer, **When** they read owned movers, **Then** that Printing is not on the owned lists.
3. **Given** a Printing the player owns that qualifies, **When** they read both views, **Then** it may appear on catalog-wide (if it ranks there) and on owned; the two views stay distinct.
4. **Given** the same Printing in Trade Binder and in another Binder, **When** owned movers ranks it, **Then** it appears once, not once per Binder.
5. **Given** the player owns Printings but none qualify (window or floor), **When** they open the movers landing, **Then** the owned view still appears first and explains there are no owned movers; catalog-wide lists remain below and are not replaced.
6. **Given** Binders are empty (no owned Printings), **When** they open the movers landing, **Then** the owned view is not shown at all; only catalog-wide movers appear.
7. **Given** a signed-out player with Binder data on device, **When** they open the movers landing, **Then** catalog-wide movers work and owned movers appear first, reflecting those on-device Binder Printings; they are not required to sign in.
8. **Given** a signed-out player with no Binder Printings, **When** they open the movers landing, **Then** catalog-wide movers still work and the owned view is hidden.

---

### User Story 3 - Open a mover to inspect the Printing (Priority: P3)

The lists are a scan. When a Printing on a catalog-wide or owned list looks interesting, the player opens it and lands on that Printing's existing card details — including today's prices and that Printing's price history — so they can judge whether the recent move was a spike, a dump, or the usual path.

**Why this priority**: Rankings without a way to inspect the card are a teaser. Card details already answer "is this a spike or the usual." Connecting the two is the second slice.

**Independent Test**: From a movers row, open the Printing. Confirm card details opens for that same Printing (not a different finish or set) and that today's prices remain usable.

**Acceptance Scenarios**:

1. **Given** a Printing on a gainers or losers list (catalog-wide or owned), **When** the player selects that row, **Then** they reach that Printing's existing card details (not a different Printing that shares the name).
2. **Given** card details opened from movers, **When** the player is done inspecting, **Then** they can return to the recent movers lists (mobile Home or web Trends) without losing their place in the app.
3. **Given** card details opened from movers, **When** details load, **Then** today's prices remain visible; the player is not stuck on a ranking-only screen.

---

### User Story 4 - Honest empty, ineligible, and failure states (Priority: P4)

Movers only exist when the catalog actually captured a start Low in the 3–5 day window and a later Low. New Printings, unpriced cards, a failed load, and a period with too few qualifying Printings must not look like a crash or like $0 movers.

**Why this priority**: Fabricated zeros and silent failures would undermine trust in the same catalog the trade balancer uses. The product does not invent prices.

**Independent Test**: Open movers when the catalog has fewer than a full list of qualifying Printings, when a marketplace has no Lows in the 3–5 day start window, and when the lists cannot be loaded. Confirm each state is clear, non-zeroing, and does not block the rest of the app.

**Acceptance Scenarios**:

1. **Given** fewer Printings qualify than the usual list length, **When** the view loads, **Then** the player sees only the Printings that qualify (a shorter list), not padded rows or invented movers.
2. **Given** no Printings qualify as gainers (or as losers), **When** the view loads, **Then** that list explains that there are no movers to show; it MUST NOT show a fake $0.00 row.
3. **Given** movers cannot be loaded, **When** the player opens the movers landing, **Then** they see a brief failure/retry state for the lists and can still search cards (on the movers landing and, on web, on Browse Sets), open Binder, start a trade, and (on web) open Browse Sets.
4. **Given** the player is offline or on a slow connection, **When** they open movers, **Then** the rest of the app is not blocked waiting on this view.

---

### Edge Cases

- A Printing whose start or latest Low is above $10,000 / €10,000, or whose percent change exceeds 1000% in the 3–5 day window, is ineligible (garbage catalog Lows, not a real move).
- A Printing with only today's Low (too new to have any Low from 3–5 days ago) is ineligible and does not appear.
- A Printing whose Low on an exact day in the 3–5 day window is missing MAY still qualify if another observed Low falls in that window; the start price is the most recent observed Low in the 3–5 day band. The product does not invent a Low for a missing day.
- A Printing with no observed Low from 3–5 days ago is ineligible. A Low from 1–2 days ago MUST NOT be used as the start. A Low older than 5 days MUST NOT be used as the start.
- A Printing that is unpriced today but had a start Low is ineligible (no honest current Low to compare).
- A day with Market (or other) filled in but Low missing is still unpriced for movers.
- Cheap Printings under the general price floor (start Low below $1.00 / €1.00) are excluded so a 30¢ card doubling to 60¢ — or a 5¢ card doing the same — does not crowd out real trade-relevant movers.
- A Printing whose Low is unchanged from start to now is neither a gainer nor a loser; it does not appear on either list.
- Ties in percent change: equal percents keep a stable, repeatable order so refreshing the view does not shuffle the same set.
- Switching marketplace (TCGplayer ↔ CardMarket) rebuilds both lists for that marketplace's Low; leftover rows from the previous marketplace must not remain.
- Very large catalogs: the player still sees a short ranked list (not every card in the game), glanceable in one sitting.
- Switching Printings on card details after arriving from movers follows existing card-details rules; the movers lists themselves stay catalog-wide.
- Signed-out is treated as free: catalog-wide movers are visible; no account wall.
- Future Binder-owned filter and price-spike alerts do not appear as half-built controls: owned movers is a complete separate view, not a disabled toggle. Alerts stay out of this pass.
- If Binders are empty, the movers landing shows only catalog-wide movers; the owned section is omitted, not shown as a blank card.
- If the player owns cards but none qualify, owned still appears first with an empty explanation; catalog-wide stays below.
- A Printing owned in two Binders still ranks once on owned movers.
- **Mobile:** Movers is not a fifth top-level tab. Home replaces the Browse tab label; Trade, Binder, and Lend stay where they are. Set browsing remains one step from Home (same scroll below movers) so renaming the tab does not strand the catalog.
- **Web:** There is no Home page and no Home hamburger item. **Trends** is the movers landing; **Browse Sets** remains the set-catalog destination. The Trade Calculator at `/` is not renamed or replaced. Trends MUST NOT include the set list; Browse Sets MUST NOT be the movers landing.
- Catalog-wide card search is on the movers landing (mobile Home; web Trends) **and** on web Browse Sets. It finds Printings across every set without opening a set. An active search covers that destination’s body (movers on Trends / Home; the set list on Browse Sets); clearing search restores that body.
- Player-facing name for the lists is **recent movers**, not weekly movers or "this week." The web destination that hosts those lists is labeled **Trends**.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The **movers landing** MUST show **recent movers**. When the player owns at least one Binder Printing, it MUST show the **owned-cards movers view first** and catalog-wide gainers/losers below. When Binders are empty, it MUST show **only catalog-wide** movers (no empty owned section). On **mobile**, the movers landing is the **Home** tab (formerly Browse) and MUST NOT be a new top-level tab. On **web**, the movers landing is **Trends** in the hamburger menu; the website MUST NOT have a Home page or a Home nav item; **Browse Sets** MUST remain a separate hamburger destination for the set catalog. The player-facing name of the lists MUST be recent movers, not weekly movers.
- **FR-002**: The view MUST present two distinct ranked lists: gainers (Low up from start to now) and losers (Low down from start to now).
- **FR-003**: Ranking MUST be by percent change in observed **Low** from the start Low to the latest Low for the player's selected marketplace (TCGplayer Low, or CardMarket Low). Each row MUST still show the currency amount of that change. The product MUST NOT rank on Market, Mid, High, a blended price, or currency amount as the primary sort.
- **FR-004**: Each row MUST show Printing identity (name, set, and finish), current Low, percent change, and currency change from start to now.
- **FR-005**: Change MUST be computed from two observed Lows only: a **start Low** (the most recent observed Low whose capture day is **3–5 calendar days ago**) and the **latest observed Low** in the current catalog. If no Low exists in that 3–5 day window, or the latest Low is missing, the Printing MUST be excluded. The product MUST NOT interpolate, backfill, or display unpriced as zero. A Low newer than 3 days ago or older than 5 days ago MUST NOT be used as the start.
- **FR-006**: Catalog-wide lists MUST include every eligible Printing in the catalog, not limited to Printings in the player's Binders.
- **FR-007**: A general price floor MUST exclude cheap Printings from both lists: any Printing whose start Low is below USD $1.00 (TCGplayer) or EUR €1.00 (CardMarket) MUST NOT appear, regardless of percent change (for example a 30¢ Low that doubled to 60¢).
- **FR-022**: A Printing MUST be omitted when its start Low or latest Low is above 10000 (USD or EUR) or when `abs((latest_low - start_low) / start_low)` is greater than 10. Those values are treated as catalog errors, not real recent movers. The product MUST NOT display them as six-figure gainers.
- **FR-008**: Each list MUST show a short ranked set: up to 10 Printings when at least 10 qualify, otherwise every qualifying Printing. The view MUST NOT pad with ineligible or invented rows.
- **FR-009**: A Printing with 0% change MUST NOT appear on either list.
- **FR-010**: Selecting a row MUST open that Printing's existing card details. It MUST NOT open a different Printing that shares the card name.
- **FR-011**: Loading, empty, and error for movers MUST NOT hide or block catalog search, set browsing (mobile scroll or web Browse Sets), Binder, or trade flows.
- **FR-012**: Catalog-wide recent movers MUST remain visible without an account. Signed-out players get the same catalog-wide lists as signed-in free players. Owned movers MUST use Binder data already on the device and MUST NOT require sign-in.
- **FR-013**: Changing the selected marketplace MUST refresh both catalog-wide and owned lists to that marketplace's Low series.
- **FR-014**: The view MUST credit that values come from the same observed catalog as today's prices (not an appraisal, not a sale the product brokered).
- **FR-015**: Recent movers MUST be available on both web and mobile with the same ranking rules and the same meaning of gainer vs loser.
- **FR-016**: **Mobile:** The first tab MUST be labeled **Home**, not Browse. The set catalog MUST remain one step from Home on the same scroll. Trade, Binder, and Lend MUST keep their existing top-level places. **Web:** The hamburger MUST include **Trends** (movers landing) and **Browse Sets** (set catalog) as separate items. The website MUST NOT label any page or nav item Home. The Trade Calculator at `/` MUST stay the trade destination and MUST NOT be replaced by movers or renamed Home. Binders, Want List, and Trade History MUST keep their existing hamburger places.
- **FR-017**: Catalog-wide card search MUST be immediately available on the movers landing (mobile Home; web Trends) **and** on web Browse Sets: the player can search all Printings without opening a set first. Selecting a result MUST open that Printing's card details. Clearing search on the movers landing MUST return to the recent movers lists (catalog-wide and owned). Clearing search on web Browse Sets MUST return to the set list, not to Trends. On web Browse Sets, catalog-wide Printing search is the primary search (not set-name-only as the sole search). Movers loading, empty, or error MUST NOT block search on either web destination.
- **FR-018**: The movers landing MUST include a separate owned-cards recent movers view (gainers and losers) that uses the same ranking, Low series, 3–5 day start, percent sort, currency amount, and price floor as catalog-wide, limited to Printings with quantity greater than zero in **any Binder** (Trade Binder, the keep pile named Collection, and any other Binders). The same Printing MUST appear at most once on owned movers even if it lives in multiple Binders. Catalog-wide and owned MUST NOT be one list with a switcher. The player MUST be able to tell which view is catalog-wide and which is owned.
- **FR-019**: Want List entries MUST NOT appear on owned movers. Want List is not a Binder.
- **FR-020**: An empty owned movers view (player owns cards, none qualify) MUST NOT hide, replace, or block catalog-wide movers, catalog search, set browsing, Binder, or trade. When Binders are empty, the owned view MUST be omitted entirely so the movers landing is catalog-wide only.
- **FR-021**: Web Trends MUST NOT embed the set catalog. Web Browse Sets MUST NOT embed recent movers. Mobile MAY keep the set list on the Home scroll below movers.

### Key Entities

- **Printing**: A specific physical version of a card (set + finish). Movers rank Printings, not card names.
- **Recent Low change**: The percent and currency difference between the start Low (most recent observed Low from 3–5 calendar days ago) and the latest observed Low for that Printing on the selected marketplace. Missing either Low means no recent change — the Printing is ineligible, not zero.
- **Gainer**: An eligible Printing whose recent Low change is positive, ranked by largest percent increase.
- **Loser**: An eligible Printing whose recent Low change is negative, ranked by largest percent decrease.
- **Recent movers**: Ranked gainers/losers views (catalog-wide and owned-card) on the movers landing. Distinct from a single Printing's price history on card details, and distinct from the set catalog. Not called weekly movers.
- **Owned Printing**: A Printing with quantity greater than zero in any Binder. Used only for the owned movers view. The keep pile may be named Collection; that name is not a separate product type. Want List does not create ownership. Duplicate Binder rows for one Printing still count as one owned mover.
- **Movers landing**: The screen that shows recent movers. Owned first then catalog-wide when Binders have cards; catalog-wide only when Binders are empty. Catalog search is immediately available.
- **Home**: Mobile only. The first tab (formerly Browse). Home *is* the movers landing; the set catalog is one step away on the same scroll. Catalog search is immediately available.
- **Trends**: Web only. Hamburger destination for the movers landing. Must not be labeled Home. Catalog-wide card search is immediately available.
- **Browse Sets**: Web hamburger destination for the set catalog. Separate from Trends. Not the movers landing. Catalog-wide card search is immediately available (empty search shows the set list).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opening the movers landing (mobile Home; web Trends) shows recent movers within 10 seconds, without opening a specific card or a set first. With owned cards, owned lists are first; with empty Binders, catalog-wide top gainer and loser are visible in that time.
- **SC-002**: 90% of first-time testers can correctly identify, from the view alone, whether a named Printing went up or down recently and by roughly how much (percent and currency).
- **SC-003**: 100% of rows on either list are Printings with a latest observed Low and a start Low from 3–5 days ago; no row displays $0.00 / €0.00 because a Low was missing.
- **SC-004**: When at least 10 Printings qualify as gainers (or losers), that list shows 10 rows; when fewer qualify, the list length equals the number that qualify.
- **SC-005**: Selecting a movers row reaches that Printing's card details in one action; 100% of those openings match the Printing on the row (same set and finish).
- **SC-006**: Signed-out players can complete SC-001 without creating an account.
- **SC-007**: If movers fail or are empty, the player can still search cards from the movers landing (and on web from Browse Sets), open the set catalog (mobile: from Home; web: Browse Sets in the hamburger), open Binder, and start a trade on that same visit.
- **SC-008**: Printings under the general price floor (start Low below $1.00 / €1.00) do not appear on either list, even if their percent change would otherwise rank in the top 10.
- **SC-009**: A first-time tester looking at mobile tabs identifies the first tab as Home (not Browse) and does not look for a separate Movers tab. A first-time tester looking at the web hamburger identifies **Trends** and **Browse Sets**, does not look for Home, and sees the lists labeled as recent movers, not weekly.
- **SC-010**: From the movers landing (mobile Home; web Trends) **or** from web Browse Sets, a player can search a card name and open a matching Printing in one search, without opening a set first.
- **SC-011**: On the movers landing, 90% of first-time testers can tell which gainers/losers are catalog-wide and which are owned cards, without a tutorial.
- **SC-012**: 100% of rows on owned movers are Printings the player currently owns in at least one Binder; 0% are Want List-only, Collection-as-a-type, or unowned catalog cards. A Printing in two Binders appears at most once.
- **SC-013**: With empty Binders, catalog-wide movers appear within 10 seconds and the owned section is not on screen. With owned cards that do not qualify, owned empty copy appears first and catalog-wide remains below; neither case shows a fake $0.00 row.

## Assumptions

- **v1 includes both catalog-wide and owned movers.** They are separate views on the movers landing, not a single switchable list. Alerts stay out of this pass.
- **v1 has no alerts.** Customizable notifications when owned cards spike, including "best time to sell" pings, are planned follow-up. This product still does not broker sales; any future alert is informational so the player can sell elsewhere.
- **Name is recent movers, not weekly.** The original request said "last week"; clarification replaced that with a 3–5 day start window and the recent movers name.
- **Start Low is 3–5 calendar days ago.** If several observed Lows fall in that band, use the most recent one. Lows from 1–2 days ago or older than 5 days are not starts. No invented values for missed captures.
- **Rank by percent change of Low**, and show both percent and currency amount. Dollar-only ranking is out of this pass.
- **General price floor is $1.00 / €1.00 start Low.** Cheap cards that spike by a large percent (30¢ → 60¢) are not movers for this product. The floor is a standing eligibility rule, not a one-off exception.
- **Series is Low for the selected marketplace**, the same price card-details history already plots. Market/Mid/High stay off these lists.
- **List length is 10 per side** when enough Printings qualify. Short enough to scan at the table; not a dump of the whole catalog.
- **Movers landing is surface-native.** **Mobile:** Home (formerly Browse) lands on recent movers; owned first, catalog-wide below, when Binders have at least one Printing; empty Binders: catalog-wide only; set catalog stays one step on the same scroll; catalog search stays on Home. **Web:** No Home page. Hamburger has **Trends** (movers landing) and **Browse Sets** (set catalog) as separate destinations. Catalog-wide card search is on **both** Trends and Browse Sets. The Trade Calculator at `/` is not replaced or renamed Home.
- **No Pro gate on v1.** Catalog-wide recent movers are catalog data, like today’s prices. Signed-out works as free. A later spec may add Pro-only depth (longer windows, Binder-owned movers, alerts).
- **Card details already owns the per-Printing history chart.** Movers do not duplicate that chart; they deep-link into it.
- **Owned = any Binder.** Trade Binder, the keep pile named Collection, and any other Binders all count. Want List does not. One Printing is one owned row.

## Out of Scope

- Customizable price-spike alerts, push/email notifications, or "time to sell" recommendations. Planned follow-up. The product will not broker a sale in that follow-up either.
- Ranking by absolute dollar change as the primary sort (percent is v1).
- Other time windows (24 hours, 7 days, 30 days, custom ranges). v1 is the 3–5 day start window only.
- Calling the feature weekly movers, or labeling the lists as "this week," once this clarification stands.
- Set indexes, class/hero filters, or "compare two cards" on this view.
- User-entered prices, sold listings, or condition-adjusted movers.
- Plotting Market, Mid, or High on the movers lists.
- A marketplace, listing, or checkout flow.
- Requiring an account to see catalog-wide movers.
- Hiding movers behind Pro in this pass.
- Replacing or relocating the per-Printing price history section on card details.
- Want List movers. Want List is not a Binder; owned movers is Binder-owned Printings only.
- Collapsing catalog-wide and owned movers into one list with a switcher. They are separate views.
- A fifth top-level **mobile** tab (or a primary mobile “Movers” tab). On mobile, recent movers is the Home tab landing.
- A web page or hamburger item labeled **Home**. Web movers live under **Trends**; set browsing stays **Browse Sets**.
- Replacing or renaming the web Trade Calculator at `/` into a Home or Trends landing.
- Leaving the mobile first tab labeled Browse.
- Making the mobile Home tab land on the set catalog. The set list is one step below movers, not the first screen.
- Putting the web set catalog on Trends, or putting recent movers on Browse Sets.
- Removing catalog-wide card search from the movers landing or from web Browse Sets, or requiring the player to open a set before they can search cards.
- Making catalog-wide card search available on only one of web Trends or web Browse Sets.
