# Research: Card Price History

## Decision: Reuse `fab_price_history`; do not migrate or backfill

**Rationale**: The table already stores one row per Printing per day (`card_id`, `captured_on`, `tcg_low`, `tcg_market`, `cm_low`, `cm_trend`) with uniqueness on `(card_id, captured_on)` and public SELECT RLS. Nightly ingest in `services/price-pipeline` upserts today’s snapshot. The product promise is “no depth we do not have”; inventing a backfill would violate constitution V.

**Alternatives considered**:
- New RPC that returns a clipped Low series — extra surface for a query the client can already run.
- Materialized “last 30 days” table — gold-plating; one printing’s history is small.
- Enabling CardMarket ingest in this feature — separate operator decision; `ENABLE_CARDMARKET` stays false.

## Decision: Fetch the full series for the Printing; clip on device

**Rationale**: Free and Pro both need to know whether snapshots older than 30 days exist (CTA vs full-span control). One `eq('card_id')` ordered by `captured_on` already exists as `CardRepository.priceHistory`. A printing’s daily rows stay in the hundreds even after years. Catalog history is public read; the 30-day cap is a product window, not a secrecy control.

**Alternatives considered**:
- Two queries (30-day page + `exists` older) — more failure modes for no measurable gain.
- Server-side entitlement check before returning older rows — catalog prices are already public; adding auth to a public table would be a new product decision, not this feature.
- Caching history in SharedPreferences next to the catalog — helps offline, but current prices already work offline and the spec’s failure/retry state covers a missed fetch. Skip until it hurts.

## Decision: Riverpod `FutureProvider.family` keyed by Printing `card.id`

**Rationale**: Switching Versions must drop the previous line (US2, SC-004). A family keyed by `card.id` cancels/replaces in-flight work when `_selected` changes. `AsyncValue` maps cleanly onto loading / data / error without blocking the Prices box.

**Alternatives considered**:
- Screen-local `Future` in `setState` — races on fast Version taps; harder to invalidate on retry.
- Caching provider with no family — leftover points from the previous Printing.

## Decision: Pure Dart Low-series helper (not widget-owned math)

**Rationale**: FR-004/011/012/013/015 are rules: which field is Low, how the window clips, how the delta is computed, when chrome appears. Putting that in `core/logic/price_history_series.dart` lets `flutter test` use real `PricePoint` lists (constitution IV) without pumping a chart.

Rules to encode:
- Low field is `tcgLow` or `cmLow` from `PriceSource`. Never Market/Trend/Mid/High. Never fall back to the other marketplace.
- Drop snapshots whose Low is null (gap). Do not coerce to 0.0.
- Default window: `captured_on` date ≥ (today’s calendar date − 29 days), inclusive 30 days. Compare date-only to avoid timezone drift on `DateTime.parse` of a `date` column.
- Change summary: last visible Low − first visible Low (amount, sign, formatted via `Pricing`).
- `hasOlderUsableLow`: any usable Low with `captured_on` before the window start.
- Chartable iff visible usable Lows ≥ 2.
- Upgrade line: `!isPro && hasOlderUsableLow && chartable`.
- Pro span control: `isPro && hasOlderUsableLow && chartable`.
- Empty / loading / error: no upgrade line, no span control.

**Alternatives considered**: Computing inside the widget — untestable without `fl_chart`. Putting 30 in `packages/contracts` — web has no second implementation (contracts README: mobile-only rules stay out).

## Decision: Add `fl_chart` ^1.2.0 for one Low line and tap/hold inspect

**Rationale**: The app has no charting library. `fl_chart` 1.2.0 supports `LineChart` + `LineTouchData` tooltips (tap and long-press) and Dart 3.6+, which this SDK satisfies. One new dependency is cheaper than a custom `CustomPainter` that still needs inspect UX.

Chart rules:
- Exactly one `LineChartBarData`. `isCurved: false` — a bezier would draw prices the catalog never observed.
- Spots are observed Lows only. Missing days are omitted, not plotted at y=0. Line segments between observed days are connectors, not daily interpolations.
- Y-axis auto-fits the visible Lows with padding; do not force a 0 baseline (that would squash a $4–$5 card and imply $0 is a real Low).
- Tooltip shows that spot’s date and formatted Low. Touching between spots snaps to the nearest observed spot (library default) — matches the spec’s “snap or no readout,” never `$0.00`.
- No pinch-zoom / pan on the default view.

**Alternatives considered**:
- `syncfusion_flutter_charts` — heavier, commercial license.
- Sparkline-only packages — weak or no per-point inspect.
- Custom painter — more code for a worse tooltip.

## Decision: Quiet Pro CTA, not `ProGate`

**Rationale**: `ProGate` replaces `child` with an unlock card. The spec forbids hiding or walling the 30-day chart. Call `presentProPaywall(context, ref, trigger: 'price_history')` from a text control under the chart. After purchase, `isProProvider` rebuilds: CTA disappears, 30-day default remains, span control appears if older snapshots exist.

**Alternatives considered**: Wrapping the chart in `ProGate` (the comment in `pro_gate.dart` even names `PriceHistoryChart`) — would violate FR-013. A faded overlay — explicitly out of scope.

## Decision: CardMarket selected + null `cm_low` history → empty state

**Rationale**: FR-004 forbids substituting TCG Low or Market. FAB ingest currently writes `cm_*` as null. The empty copy should say history isn’t available for this marketplace yet, not that the Printing is unpriced in general, so a player who switches back to TCGplayer still sees TCG history.

**Alternatives considered**: Falling back to TCG Low “so the chart isn’t empty” — silent lie. Enabling CardMarket ingest here — out of scope.

## Decision: Do not persist the Pro span choice

**Rationale**: Spec defaults everyone, including Pro, to 30 days on open. Widget-local state is enough. Persisting “all time” across Printings or visits would surprise the table glance.

**Alternatives considered**: Settings flag — extra surface for a control that should reset per visit.

## Decision: Minimal analytics, existing wrapper

**Rationale**: Card details already capture `card_detail_viewed` / `card_printing_switched`. Add `paywall_shown` via the existing `trigger` on `presentProPaywall`. Optional: `price_history_span_changed` with `{span: '30d'|'full', card_id}` when Pro toggles. Do not log every tooltip inspect.

## Open facts (resolved, not NEEDS CLARIFICATION)

| Topic | Resolution |
| --- | --- |
| Placement | Immediately after `_PriceCard` in `card_detail_screen.dart` ListView (~line 127). |
| Printing identity | `_selected.id` (`<product_id>-<subtype>`). |
| Marketplace | `settingsProvider` → `AppSettings.source`. |
| Pro check | `isProProvider` only. |
| Current prices | Stay on `CardModel`; history fetch does not replace them. |
| Web | Out of scope. |
| Pipeline | Unchanged. |
