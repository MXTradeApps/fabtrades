# Contract: Binder value entry points

The Binder **total control** is the only v1 entry. Card names still open card details (existing), not this overlay.

## In scope

| Surface | Control | When shown | Action |
| --- | --- | --- | --- |
| Mobile Binder tab | Green Binder-value chip (`_BinderValueChip`) | Binder tab selected **and** Binder non-empty | Opens Binder-value overlay |
| Web `/binder` | Header Binder total (the formatted currency next to Share) | Owner Binder page with entries loaded | Opens Binder-value overlay |

The control MUST be a button (or equivalent): activatable, not dead text. It MUST NOT add/remove cards.

## Out of scope (must not open this overlay)

| Surface | Why |
| --- | --- |
| Mobile Want List tab | Spec: Binder-tab only |
| Web `/wants` | Same page component, `isWanted`; total stays non-activatable for this feature |
| Web `/b/:token` shared Binder | Not the owner’s inspect in v1 |
| Lend screen totals | Different pile |
| Trade balancer side totals | Different feature |
| Card detail Prices | Per-Printing, already exists |

## Empty and missing

- Zero Binder rows: hide the total control; do not present a disabled modal affordance that opens empty.
- Web signed-out `/binder`: existing sign-in gate for the page stays; this feature does not invent a local Binder.

## Onboarding

Mobile tour already highlights the green total. After the tour, that chip MUST still open this overlay. Tour body copy MAY mention the tap; not required to ship the overlay.
