# Research: Web Card Detail Modal

## Decision: One app-shell modal + `CardDetailProvider`, not a new route

**Rationale**: Spec v1 forbids a standalone card page. `App.jsx` already wraps routes in `AuthProvider`. Mounting `CardDetailProvider` inside `Router` lets any page call `openDetail(printing)` and lets the modal use `useLocation()` for balancer-only **Add to trade**. One instance prevents stacked dialogs (US2.5).

**Alternatives considered**:
- Per-page `CardImageModal`-style local state — would fork seven copies and violate FR-013.
- `/cards/:id` route — out of scope; would replace the page behind the player.
- Hash URLs (`#card=`) — extra back-button complexity; spec says shareable URL is not required.

## Decision: Home registers `addWantCard`; do not lift `useTradeState` to App

**Rationale**: Clarification: **Add to trade** only when the balancer is the page behind the modal, always onto Want. `useTradeState` already lives in `Home.jsx`. The provider exposes `registerAddWant(fn)` / `addWantCard` that Home sets on mount and clears on unmount. Modal shows the button iff `pathname === '/'` and the callback is present. Off-Home pages never start a trade from the modal (shared Binder keeps its own on-page control).

**Alternatives considered**:
- Lift all trade state to App — larger refactor than the feature.
- `addCardToTradeDraft` from set/Binder — explicitly rejected in clarification C.
- Always-visible Add that navigates to `/` — rejected in clarification B.

## Decision: Replace list `CardImageModal` with `openDetail`; keep zoom inside the detail dialog

**Rationale**: Clarification: thumbnail opens the same modal; no competing art-only overlay. Call sites today: `CardList.jsx`, `SetDetail.jsx`, `BinderCollection.jsx`, `SharedBinder.jsx`. `SearchOption` and `TradeHistory` thumbs have no click yet — they gain `openDetail`. `CardImageModal` remains as the **in-modal** zoom (tap art in the dialog), so players who used thumbnail → big art still get zoom without a second inspect path from lists.

**Alternatives considered**:
- Keep list art-only zoom alongside details — two inspect paths (rejected).
- Custom lightbox from scratch — `CardImageModal` already does fade + fallback URL.

## Decision: Split search name/thumb from add; row add stays

**Rationale**: FR-008. Today `SearchOption`’s entire row calls `onSelect` → `addHaveCard` / `addWantCard`. Name and thumbnail `stopPropagation` + `openDetail`. A remaining hit target (row chrome or an explicit add control) still selects. Autocomplete keyboard-enter can keep current add behavior so mid-trade typing stays fast.

**Alternatives considered**:
- Whole row opens details — would break “type and pick to add.”
- Name opens details and also adds — forbidden by FR-008.

## Decision: Map `cm_*` through the catalog read path; display unpriced as —

**Rationale**: FR-005 requires both marketplace groups. `fabDb.js` `CARD_COLUMNS` currently omits CardMarket. `fab_cards_with_prices` already has `cm_avg`, `cm_low`, `cm_trend` and foil variants; FAB ingest leaves them null (`ENABLE_CARDMARKET = false`). Mapping them through is a small select/mapper change so the modal can render the CM group honestly. `formatPrice` already maps `null` / `0` → `—` (`searchUtils.js`). Do not coerce missing CM to TCG.

**Alternatives considered**:
- Live-fetch one printing’s prices on open — extra request; catalog is already in memory.
- Hide the CM group until ingest is on — weaker parity with mobile’s always-visible groups.
- Enable CardMarket ingest — operator/pipeline scope, not this feature.

## Decision: Web `printingsForCard` helper; do not add a contracts fixture in v1

**Rationale**: Versions must follow the Printing, including reprints grouped by set + finish (US3). Web’s `groupCardsByEdition` keys on `displayName` (name + subtype), which is the wrong grain for “all finishes of this card.” Add `utils/printingsForCard.js` over the in-memory `cards` list: siblings share the same catalog `name` (and, when useful, the existing edition group). Unit-test with real-shaped fixtures. Mobile’s `baseCardName` stripping is richer; unifying that heuristic across Dart/JS is a named follow-up, not a v1 gate (principle I).

**Alternatives considered**:
- Reuse `cardGroups` only — misses cross-set reprints that do not share `displayName`.
- Port full `baseCardName` + `packages/contracts` cases now — extra surface for a first web modal.
- Versions omitted in v1 — would ship a lying Prices box on foil vs Normal.

## Decision: Want List via existing `upsertEntry`; Own N only when signed in

**Rationale**: Web Binder/Want already require an account. Modal calls `upsertEntry` after `canAddDistinctCard` / existing limit UI; signed-out opens `SignInDialog` (no fake local Binder). Own quantity is `entries.find(e => e.cardId === printing._uniqueId)` when `user` exists; omit the badge signed out. Confirmation: existing `Snackbar` + `Alert` (3s, bottom center). Modal stays open (clarification).

**Alternatives considered**:
- Signed-out local Binder on web — spec forbids inventing it.
- Close modal on add — rejected.

## Decision: No new network on open

**Rationale**: SC-007 / table deadline. The printing is already a catalog object (or look up `_uniqueId` / `cardIdLookup` from history stubs). Binder qty is the only extra read, and only when signed in — same data Binder pages already load; cache/reuse if the page has entries, otherwise a single `getBinderEntries` that must not block Prices.

**Alternatives considered**: Always refetch the printing from Supabase — slower, can drift from the snapshot the rest of the page uses.

## Open facts (resolved)

| Topic | Resolution |
| --- | --- |
| Printing key | `_uniqueId` (`<product_id>-<subtype>`) |
| Balancer detection | `useLocation().pathname === '/'` |
| Trade add API | `addWantCard({ label, card })` |
| Price dash | `formatPrice` / equivalent; never `$0.00` |
| History / shared stubs | Resolve to catalog printing via `cardIdLookup` when possible; if no Printing identity, name is not a details control (FR-002/US2.4) |
