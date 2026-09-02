# Research: Binder Collection Stats

## Decision: New page, not the Binder-value overlay

**Rationale**: Spec FR-002 / clarification 2026-08-26. Collection Stats is a destination the player navigates to and leaves, not a sheet/dialog over the Binder list. Mobile: `Navigator.push` a `CollectionStatsScreen` from the Binder tab (tab bar stays; this is not a fifth tab). Web: `/binder/stats`, reached only from `/binder`, not listed in the hamburger (FR: no Collection hamburger destination that bypasses Binder). Back/`/`-style browser back returns to the same Binder.

The existing overlay (`showBinderValueSheet` / `BinderValueDialog`) is removed on both surfaces, including leftover `valueOpen` state and tests. Snapshot **content** moves onto the page so marketplace totals are not stranded.

**Alternatives considered**:

- Keep the modal and add movers inside it — contradicts “new page” and leaves two inspect surfaces.
- Keep the modal on web only — per-surface divergence, rejected in clarification.
- Hamburger “Collection Stats” — bypasses Binder; forbidden.
- Nested Binder tab with no stack — cannot restore scroll context as cleanly as a push/route.

## Decision: Reuse `binder_value_snapshot`; headline uses the chosen price source

**Rationale**: US3 is the 003 snapshot (four field totals, counts, unpriced, top five). That math already has a dual-client helper and `binder_value_snapshot.json`. Do not fork it.

003 left the **headline** as “whatever the chip showed.” The chip is going away. Spec FR-004 says current total value uses the player's **chosen price source**. Collection Stats headline is therefore `pricingValue` on both surfaces (`Pricing.value` / the same fallback chain mobile already used), not web’s historical TCG-Market-only header sum. Web’s header total is deleted with the control, so there is no chip left to match.

Field totals stay honest observed Market/Low/Trend sums (unpriced omitted, never zero). Top five still rank by contribution to that chosen-source headline.

**Alternatives considered**:

- Keep web headline as TCG Market only — contradicts FR-004 now that the header total is gone.
- New snapshot fixture for Collection Stats — same rules; extra goldens violate constitution I.
- Recompute totals in the page widget — guaranteed drift from `BinderValueDialog`.

## Decision: Binder movers call existing `fab_recent_movers` with this Binder's ids

**Rationale**: Ranking, window, floor, outlier caps, and 10-per-side already live in SQL and `recent_movers.json`. Clarification: percent sort, copies do not affect rank. Collection Stats MUST NOT invent a second gainer definition.

Call the same RPC both clients already have:

```text
fab_recent_movers(p_source, p_card_ids)
```

`p_card_ids` = distinct Printing ids in the **open Binder** with quantity > 0 (not Want List, not tombstones, not other Binders). Empty id list → do not call (page still shows headline + snapshot; movers empty copy). Two Binders holding the same Printing: only this Binder's copies count for **eligibility**; the Printing appears here iff it is in this Binder.

Quantity is **not** in the RPC row. The page joins `card_id → quantity` from the open Binder when rendering the row (FR-008 copies). If two condition rows exist for one Printing in this Binder, show the summed quantity; rank is still once (RPC already unique by `card_id`).

Home/Trends **stop** passing all-Binder `ownedPrintingIds`. `ownedPrintingIds(entries)` stays the unique-id helper; Collection Stats filters entries to the open Binder first, then calls it. Do not change the helper to take a binder id unless a fixture case requires it — filtering the input list is enough and keeps `recent_movers.json` owned-id cases honest for “qty > 0, not Want List.”

**Alternatives considered**:

- New `fab_binder_movers` RPC — duplicate ranker; constitution I.
- Rank copies × amount on the client — rejected in clarification.
- Keep all-Binder owned list on Home and add per-Binder here — rejected in clarification.
- Per-Printing `priceHistory()` for each Binder card — extra round-trips; RPC already accepts ids.

## Decision: Collection Stats button is label-only; Binder screen has no running total

**Rationale**: Clarification B. Replace `_BinderValueChip` / web `binder-value-total` with a control whose accessible name and visible text are **Collection Stats**. Do not put `formatValue` / `formatCurrency(totalValue)` on the button or in the Binder app bar. Empty Binder and Want List: no button (same hide rule as the old total). Add-card FAB stays.

Mobile onboarding: keep `OnboardingKeys.binderTotal` (changing the key would re-fire the tour for existing users). Rewrite `TourCopy.binderTotalTitle` / `binderTotalBody` to Collection Stats. After the tour, that control MUST open the page, not a deleted sheet.

**Alternatives considered**:

- “Collection Stats · $412” on the button — rejected in clarification.
- Move the total into the Binder app bar — second value surface; rejected.

## Decision: Delete owned movers from the movers landing

**Rationale**: Clarification A / FR-013. `RecentMoversSection` on mobile Home and web Trends becomes catalog-wide only: one `recentMovers(source)` call, no owned fetch, no owned empty state, no owned teaser. `search_screen.dart` / `Trends.jsx` stop computing `ownedPrintingIds` for that landing.

Tests that assert owned-first / owned-hide / owned-empty on Home/Trends must flip to “catalog-wide only in every Binder state.” Catalog-wide movers, catalog search, and (mobile) set list below movers stay.

**Alternatives considered**: Hidden owned section — still a surface; spec says removed, not hidden. Teaser linking to Collection Stats — rejected in clarification.

## Decision: No value-over-time storage or chart

**Rationale**: Clarification: trend is not valuable. FR-006 forbids a Binder total series, sparkline, or period-change figure. Do not reconstruct past totals from `fab_price_history` × today's quantities, and do not write daily Binder snapshots. Per-Printing history remains on card details (001).

**Alternatives considered**: Reconstruct vs snapshot — both rejected when the trend itself was dropped.

## Decision: Web `/binder/stats` uses the same open-Binder session as `/binder`

**Rationale**: Collection Stats is scoped to the Binder that was open when the player activated the button (FR-005). Web already has module state `getOpenBinderId()` / `setOpenBinderId`. The stats page reads that id plus `getBinderEntries` filtered to it (and live catalog), same as the Binder list. Direct load of `/binder/stats` with no open Binder: treat as Trade Binder if that is the `/binder` default, matching `targetOwnedBinderId()`. Empty Binder: redirect or send the player back to `/binder` (no dead empty stats as a primary landing). Signed-out: same gate as `/binder` (do not invent a local web Binder).

Do not put `/binder/stats` in `Header.jsx`. Do not add it to `generateSeoPages.js`.

**Alternatives considered**: `/binder/:id/stats` in the URL — extra routing; open-Binder session already exists. Query `?binder=` — easy to desync from the grid. Render stats as a BinderCollection view flag — harder to prove “new page” in tests and back-stack.
