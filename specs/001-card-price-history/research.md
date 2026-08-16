# Research: Card Price History

Mobile decisions from 2026-08-14 still hold for the Flutter app. This pass records what changes now that **web is in scope**.

## Decision: Reuse `fab_price_history`; do not migrate or backfill

**Rationale**: The table already stores one row per Printing per day (`card_id`, `captured_on`, `tcg_low`, `tcg_market`, `cm_low`, `cm_trend`) with uniqueness on `(card_id, captured_on)` and public SELECT RLS. Nightly ingest in `services/price-pipeline` upserts today’s snapshot. The product promise is “no depth we do not have”; inventing a backfill would violate constitution V.

**Alternatives considered**:
- New RPC that returns a clipped Low series — extra surface for a query the client can already run.
- Materialized “last 30 days” table — gold-plating; one printing’s history is small.
- Enabling CardMarket ingest in this feature — separate operator decision; `ENABLE_CARDMARKET` stays false.

## Decision: Fetch the full series for the Printing; clip on the client

**Rationale**: Free and Pro both need to know whether snapshots older than 30 days exist (mobile CTA; web and mobile Pro span control). One `eq('card_id')` ordered by `captured_on` is enough. A printing’s daily rows stay in the hundreds even after years. Catalog history is public read; the 30-day cap is a product window, not a secrecy control.

Web has no `priceHistory` yet. Add it next to the other public catalog reads in `fabDb.js` (`restGet`), not through the auth `supabase-js` client. Same query as mobile `CardRepository.priceHistory`. Do not bake history into the catalog snapshot — that file is already large, and history is per-Printing on demand.

**Alternatives considered**:
- Two queries (30-day page + `exists` older) — more failure modes for no measurable gain.
- Server-side entitlement check before returning older rows — catalog prices are already public.
- Caching history in the web catalog snapshot or localStorage — skip until it hurts; the spec’s failure/retry state covers a missed fetch.
- Using `supabase.from('fab_price_history')` on web — splits catalog reads across two clients; `fabDb.js` is the existing public-read path.

## Decision: Shared golden fixture for Low-series math

**Rationale**: Constitution IV: when JavaScript and Dart implement the same rule, `packages/contracts` is the source of truth. The 30-day clip, Low extraction, gap handling, `hasOlder`, `chartable`, and visible-window `delta` are now on both clients.

Fixture: `packages/contracts/price_history_series.json`. Both suites assert the same cases. Schema: [contracts/price-history-series.md](./contracts/price-history-series.md).

**Not in the fixture** (surface-specific):
- Mobile “See full history with Pro” (`showProCta`)
- Inspect gesture (tap/hold vs hover/tap)
- Chart library vs SVG
- Change-summary currency formatting (each client already has a price formatter)

Pro span chrome (`isPro && hasOlder && chartable`) is the same boolean on both surfaces; derive it in each helper, and cover it in widget tests rather than duplicating CTA-style flags in the fixture.

**Alternatives considered**:
- Keep math mobile-only and re-implement JS from comments — the situation the contracts package exists to prevent.
- Put CTA flags in the fixture — web must never show that control; a shared `showProCta: true` would be a lying contract.

## Decision: Pure series helper per client (not widget-owned math)

**Rationale**: FR-004/011/012/015 are rules. Dart already has `price_history_series.dart`. Web gets `apps/web/src/utils/priceHistorySeries.js` with the same inputs (`snapshots`, `source`, `isPro`, `window`, `now`) and the same derived fields. Jest can assert the fixture without rendering SVG.

Rules to encode (both languages):
- Low field is `tcg_low` / `tcgLow` or `cm_low` / `cmLow` from the selected marketplace. Never Market/Trend/Mid/High. Never fall back to the other marketplace.
- Drop snapshots whose Low is null (gap). Do not coerce to 0.
- Default window: `captured_on` date ≥ (today’s calendar date − 29 days), inclusive 30 days. Compare **date-only** (`YYYY-MM-DD`), never a UTC midnight `Date` that can shift the day.
- Change summary numeric: last visible Low − first visible Low.
- `hasOlder`: any usable Low with `captured_on` before the window start.
- Chartable iff visible usable Lows ≥ 2.

Web helper MUST NOT expose a Pro CTA flag (or it is always false). Mobile keeps `showProCta` for the existing UI.

**Alternatives considered**: Computing inside `PriceHistorySection` — untestable without pointer events. A shared npm/Dart package — the runtimes cannot share code; fixtures are the DRY we actually have.

## Decision: Web chart is a small SVG line, not a new library

**Rationale**: Constitution I. The spec needs one straight Low line, observed points only, hover/tap inspect, no pinch-zoom. The DOM already gives pointer events and a positioned readout. `@mui/x-charts` / `recharts` would pay for themselves on a dashboard, not on one overlay sparkline. Mobile needed `fl_chart` because Flutter has no equivalent hover tooltip; that reason does not apply on web.

Chart rules (same as mobile, different renderer):
- Exactly one polyline. Linear segments — a curve would draw prices the catalog never observed.
- Spots are observed Lows only. Missing days are omitted, not plotted at y=0. Segments between observed days are connectors, not daily interpolations.
- Y-axis auto-fits the visible Lows with padding; do not force a 0 baseline.
- Hover (pointer) or tap (touch) on the chart snaps to the nearest observed point and shows that day’s date and formatted Low. Never `$0.00` / `€0.00` for a gap.
- Inspect does not close the overlay or navigate.
- No pinch-zoom / pan on the default view.

**Alternatives considered**:
- `@mui/x-charts` LineChart — MIT, tooltip built-in, extra package and curve defaults to babysit. Zoom is a paid add-on we do not want.
- `recharts` — fine tooltips, still a new dependency for one line.
- Sparkline-only packages — weak per-point inspect.

## Decision: No upgrade CTA on web; Pro span control still yes

**Rationale**: Spec FR-013 (2026-08-16). Web has no in-app purchase. Existing Pro-limit copy elsewhere says “Subscribe in the FABTrades app”; this section does not even show that. Free/signed-out: 30 days, no unlock prompt. Pro (`useEntitlement().isPro`): default 30 days, control to switch to full span when `hasOlder`. Do not persist the span choice (same as mobile).

**Alternatives considered**:
- Quiet “See full history with Pro” that points at the app — user chose no CTA.
- Stripe / web billing in this feature — gold-plating.
- Hiding history from free web players — out of scope.

## Decision: Follow `PriceContext.priceSource`; do not add a marketplace picker

**Rationale**: Spec: one Low line for the selected marketplace, even though the overlay Prices box lists both. Web already has `priceSource` (`tcgplayer` | `cardmarket`), default `tcgplayer`. There is currently no UI that calls `setPriceSource`; the chart still keys off that value so a future toggle does not fork the rule. Changing source recomputes from the same snapshots (no refetch). CardMarket with null `cm_low` → empty copy that names the marketplace.

**Alternatives considered**: Always TCG Low on web — would ignore the spec if CardMarket is selected. Two lines — forbidden. A picker inside the history section — extra surface; Prices already shows both current numbers.

## Decision: Fetch keyed by overlay Printing; abort on switch / close

**Rationale**: US2 / SC-004. Overlay selection is `shown._uniqueId` (`fab_cards.id`). When it changes, drop the previous line. `AbortController` (or an ignore-stale flag) so a slow prior fetch cannot paint the wrong Printing. Do not fetch when the overlay is closed. Retry refetches the current id only.

**Alternatives considered**: Screen-local fetch without cancellation — leftover points. Caching provider keyed only by id with no abort — same race on fast Version taps.

## Decision: Do not persist the Pro span choice

**Rationale**: Spec defaults everyone, including Pro, to 30 days on open. Overlay-local state is enough. Closing the overlay resets it. Persisting “all time” across Printings or visits would surprise the table glance.

## Decision: Minimal analytics

**Rationale**: Overlay already exists; do not log every tooltip inspect. Optional later: `price_history_span_changed` when Pro toggles span. No `paywall_shown` from this web section (there is no CTA).

## Open facts (resolved, not NEEDS CLARIFICATION)

| Topic | Resolution |
| --- | --- |
| Mobile placement | Immediately after `_PriceCard` in `card_detail_screen.dart` (shipped). |
| Web placement | Immediately after `CardDetailPrices` in `CardDetailModal.jsx`, before Add to trade / Want List. |
| Printing identity | Mobile `card.id` / web `_uniqueId` — both `fab_cards.id` (`<product_id>-<subtype>`). |
| Marketplace | Mobile `AppSettings.source`. Web `PriceContext.priceSource` (default `tcgplayer`). |
| Pro check | Mobile `isProProvider`. Web `useEntitlement().isPro`. Signed-out ⇒ false. |
| Current prices | Stay on the catalog Printing. History fetch does not replace them. |
| Web CTA | None. |
| Web inspect | Hover (pointer) and tap (touch). |
| Pipeline | Unchanged. |
