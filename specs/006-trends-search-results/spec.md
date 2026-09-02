# Feature Specification: Trends Search Results as Mover Boxes

**Feature Branch**: `006-trends-search-results`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "When searching for a card on the trends page, the results should be in the form of the boxes consistent with the trends and should show the price trend of the search result cards."

## Clarifications

### Session 2026-08-26

- Q: When a player searches for a card whose start Low is under the $1 / €1 ranked-movers floor, should that result box still show the honest percent and currency change? → A: Show identity, current Low, and the honest recent change even when start Low is under $1 / €1.
- Q: When Trends or Home search shows trend boxes, should the player still be able to sort those results the way catalog search already works on that surface? → A: Keep each surface’s existing search sort (Home keeps it if it already has one; Trends does not gain a new one). Never offer percent-change as a dedicated sort.
- Q: When a matching card has no honest recent move (missing start Low, unpriced, unchanged, or an outlier), how should the box show that there is nothing to trend? → A: Omit percent and currency change; show identity and current Low (or unpriced); no extra label.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search on Trends and see matching cards as trend boxes (Priority: P1)

A player is on the **movers landing** (web **Trends**; mobile **Home**) and types a card name. They are looking up a specific Printing, not scanning the ranked top gainers and losers. The ranked recent-movers lists give way to **search results**.

Those results are **the same kind of boxes** used for recent movers — not a plain name-and-price list. Each matching Printing is its own box: enough identity to tell which Printing it is (name, set, finish), current Low, and that Printing’s **recent price trend** (percent change and currency amount, up vs down at a glance). A card that did not make the ranked top 10 still appears if it matches the search, with **its own** recent move — not a blank price-only row.

Search still finds Printings across the whole catalog without opening a set first. Ranked owned movers and catalog-wide movers are hidden while search is active. Clearing the search brings the ranked lists back.

Surfaces stay native:

- **Web:** This presentation applies on **Trends**. **Browse Sets** search is unchanged by this feature (it remains catalog search, not a trends view).
- **Mobile:** The same box-and-trend presentation applies when searching from **Home** (the movers landing). Searching inside a set is unchanged.

**Why this priority**: The player asked for a card on Trends because they want its market pulse in the same language as the lists they were just looking at. A list of names and today’s price answers “does this card exist”; the boxes answer “what happened to it lately.”

**Independent Test**: Open Trends (or mobile Home). Type a card name that matches at least one Printing. Confirm results are mover-style boxes (not a plain list), each showing identity, current Low, and recent percent plus currency change when that change can be computed. Confirm Browse Sets search is still the existing catalog list.

**Acceptance Scenarios**:

1. **Given** the player is on web Trends with an empty search, **When** they type a card name that matches catalog Printings, **Then** the ranked recent-movers lists are replaced by matching Printings shown as trend boxes, not as a name-and-price list.
2. **Given** search results on Trends, **When** the player glances at a matching Printing, **Then** they see the same kind of box used for ranked movers: identity (name, set, finish), current Low, and a recent up or down change they can tell apart without reading every number.
3. **Given** a Printing that matches the search but is not on the ranked top-10 gainers or losers, **When** results appear, **Then** that Printing still appears as a trend box with **its own** recent Low change (percent and currency) when that change can be computed from observed Lows — including when start Low is under the $1 / €1 ranked-list floor.
4. **Given** several Printings share a name (different set or finish), **When** the player searches that name, **Then** each Printing is its own box so they can tell finishes and sets apart.
5. **Given** the player’s selected marketplace (TCGplayer or CardMarket), **When** search-result trends are shown, **Then** current Low and recent change use that marketplace’s Low only — never Market/Mid/High, and never a mix of marketplaces on one result set.
6. **Given** an active search on Trends, **When** the player clears the search, **Then** the ranked recent movers (owned first when Binders have cards; catalog-wide otherwise) return; they are not stuck on search results.
7. **Given** the player is on web Browse Sets, **When** they search a card name, **Then** results stay the existing catalog list; they are not forced into Trends boxes.
8. **Given** the player is on mobile Home, **When** they search a card name from the movers landing, **Then** matching Printings appear as the same kind of trend boxes with recent change, not a plain list, and any sort control Home already had for catalog search still works on those boxes. Searching after opening a set is unchanged.
9. **Given** a signed-out player, **When** they search on Trends (or mobile Home), **Then** they see the same catalog-wide trend-box results as a signed-in free player; they are not asked to sign in.
10. **Given** enough matching Printings, **When** the player scans results, **Then** they can tell they are looking at **matches for their search**, not a re-ranked “biggest movers” list. Default order follows how well the name matches. If that surface already offers catalog-search sort (for example name or price), using it reorders the same boxes; it MUST NOT sort by recent percent change as a dedicated movers ranking.

---

### User Story 2 - Open a search-result box to inspect the Printing (Priority: P2)

The boxes are a scan. When a search-result Printing looks interesting, the player opens it and lands on that Printing’s existing card details — including today’s prices and that Printing’s price history — so they can judge the recent move the same way they would from a ranked mover.

**Why this priority**: Trend boxes without a way to inspect the card are a teaser. Card details already own the full history. Connecting search results the same way ranked movers connect is the second slice.

**Independent Test**: From a Trends (or mobile Home) search-result box, open the Printing. Confirm card details opens for that same Printing (not a different finish or set) and that today’s prices remain usable.

**Acceptance Scenarios**:

1. **Given** a Printing shown as a search-result box on Trends (or mobile Home), **When** the player selects that box, **Then** they reach that Printing’s existing card details (not a different Printing that shares the name).
2. **Given** card details opened from a Trends search result, **When** the player is done inspecting, **Then** they can return to Trends with their search still in place (results still showing) without losing their place in the app.
3. **Given** card details opened from a search-result box, **When** details load, **Then** today’s prices remain visible; the player is not stuck on a ranking-only screen.

---

### User Story 3 - Honest empty, no-trend, and failure states (Priority: P3)

Search must not invent a move. Matching Printings without a recent start Low, without a current Low, or with an unchanged Low still appear as boxes so the player knows the card exists. Those boxes keep identity and current Low (or unpriced) and **leave the change line off** — no “No recent move” label, no dash placeholder, and no fake 0% or $0.00 / €0.00. No matches, a failed trend load, and unpriced cards stay honest.

**Why this priority**: Fabricated zeros on a card the player named would undermine the same catalog the ranked movers and the trade balancer use.

**Independent Test**: Search a name with no matches; search a Printing that is unpriced or has no 3–5 day start Low; search when trend numbers cannot be loaded. Confirm each state is clear, non-zeroing, and does not block the rest of the app.

**Acceptance Scenarios**:

1. **Given** a search that matches no Printings, **When** results would appear, **Then** the player sees that nothing matched; they do not see empty mover boxes or fake $0.00 rows.
2. **Given** a matching Printing with a current Low but no observed start Low in the 3–5 day window, **When** it appears as a result box, **Then** the player still sees identity and current Low, and the percent and currency change line is omitted (not 0%, not $0.00, not a dash, and not extra copy).
3. **Given** a matching Printing that is unpriced today, **When** it appears as a result box, **Then** current Low is shown as unpriced (not $0.00 / €0.00), and the percent and currency change line is omitted.
4. **Given** a matching Printing whose Low is unchanged from start to now, **When** it appears as a result box, **Then** identity and current Low are shown and the change line is omitted; it is not presented as a gainer or a loser.
5. **Given** recent-change numbers cannot be loaded for search results, **When** the player has typed a query that matches Printings, **Then** they still see matching boxes with identity (and current Low when already available) plus a brief failure/retry for the trend figures; search itself is not blocked, and they can still open Binder, start a trade, and (on web) open Browse Sets.
6. **Given** ranked movers failed to load before the player searched, **When** they type a card name, **Then** search still runs and shows matching Printings as trend boxes; movers failure does not disable search.

---

### Edge Cases

- Search results are **matching Printings**, not a second copy of the ranked top-10 lists. A card can appear in search even if it did not qualify for ranked movers (price floor, list length, or not in the top 10).
- The general price floor ($1.00 / €1.00 start Low) applies to **ranked** gainers and losers so cheap cards do not crowd those lists. It MUST NOT hide a Printing the player searched for by name, and it MUST NOT omit that Printing’s honest recent Low change. A 30¢ card that doubled still shows identity, current Low, and the real percent and currency change on a name match.
- A Printing whose start or latest Low is above $10,000 / €10,000, or whose percent change exceeds 1000% in the 3–5 day window, MUST NOT display that garbage change as a real trend. The box still identifies the Printing; the trend figures are omitted (not shown as a six-figure gainer).
- A Printing with only today’s Low (too new for a 3–5 day start) appears in search if it matches, with identity and current Low and the change line omitted (no invented trend, no extra label).
- A Printing whose Low on an exact day in the 3–5 day window is missing MAY still show a trend if another observed Low falls in that window; the start price is the most recent observed Low in the 3–5 day band. The product does not invent a Low for a missing day.
- Switching marketplace (TCGplayer ↔ CardMarket) rebuilds search-result Lows and trends for that marketplace; leftover figures from the previous marketplace must not remain.
- Very large match sets: the player still gets a scannable set of matching boxes (not every Printing in the game if the query is extremely broad). Existing catalog search matching and reasonable result limits stay; this feature changes **how** matches are presented, not **whether** catalog-wide search exists.
- Ties and sort: default order is how well the query matches the card name, then a stable order for equal matches. A surface that already has catalog-search sort (mobile Home) MAY reorder the same matching boxes with those existing options. Results MUST NOT be re-sorted into gainers vs losers, and MUST NOT gain a new “sort by percent change” control. Web Trends MUST NOT add a sort control in this feature.
- **Web:** Trends search uses trend boxes. Browse Sets search stays the catalog list. Trends still MUST NOT include the set catalog.
- **Mobile:** Home search (movers landing) uses trend boxes. Set-level search after opening a set is out of this feature.
- Signed-out is treated as free: catalog-wide Trends/Home search works; no account wall.
- Owned movers stay a ranked view for an empty search. An active search is catalog-wide matches, not “owned only.”

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When catalog-wide search is active on the movers landing (web **Trends**; mobile **Home**), matching Printings MUST be presented as **trend boxes** visually consistent with ranked recent-mover boxes (identity, current Low, recent change when available). They MUST NOT be presented as a plain name-and-price list on those destinations.
- **FR-002**: Each search-result box MUST show Printing identity (name, set, and finish) and current Low for the selected marketplace when a Low exists. Unpriced MUST be shown as unpriced, never as zero.
- **FR-003**: Each search-result box MUST show that Printing’s **recent Low change** (percent and currency amount, direction visually distinct) when a start Low from 3–5 calendar days ago and a latest Low both exist, using the same meaning of recent change as ranked movers. The ranked-list price floor MUST NOT suppress those figures. The product MUST NOT interpolate, backfill, or display missing change as 0% or $0.00 / €0.00.
- **FR-004**: Search results MUST include matching Printings even when they are not on the ranked top-10 gainers or losers lists. Ranked-list length and the ranked-list price floor MUST NOT exclude a name match from search results, and MUST NOT strip an otherwise honest recent change from that match’s box.
- **FR-005**: Default search result order MUST follow catalog name matching (how well the query matches), not percent change. Results MUST NOT be split into a “biggest gainers” list and a “biggest losers” list, and MUST NOT offer percent-change as a dedicated sort. A surface that already has catalog-search sort MUST keep it for these trend boxes. Web Trends MUST NOT gain a new sort control in this feature.
- **FR-006**: A search-result box MUST omit the percent and currency change line when change cannot be computed honestly: no Low in the 3–5 day start window, no latest Low, unchanged Low (not a gainer or loser), or outlier values (start or latest Low above 10000, or absolute percent change greater than 1000%). Omission MUST NOT be replaced with 0%, $0.00 / €0.00, a dash, or extra copy such as “No recent move.” Start Low under the ranked-list $1 / €1 floor is **not** a reason to omit trend figures. Identity MUST still appear for a name match.
- **FR-007**: Selecting a search-result box MUST open that Printing’s existing card details. It MUST NOT open a different Printing that shares the card name.
- **FR-008**: Clearing search on the movers landing MUST return to the ranked recent movers lists (owned first when Binders have cards; catalog-wide only when Binders are empty), as already specified for that landing.
- **FR-009**: Web **Browse Sets** catalog search MUST keep its existing list presentation. This feature MUST NOT replace Browse Sets results with trend boxes.
- **FR-010**: Mobile search after the player has opened a set MUST keep its existing set-scoped presentation. This feature applies to search on the movers landing (Home), not to in-set browse.
- **FR-011**: Catalog-wide Trends/Home search with trend boxes MUST remain available without an account. Signed-out players get the same catalog-wide results as signed-in free players.
- **FR-012**: Changing the selected marketplace MUST refresh search-result Lows and trend figures to that marketplace’s Low series.
- **FR-013**: Loading, empty, and error for ranked movers MUST NOT hide or block search on the movers landing. Failure to load trend figures for results MUST NOT invent zeros and MUST NOT block opening card details, Binder, or trade.
- **FR-014**: Returning from card details opened from a Trends/Home search result MUST restore the movers landing with the same query and the same matching boxes still visible.
- **FR-015**: Web and mobile movers-landing search MUST use the same meaning of recent Low change, gainer vs loser coloring when a change is shown, and the same 3–5 day start window. Chrome may differ (web Trends vs mobile Home).

### Key Entities

- **Printing**: A specific physical version of a card (set + finish). Search results and trend boxes are per Printing, not per card name.
- **Search-result box**: A mover-style box for one matching Printing on the movers landing while search is active. Same visual language as ranked recent-mover boxes; content is that Printing’s identity, current Low, and recent change when honest.
- **Recent Low change**: The percent and currency difference between the start Low (most recent observed Low from 3–5 calendar days ago) and the latest observed Low for that Printing on the selected marketplace. Missing either Low means no recent change to show — not zero.
- **Movers landing**: Web **Trends**; mobile **Home**. Ranked recent movers when search is empty; catalog-wide search results as trend boxes when search is active.
- **Browse Sets**: Web catalog destination. Search there stays a catalog list. Out of scope for trend-box results.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On web Trends, after typing a card name that has matches, 100% of visible results are trend boxes (identity + current Low, plus recent change when computable), and 0% are plain name-and-price list rows.
- **SC-002**: 90% of first-time testers looking at a Trends search result can tell whether that Printing went up, went down, or has no recent move to show (change line present and colored vs change line omitted), without opening card details.
- **SC-003**: 100% of search-result boxes that display a percent or currency change have both a latest observed Low and a start Low from 3–5 days ago; no box displays $0.00 / €0.00, 0%, a dash, or “No recent move” copy because a Low was missing.
- **SC-004**: A Printing that matches the query but is absent from the ranked top 10 still appears in search results when the name matches, including when start Low is under $1 / €1; if an honest recent change exists, testers see that percent and currency change on the box without opening a set.
- **SC-005**: Selecting a search-result box reaches that Printing’s card details in one action; 100% of those openings match the Printing on the box (same set and finish).
- **SC-006**: Signed-out players can complete SC-001 without creating an account.
- **SC-007**: Clearing search returns ranked recent movers on the same visit; 100% of testers are not left on an empty search-results view.
- **SC-008**: On web Browse Sets, searching a card name still yields the existing catalog list; testers do not see Trends-style boxes as the Browse Sets result presentation.
- **SC-009**: If trend figures fail to load, the player can still identify matching Printings and open one within the same visit; the rest of the app (Binder, trade, web Browse Sets) remains usable.

## Assumptions

- **v1 is presentation of existing movers-landing search**, not a new search destination and not a change to which Printings catalog search can find.
- **“Boxes consistent with the trends”** means the same mover-box language already used for ranked gainers and losers (identity, current Low, percent and currency change, up vs down), not a new chart type and not a duplicate of the per-Printing history on card details.
- **Search is catalog-wide matches**, not “filter the ranked top 10.” A named card shows even if it missed the ranked lists or the ranked price floor, and its honest recent change still shows on the box.
- **Recent change on a result uses the same 3–5 day start Low rules as ranked movers.** No invented Lows. No 0% placeholder when the window is missing.
- **Unchanged Low is not a trend to highlight.** Show identity and current Low; omit the change line. Do not paint it as up or down, and do not add a “No recent move” label or a dash.
- **Web Browse Sets stays a list.** The request is about the trends page. Mixing trend boxes into set browsing would blur Trends vs Browse Sets.
- **Mobile Home search follows Trends** because the two clients share one brand and Home is the movers landing. In-set mobile search is unchanged.
- **Result limits stay those of catalog search** (a scannable match list). This feature does not require showing every Printing in the game for a one-letter query.
- **Sort stays surface-native.** Mobile Home keeps its existing catalog-search sort on trend-box results. Web Trends does not add a sort control. Neither surface sorts search results as ranked movers.
- **No Pro gate.** Catalog search and observed Lows are catalog data. Signed-out works as free.
- **Card details still owns the history chart.** Search-result boxes show the recent move summary; they do not add a second history graph.

## Out of Scope

- Changing ranked recent movers (owned or catalog-wide lists, ranking, price floor, outlier cap, list length).
- Showing a price-history chart or sparkline inside each search-result box.
- Filling an empty change slot with 0%, $0.00 / €0.00, a dash, or “No recent move” copy.
- Re-ranking or splitting search results into biggest gainers vs biggest losers, or adding a dedicated percent-change sort.
- Adding a new sort control on web Trends, or removing mobile Home’s existing catalog-search sort from these results.
- Applying the ranked-list $1 / €1 price floor to hide name matches or to omit an honest recent change on a name match.
- Changing web Browse Sets search into trend boxes.
- Changing mobile in-set search (after opening a set).
- New search syntax, filters (set, class, hero), or marketplace-specific query language.
- Customizable alerts, “time to sell” copy, or brokerage.
- Requiring an account to search on Trends or Home.
- Replacing card-details price history.
- Putting the set catalog on web Trends.
