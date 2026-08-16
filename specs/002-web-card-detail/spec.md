# Feature Specification: Web Card Detail Modal

**Feature Branch**: `002-web-card-detail`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "we have a detailed card page on mobile, but I want to bring that same experience to the web app. Everywhere a card is viewed, if it has it's name it should be clickable and it should display a card detail modal."

## Clarifications

### Session 2026-08-14

- Q: When a player opens card details from a set, Binder, Want List, or history — not from the trade balancer — what should **Add to trade** do? → A: Show **Add to trade** only when the balancer is already the page behind the modal.
- Q: When **Add to trade** is shown on the balancer, which side of the live trade should it add the Printing to? → A: Always add to **Want**.
- Q: After the player successfully adds to **Want** (or to the Want List) from the modal, should the modal stay open? → A: Stay open after a successful add, with a brief confirmation.
- Q: Should tapping a card’s art/thumbnail open the same detail modal, or keep today’s art-only zoom? → A: Art/thumbnail opens the detail modal. Zoom lives inside the modal. No separate art-only overlay.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect a card without leaving the page (Priority: P1)

A player is mid-trade, browsing a set, or looking at Binder / Want List. They need the same glance they get on mobile: this **Printing**'s art, identity, finish, and **Prices** (today's catalog numbers). On web they open that as a **modal** over the page they are already on. Closing it returns them to the same piles, scroll position, and task.

They do not navigate to a separate card site, lose the trade, or hunt prices on another tab.

**Why this priority**: This is the feature. Mobile already answers "what is this printing, and what is it worth?" in one place. Web currently shows a name and sometimes an art-only preview. The table deadline is keeping that glance on top of the work they were doing.

**Independent Test**: From the trade balancer, open a named card. Confirm a detail modal appears with art, name, set/meta, finish, and a Prices section comparable to mobile, and that dismissing it leaves the trade unchanged.

**Acceptance Scenarios**:

1. **Given** a player is on a web page that shows a named card, **When** they open that card's details, **Then** a modal appears over the current page (the page behind is not replaced).
2. **Given** the modal is open, **When** they dismiss it (close control, click outside, or Escape), **Then** they are back on the same page with the same trade / list / scroll context.
3. **Given** a Printing with catalog data, **When** the modal opens, **Then** they see that Printing's art, name, set and collector identity, finish, and today's Prices without signing in.
4. **Given** the Prices section is visible, **When** they compare to what mobile card details shows for the same Printing, **Then** they can read the same marketplace numbers (TCGplayer Market/Low/Mid/High/Direct low and CardMarket Trend/Low/Avg), including unpriced shown as unpriced — never as zero.
5. **Given** the modal is loading or a piece of detail is missing (no art, no prices), **When** it is open, **Then** the rest of the identity still shows and the page behind remains usable after dismiss.

---

### User Story 2 - Every named card is a way in (Priority: P2)

Wherever web already shows a card **name** — trade Have/Want piles, set lists, Binder, Want List, shared Binder, trade history, search results — that name is clearly clickable and opens the same detail modal for that Printing. Where art is shown, the thumbnail opens that same modal (not a separate image-only overlay).

Surfaces whose job is "pick this card to add" keep an explicit add action. Clicking the **name** inspects; it does not silently add or remove a card.

**Why this priority**: A details modal that only exists on one page is easy to miss. The request is that named cards everywhere are the entry. Independent of how rich the modal is, clickable names are how players discover it.

**Independent Test**: Walk trade piles, a set page, Binder or Want List, shared Binder, history, and search. Every visible card name opens the modal for that Printing; add-to-pile behavior still works through its own control.

**Acceptance Scenarios**:

1. **Given** a card row or tile that displays the card's name, **When** the player activates the name, **Then** the card detail modal opens for that Printing.
2. **Given** a search or picker whose primary job is adding a card to a trade or list, **When** the player activates the name, **Then** the modal opens and the card is **not** added as a side effect; add remains a separate control (including **Add to trade** inside the modal).
3. **Given** a surface that currently opens art-only preview from the thumbnail, **When** the player activates the thumbnail or the name, **Then** the card detail modal opens for that Printing. Full-size art zoom is inside the modal; a separate art-only overlay is not shown.
4. **Given** a name that is only decorative with no Printing identity (should not occur for catalog cards), **When** there is no Printing to open, **Then** the name is not presented as a details control.
5. **Given** the modal is already open, **When** the player is still on the same page, **Then** they cannot end up with two detail modals stacked; a new open replaces or updates the current one.

---

### User Story 3 - Details follow the selected Printing (Priority: P3)

A card has several Printings (Normal, Cold Foil, Rainbow Foil, alt art, reprints). The player opened details from one of them. Inside the modal they can switch Version, and art plus Prices update to that Printing — not the card name as a whole.

**Why this priority**: FAB Trades prices Printings, not names. Mixing finishes would lie about the trade. This matches mobile Versions and can be shipped after a single-printing modal already has value.

**Independent Test**: Open details on a card with at least two Printings. Switch Version and confirm art and Prices change; the Printing they opened from is selected first.

**Acceptance Scenarios**:

1. **Given** a card with multiple Printings, **When** the modal opens from one of them, **Then** that Printing is the one shown first.
2. **Given** the modal is open, **When** the player selects another Version, **Then** art, identity, finish, and Prices update to that Printing only.
3. **Given** a Printing with no art or no prices, **When** it is selected, **Then** the player sees an honest empty/unpriced state for those pieces, not another Printing's data.

---

### User Story 4 - Act without losing the page (Priority: P4)

From the modal the player can add this Printing to the **Want List** without being forced onto a different page. **Add to trade** appears only when the page behind the modal **is already the trade balancer** — browse, Binder, Want List, shared Binder, and history stay inspect (and Want List) surfaces, not a way to start a trade from the modal. Binder quantity for a printing they already own can be understood from the modal the way mobile shows **Own N**.

Mobile-only flows (scan, lends, Trade Filler) stay off web.

**Why this priority**: Inspect without a next step still helps; acting from the same glance is what makes it a peer to mobile. It depends on the modal existing (P1).

**Independent Test**: Open the modal from the balancer and confirm **Add to trade** is present and adds the Printing to **Want**. Open it from a set page (or Binder / history): **Add to trade** is absent; Want List still works when signed in.

**Acceptance Scenarios**:

1. **Given** a signed-out or signed-in player, **When** they open the modal, **Then** they can still read identity and Prices; account is not required to inspect.
2. **Given** the modal is open over the trade balancer, **When** they choose **Add to trade**, **Then** that Printing is added to the live trade’s **Want** side (even if they opened details from Have), they see a brief confirmation, the modal stays open, and they are not dumped onto a blank page.
3. **Given** the modal is open over a set, Binder, Want List, shared Binder, or history page, **When** they inspect the card, **Then** **Add to trade** is not offered in the modal (those pages keep their own existing add controls, if any).
4. **Given** a signed-in player under the free Want List ceiling, **When** they add to Want List from the modal, **Then** the Printing is on the Want List, they see a brief confirmation, and the modal stays open; over the ceiling they are offered the existing upgrade path, not a silent failure.
5. **Given** a signed-out player, **When** they try a Binder / Want List change that web already requires an account for, **Then** they are asked to sign in (existing web rule); the modal does not invent a local Binder on web.
6. **Given** the Printing is already in the player's Binder, **When** the modal is open, **Then** they can tell they own it (quantity), consistent with mobile's Own badge.

---

### Edge Cases

- After a successful **Add to trade** or Want List add: the modal stays open with a brief confirmation so the player can switch Version and add another Printing. Failure (sign-in required, free-tier ceiling) does not pretend the add succeeded.
- Opening details from trade history, a set, Binder, Want List, or a shared Binder: inspect still works; **Add to trade** is omitted because those pages are not the balancer. A shared Binder's own on-page **Add to trade** (if present) is unchanged. The modal must not edit someone else's Binder.
- A Printing that was just added to the catalog (prices missing): modal still opens; Prices show unpriced, not $0 / €0.
- Very long names, foil subtypes, and multi-set reprints: Versions remain grouped in the trader's language (set + finish), not pitch color.
- Keyboard and pointer: Escape and a visible close control both dismiss; focus is not trapped after close.
- Slow or failed catalog/image load: modal shows a retry or missing-art state; it does not freeze the page behind.
- Clicking a name on a search result vs clicking an add control: inspect vs add stay distinct.
- Replacing today's art-only preview: thumbnail and name both open the detail modal. Players who used thumbnail → big art still get art via zoom inside that modal, not a second competing overlay.
- Condition on Binder entries: if shown, it stays descriptive only and does not change Prices.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Web MUST provide a card detail modal that overlays the current page and does not replace it with a standalone card site as the primary inspect path.
- **FR-002**: Any catalog card that displays its **name** on web MUST make that name a control that opens the detail modal for that **Printing**.
- **FR-003**: The modal MUST show the selected Printing's art, name, set/collector identity, finish, and today's **Prices**, as the mobile card details page does, using the same trader vocabulary (Printing, Prices, Binder, Want List).
- **FR-004**: Prices in the modal MUST be observed catalog values. Unpriced MUST display as unpriced, never as zero. The product MUST NOT invent or estimate a price.
- **FR-005**: The Prices section MUST present both marketplaces' current numbers the way mobile card details does (TCGplayer and CardMarket groups), so a player can glance without leaving the modal.
- **FR-006**: Inspecting a card MUST work signed out. Sign-in MUST NOT be required to see art, identity, or Prices.
- **FR-007**: Dismissing the modal MUST restore the underlying page without clearing the live trade, Binder, or filters.
- **FR-008**: Activating a card **name** MUST NOT add, remove, or change quantities as a side effect. Add / remove stay explicit actions.
- **FR-009**: When a card has multiple Printings, the modal MUST let the player switch Version and MUST update art and Prices to the selected Printing only. The Printing that was opened is the initial selection.
- **FR-010**: The modal MUST offer **Add to trade** for the selected Printing **only when the page behind the modal is the trade balancer**. It MUST NOT offer **Add to trade** from set browse, Binder, Want List, shared Binder, or trade history. When shown, it MUST add that Printing to the live trade’s **Want** side. Adding MUST NOT require the player to re-search that name. After a successful add, the modal MUST stay open and MUST show a brief confirmation.
- **FR-011**: The modal MUST offer **Want List** add for the selected Printing, subject to web's existing account and free-tier rules. After a successful add, the modal MUST stay open and MUST show a brief confirmation. It MUST NOT port scan, lends, or Trade Filler onto web.
- **FR-012**: For a named catalog card that also shows art, activating the thumbnail MUST open the same detail modal as the name. A separate art-only overlay MUST NOT remain as an inspect path. Enlarged art MUST be available inside the modal.
- **FR-013**: Named cards on trade piles, set detail lists, Binder, Want List, shared Binder, trade history, and search results MUST all open the same detail experience (one pattern, not a different popup per page).
- **FR-014**: Loading, missing art, missing prices, and failed load MUST be obvious in the modal and MUST NOT present blank silence or a fabricated card.
- **FR-015**: Credit that Prices come from the same catalog as the rest of the product (marketplace attribution and freshness when known).

### Key Entities

- **Printing**: A specific physical version of a card (set + finish), keyed the same way Binder and trade rows are. The modal is always about a Printing, not a bare name.
- **Card detail modal**: Overlay inspect surface on web; peer to mobile's card details page. Contains identity, art, Prices, Versions, and web-available actions.
- **Prices**: Today's catalog snapshot for the selected Printing (TCGplayer and CardMarket fields already shown on mobile details). Not a history series in this feature.
- **Entry point**: Any on-page display of a catalog card **name** (and, where art is shown, the matching thumbnail).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a named card on web, a player can open details in one activation and see identity + Prices without leaving the page they were on.
- **SC-002**: After dismiss, the player can continue the previous task immediately — the live trade or list they left is still there (no restart, no lost pile).
- **SC-003**: 100% of catalog card names shown on the listed web surfaces (trade piles, set detail, Binder, Want List, shared Binder, trade history, search) open the detail modal for that Printing. Where those surfaces also show art, 100% of those thumbnails open the same modal (not an art-only overlay).
- **SC-004**: Switching Version never leaves another Printing's prices or art on screen once the new Printing has loaded.
- **SC-005**: A signed-out player can complete inspect (art + Prices) without creating an account.
- **SC-006**: Unpriced fields never appear as $0.00 or €0.00 in the modal.
- **SC-007**: A player can tell they opened details (not a raw image-only overlay) within 2 seconds of activation: name, finish, and Prices are visible in that glance.
- **SC-008**: When the modal is over the balancer, **Add to trade** puts the Printing on **Want** without typing the name again. When it is over any other listed surface, **Add to trade** is not present in the modal.
- **SC-009**: After a successful **Add to trade** or Want List add, the player still sees the same modal (it does not close) and can tell the add worked without guessing.

## Assumptions

- **Web overlay, not a new primary route.** Mobile uses a full screen because it is an app stack. Web keeps the player on trade / set / Binder by using a modal. A shareable card URL is not required for v1.
- **Parity is with mobile card details as players use it today**: art (with zoom), identity, Versions, dual-marketplace Prices, Want List, Add to trade, Own quantity when already in Binder. **Price history** under Prices is a separate feature; this spec does not block on it. When history exists on mobile, web SHOULD place it in the same spot under Prices in a follow-up.
- **Name click inspects; it does not add.** Search and pickers keep a distinct add control so a mid-trade search stays fast.
- **Add to trade is balancer-only and always Want.** The modal does not start or update a trade from set, Binder, Want List, shared Binder, or history. Those pages may keep their own existing add controls. On the balancer, **Add to trade** matches mobile: Want side, not Have.
- **Successful adds leave the modal open** with a brief confirmation, matching mobile staying on card details.
- **Thumbnails open the same modal as names.** Today’s art-only zoom overlay is replaced; enlarged art lives inside the detail modal.
- **Web Binder / Want List mutations still follow existing web account rules** (those pages already require sign-in). Inspect does not. This spec does not add a signed-out local Binder on web.
- **One brand, native surface.** Layout and controls are web-native (dialog, close, focus) but the information architecture matches mobile: identity, then Prices, then actions. Do not rename Printing, Binder, Want List, or Prices.
- **No backfill, no invented prices, no condition-adjusted values.**
- **Mobile is unchanged** except insofar as both clients already share the catalog.

## Out of Scope

- A standalone public card encyclopedia / SEO card page as the v1 inspect path.
- Porting scan, lends, or Trade Filler to web.
- Binder / Want List value-over-time or portfolio charts.
- Price history chart (separate spec); user-entered sold prices.
- Changing how Confirm Trade, free-tier caps, or entitlements work.
- Requiring an account to look at a card.
- Making name-click add a card to a pile.
- Keeping a separate art-only zoom overlay as a competing inspect path.
