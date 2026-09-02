# Contract: Collection Stats entry points

The **Collection Stats** button on a non-empty owner Binder is the only v1 entry. Card names still open card details, not this page. Catalog-wide movers stay on Home / Trends and MUST NOT deep-link into Collection Stats.

## In scope

| Surface | Control | When shown | Action |
| --- | --- | --- | --- |
| Mobile Binder tab | Button labeled **Collection Stats** (replaces `_BinderValueChip`) | Binder tab selected **and** open Binder non-empty | Pushes Collection Stats page for that Binder |
| Web `/binder` | Button labeled **Collection Stats** (replaces `data-testid="binder-value-total"`) | Owner Binder page, not the Binder grid-only chrome if no open list, entries.length > 0 | Navigates to `/binder/stats` |

The control MUST be a button (or equivalent): activatable, not dead text. Visible text and accessible name MUST be **Collection Stats**. It MUST NOT display a currency amount. It MUST NOT add/remove cards.

The Binder screen MUST NOT show a running Binder total anywhere else (app bar, FAB row, subtitle).

## Out of scope (must not open Collection Stats)

| Surface | Why |
| --- | --- |
| Mobile Want List tab | Spec: Binder only |
| Web `/wants` | Same page component, `isWanted` |
| Web `/b/:token` shared Binder | Not the owner’s inspect in v1 |
| Web hamburger | No Collection / Collection Stats item that bypasses Binder |
| Mobile tab bar | Not a fifth tab |
| Lend / trade side totals | Different pile |
| Home / Trends mover rows | Catalog-wide; open card details, not Binder stats |
| Deleted Binder-value overlay | Must not remain reachable |

## Empty and missing

- Zero Binder rows: hide the button; do not present a disabled stats affordance.
- Web signed-out `/binder`: existing sign-in gate for the page stays; this feature does not invent a local Binder. `/binder/stats` uses the same gate.
- Direct `/binder/stats` with an empty open Binder: send the player back to `/binder` rather than a dead empty stats landing.

## Onboarding

Mobile tour key `OnboardingKeys.binderTotal` MAY stay (do not reset completed tours). Title/body MUST describe Collection Stats, not a green running total or overlay. After the tour, that control MUST open the Collection Stats page.

## Removed controls

| Surface | Removed |
| --- | --- |
| Mobile | `_BinderValueChip` total text; `showBinderValueSheet` |
| Web | Header total `binder-value-total`; `BinderValueDialog` / `valueOpen` |
