# Research: Binder Value Detail

## Decision: One pure snapshot helper, two native overlays

**Rationale**: Spec FR-013 requires the same numbers and vocabulary on mobile and web. The runtimes cannot share code (constitution Dual-client DRY), so the math lives in a named helper on each side (`binderValueSnapshot` / `BinderValueSnapshot`) held to one golden fixture. Each surface opens a native overlay from its existing Binder total (mobile bottom sheet, web dialog). No new route, table, or fetch.

**Alternatives considered**:
- Port only mobile — violates one-brand / FR-013.
- New Binder “portfolio” page — leaves the Binder behind; misses the table deadline.
- Compute totals independently in each widget — guaranteed drift on unpriced, foil CardMarket, and top-five ties.

## Decision: Headline is the Binder total already on screen

**Rationale**: SC-007: the modal headline must match the green (or web) total the player just activated. Spec explicitly leaves chip math unchanged. Today those formulas already differ slightly:

| Surface | Binder total control | Formula |
| --- | --- | --- |
| Mobile green chip | Shown when Binder tab is non-empty | `sum((Pricing.value(card) ?? 0) * qty)` — Settings source, with market→low→mid→high (TCG) or trend→avg→low (CardMarket) fallbacks |
| Web Binder header | `/binder` total, not Want List | `sum((live.marketPrice \|\| stub.tcgMarket \|\| 0) * qty)` — always TCGplayer Market; `0` for missing |

The overlay **displays that same formatted number** as **Binder value**. It does not recompute a third headline. Marketplace rows are independent honest field sums (Decision: field totals below). A printing with only a Low can raise TCG Low without changing a web header that only sums Market — that is the point of the breakdown.

**Alternatives considered**:
- Retarget web’s header to `Pricing.value` in this change — out of scope (“do not change how the green chip is calculated”).
- Recompute headline with field-only TCG Market on both surfaces — would disagree with the mobile chip when Settings is CardMarket or when `value()` fell back to Low.

## Decision: Four marketplace totals are observed field sums; unpriced is omitted, never zero

**Rationale**: FR-004–FR-006 and constitution V / “real prices or nothing.” Each total is `sum(qty * field)` over copies where that field is priced. A copy missing the field is omitted and counted in that field’s unpriced copies. Display uses the same unpriced glyph as card details (`—`), never `$0.00` / `€0.00`.

Priced vs unpriced (same rule as web `formatCatalogPrice` / mobile null Low): `null`, missing, `NaN`, and **numeric `0`** are unpriced. Ingest stores unpriced as null; web catalog rows still sometimes coerce missing TCG numbers to `0`.

CardMarket Trend/Low are **foil-aware**, matching card details and `Pricing.lowValue`: if the Printing is foil and the foil field is priced, use it; otherwise use the non-foil field. Do not fall back to the other marketplace. Do not fold CardMarket Avg or TCG Mid/High/Direct into these four rows (out of scope).

When every copy is unpriced for a field, that total is unpriced (`amount` null) plus the copy count — not `0`.

**Alternatives considered**:
- Reuse `Pricing.value` for “TCG Market” — that is a fallback chain, not Market. The modal would lie when Market is missing and Low exists.
- Treat missing as `$0` so sums always match the chip — forbidden by FR-006 and the constitution.
- Hide CardMarket until ingest fills `cm_*` — weaker than card details, which always show the group as unpriced.

## Decision: `packages/contracts/binder_value_snapshot.json` is the source of truth

**Rationale**: Constitution IV: the same rule in JS and Dart must share a fixture. Cases cover quantity weighting, foil CardMarket, null/0 omission, empty Binder (helper still defined; UI will not open), all-unpriced marketplace, top-five cap, and stable ties (contribution desc, then name, then printing id).

The fixture asserts snapshot **math**, not overlay chrome (bottom sheet vs dialog, green vs muted total).

**Alternatives considered**:
- Widget tests only — two UIs could still disagree on foil Low.
- A shared npm/Dart package — fake monorepo runtime; constitution forbids it.

## Decision: Top five uses the same per-copy value as that surface’s Binder total

**Rationale**: US3 / FR-010: rank by contribution to the headline Binder value. Contribution = `qty * sourceValue`, where `sourceValue` is the same per-printing number the Binder total already uses on that surface (mobile `Pricing.value`; web TCG Market). Unpriced-for-source printings are **not** listed (do not invent `$0` rows or pad to five). Ties: higher contribution first; then name A–Z; then printing id.

The helper takes `source` plus a `headlineValueFn` equivalent encoded in the fixture as `source` (`tcgplayer` | `cardmarket`) so both suites share fallback behavior for mobile, and web contract cases use `tcgplayer` Market-only contribution to match the web header. Two small case groups in one fixture (`headline: "pricingValue"` vs `headline: "tcgMarketOnly"`) keep the difference honest instead of papering over it.

**Alternatives considered**:
- Always rank by TCG Market — would ignore a CardMarket Settings user on mobile.
- Rank by whichever of the four fields is largest — not “the green total.”
- Full Binder resorted by price — out of scope.

## Decision: Native overlay, compute on open from in-memory Binder + catalog

**Rationale**: Table deadline and “local reads.” Binder rows and catalog prices are already on screen. Opening MUST NOT wait on a network round-trip. Mobile: `showModalBottomSheet` (scrollable, drag/back dismiss) — the Binder already uses sheets for add-options; a full-screen route would leave the list. Web: MUI `Dialog` like card detail (close, backdrop, Escape). One instance: activating the total while open does not stack.

Want List (`/wants`, Binder screen tab 1) and public shared Binder are not entry points.

**Alternatives considered**:
- Navigate to a stats screen — loses scroll/tab (FR-002).
- Live-fetch prices on open — slower and can drift from the list.
- Shared Binder breakdown — spec v1 out of scope.

## Decision: Do not change chip/header formula; do make it an obvious control

**Rationale**: Out of scope to retarget the total. In scope: the control is activatable (button semantics, ink/hover, does not look like dead text). Empty Binder: no control, no empty modal. Copy on the mobile tour MAY mention that the total opens details; not a blocker.

**Alternatives considered**: A second “Details” icon beside the total — extra chrome; the request is to click the green value itself.

## Open facts (resolved)

| Topic | Resolution |
| --- | --- |
| Printing key | Mobile `CardModel.id` / web `_uniqueId` (`<product_id>-<subtype>`) |
| Binder vs Want | Callers pass `!isWanted` rows only |
| Lent copies | Already in Binder entries; included |
| Condition | Ignored for all money fields |
| Currency | TCG USD, CardMarket EUR; no conversion |
| Unpriced glyph | `—` (same as Prices on card details) |
| Web signed-out | No Binder on web without account (existing); no fake local Binder |
| Mobile signed-out | Local Binder; inspect works |
