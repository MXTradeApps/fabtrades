# Contract: Free limits (multi-Binder)

Extends `packages/contracts/free_limits.json`. Implementations: `freeLimits.js` / `free_limits.dart`. Both suites MUST assert the JSON.

## Limits (free)

| Key | Cap | Count | Behaviour |
| --- | --- | --- | --- |
| `binderCards` | 50 | Distinct owned `card_id` **across all live Binders** (not per Binder, not Want List) | `refuse` new distinct add |
| `binders` | 4 | Live Binder records (Trade Binder and Collection count) | `paywall` — show Pro upgrade; create nothing |
| `wantListCards` | 50 | Unchanged | `refuse` |

Pro removes all of them (existing rule).

## binderCards

- Qty-up on an owned Printing already in **any** Binder: not capped.
- Add of a Printing that exists only on Want List: counts as a new **owned** distinct card.
- Move between Binders: not capped (count unchanged).
- Confirm Trade add into Trade Binder: still never blocked by this cap (existing confirm-trade exception).

Fixture cases: keep the fiftieth/fifty-first owned-card cases; add a case that 50 distinct split across Trade Binder + Collection still refuses a 51st; add a case that moving among those 50 is allowed.

## binders

- Live count includes empty Trade Binder and empty Collection.
- Tombestoned Collection does not count; player may create another Binder (including named Collection) if under 4.
- Case: 3 live Binders → create allowed; 4 live → create forbidden for free, allowed for Pro.

`behaviour.binders = "paywall"` means the create UI presents the Pro upgrade. It does not write entitlements. After a successful Pro purchase, retry create.

Do not use `paywall` for `binderCards` in this feature (keep `refuse`).
