# Quickstart: Fabrary CSV Binder Import

Manual check that Binder Settings, preview, and add-on-top match [spec.md](./spec.md). Automated suites are the default; this is the table-side pass.

## Prerequisites

- A Fabrary collection export (the attached September 2026 file, or a trimmed fixture with Have on a few printings plus unmatched junk).
- Mobile: `apps/mobile` with catalog cached; Binders on device (signed out is fine).
- Web: signed-in owner on `/binder`; catalog snapshot loaded.
- Pro vs free: import is not capped. A real Fabrary dump (~3,800 owned printings) should preview and confirm with no Upgrade to Pro.
- No new migration.

## Automated

```bash
cd apps/web && npm test
cd apps/mobile && flutter test
```

Expect: `fabrary_printing_match.json` and `fabrary_import_apply.json` pass on both sides; Binder Settings entry/preview/cancel/confirm tests pass. Import suites must not expect Upgrade to Pro.

## Manual — entry

1. Open Collection. Open **Settings**. Confirm the page names Collection and offers **Import from Fabrary**.
2. From the Binder grid, Collection tile menu → **Settings**. Same page.
3. App-wide Settings: no Fabrary import.
4. Want List: no Binder Settings / import.
5. Trade Binder Settings: import is offered (and must not write Collection).

## Manual — preview

1. Pick a non-Fabrary file. Refuse; Binders unchanged.
2. Pick the real Fabrary export. Working state, then preview: owned count is Have>0 (~3,800 on the attached file), not ~17k rows.
3. Unmatched **names** are readable before confirm.
4. Copy says this will **add** (not replace). Cancel. Binder unchanged.

## Manual — confirm

1. Empty Collection. Confirm. Collection gains matched Have copies; Trade Binder unchanged; Want List unchanged.
2. Same file again. NM quantities increase by the same Have totals (SC-012).
3. A Printing you already had as LP only: LP row stays; a new NM row appears (or NM qty increases if NM existed).
4. Collection Stats / tile count match previous copies + imported Have.
5. Web ↔ mobile (signed in): after sync, the same Binder shows the same printings and quantities.

## Manual — no paywall

1. Account with 50+ distinct owned printings. Pick a valid Fabrary file. Preview appears; Upgrade to Pro is not shown; confirm adds copies.
2. Import of printings already owned. Allowed (quantities add on top).

## Expected outcomes

| Check | Pass |
| --- | --- |
| SC-001 | Settings → preview → confirm in under 2 minutes of player time |
| SC-002 / SC-003 | Copy count = previous + matched Have; blank Have adds nothing |
| SC-004 / SC-005 | Want/Extra unused; other Binders + Want List unchanged |
| SC-006 | Testers find Collection Settings, not app Settings |
| SC-007 / SC-008 | Bad file refuses with no writes; valid large import has no Upgrade to Pro |
| SC-009 | Unmatched names on preview |
| SC-010 | Mobile signed-out import works |
| SC-011 | Cancel leaves existing cards |
| SC-012 | Second import of the same file adds the same Printings again |
