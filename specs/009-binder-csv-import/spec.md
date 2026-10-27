# Feature Specification: General CSV Binder Import

**Feature Branch**: `claude/binder-csv-import`

**Created**: 2026-10-27

**Status**: Confirmed 2026-10-27, implemented (web)

**Supersedes (in part)**: [008-fabrary-csv-import](../008-fabrary-csv-import/spec.md)

**Input**: "Alter the Import from Fabrary button in the binders. It should live within a dot menu within a certain binder and not in the top-level binders page. It should intake a new CSV schema of Name, Set, Foiling, Quantity. The search should not require all information, but should be more accurate with more information. The name field may contain the card code (FAB123, ROS111, etc.), which should make search more accurate. The import should fuzzy search for each row and add the quantity in. If multiple printings match, only choose the lowest-price one if the difference between all the printings is under $5. If the variance is more than $5, flag the row for manual review. There should be a manual review part of the flow on the modal where the user selects the correct printing."

## Summary

Importing becomes a per-Binder action. From a Binder tile's **⋯** menu the player picks **Import cards**, chooses a CSV, and every row is matched against the catalog with a forgiving search. Rows that resolve to one printing (or to several printings within $5 of each other) are added automatically. Rows that are ambiguous by more than $5 go to a **Needs review** step in the same modal, where the player picks the right printing. Nothing is written until the player confirms.

## Entry point (Part 1 — already built on this branch)

- The top-level **Import from Fabrary** button on the Binders grid is removed.
- Each Binder tile's ⋯ menu has the import item. Want List's tile does not.
- The import writes into **that** Binder. Other Binders are not written (except the Fabrary-only Want/Extra routing noted below).
- The menu label is **Import cards**.

## CSV schema

Headers are matched case-insensitively, ignoring spaces, `_` and `-`. Column order does not matter. Extra columns are ignored.

| Field | Required | Accepted headers | Accepted values |
| --- | --- | --- | --- |
| Name | **Yes** | `Name`, `Card`, `Card Name` | Card name, optionally with a card code (`Snatch WTR167`, `ROS111 Aether Quickening`, `Snatch (WTR167)`), pitch (`(Red)`, `- Red`), or treatment (`(Extended Art)`) |
| Set | No | `Set`, `Set Code`, `Set Name`, `Edition` | Set code (`WTR`, `ROS`) or set name (`Welcome to Rathe`), fuzzy matched |
| Foiling | No | `Foiling`, `Foil`, `Finish` | Blank / `Normal` / `Non-foil`, `Rainbow` / `RF`, `Cold` / `CF`, `Gold` / `GF`, `Foil` (= any foil) |
| Quantity | No | `Quantity`, `Qty`, `Count`, `Have` | Positive whole number. Blank means 1. 0 or negative skips the row. Non-numeric → Couldn't match list. |

A file with no recognizable Name column is refused: "This file needs a Name column."

**Fabrary exports keep working.** If the headers match the Fabrary export, the existing Fabrary matcher (008) is used unchanged and only `Have` is imported, into this Binder. Want and Extra columns are ignored, so a per-Binder import never writes another pile.

## Matching one row

1. **Card code.** Look for a code in Name: 2–4 letters followed by 3 digits (`WTR167`, `ROS111`, `FAB123`), optionally with a foil suffix. If found, candidates = catalog printings with that collector number. Strip the code from the name before step 2.
2. **Name.** Normalize (lowercase, drop punctuation and accents, collapse spaces). Pull out pitch (`red`/`yellow`/`blue`) and treatment words if present.
   - Exact normalized name match first.
   - Otherwise fuzzy: closest catalog card name by Damerau-Levenshtein distance, allowing 1 typo for names of 4–9 characters and about 15% of the length for longer ones (none under 4). If two different card names score within 0.03 of each other, the row needs review.
   - With a card code, the name only confirms: if the code's card name is not similar to the row's name (< 0.6) the row needs review with the code's printings as choices.
3. **Narrow by what the row gives.** Each filter is skipped when its field is blank. A filter that would leave nothing sends the row to review over the printings it had, rather than guessing.
   - Pitch from the name.
   - Set: code or name match against the printing's set.
   - Foiling: exact finish (`Foil` = any foil).
   - Treatment: if the name names one, keep those printings.
   - Then the preference for a blank field: blank Foiling → prefer non-foil printings (only when any exist). No treatment in the name does **not** narrow: Marvel / Extended Art / … versions stay candidates, so the price spread decides whether the player is asked.
4. **Pick.**
   - 0 candidates → **Couldn't match** (listed, not written).
   - 1 candidate → matched.
   - 2+ candidates → compare their TCGplayer market price. If (highest − lowest) ≤ **$5.00**, auto-pick the **lowest-priced** printing. If the spread is more than $5.00, the row goes to **Needs review**.
   - Unpriced candidates are ignored for the spread. If none of the candidates has a price, the row goes to **Needs review**.

Same rule set produces the same result for the same file and catalog every time. Ties on price break by set release order, then collector number.

## The modal flow

1. **Choose CSV** (title shows "Import cards into {Binder}").
2. **Working** spinner while parsing and matching (thousands of rows must not freeze the page).
3. **Summary**: rows read, matched automatically, needs review, couldn't match, copies to add.
4. **Needs review** (only shown when ≥ 1 row): one row at a time, or a scrollable list. Each item shows the CSV row as typed (name, set, foiling, quantity) and the candidate printings as selectable cards: image, set, collector number, finish, treatment, market price. The player picks one or **Skip**. Progress like "3 of 12 reviewed".
5. **Couldn't match** list, as today.
6. **Confirm** adds: auto-matched rows + reviewed rows. Unreviewed rows are skipped and the button says so ("Add 214 cards · 3 unreviewed will be skipped"). Cancel at any step writes nothing.

## Writing

- Added copies are Near Mint and go into this Binder. If this Binder already has that printing in NM, the quantity is added on top (same as 008).
- Rows resolving to the same printing are summed.
- No free-tier cap, no Upgrade to Pro.
- After confirm the modal shows "Added N copies to {Binder}" and the Couldn't match list stays visible.

## Out of scope

- Mobile app (Flutter). This change is web only; mobile keeps its current Fabrary import until a follow-up.
- Condition, language, or price columns in the CSV.
- Replacing a Binder's contents.
- Importing into Want List.
- Changing **Export for Fabrary**.

## Acceptance checks

1. Binders grid has no import button; each Binder tile ⋯ menu (not Want List) has it, and it imports into that Binder.
2. `Name,Set,Foiling,Quantity` / `Snatch WTR167,,,3` adds 3 of the WTR167 non-foil Snatch printing (the cheapest if several are within $5).
3. `Name` only / `Enlightened Strike` with printings spread over $5 → row appears in Needs review; picking one adds it.
4. `Snach (Red)` (typo) still matches Snatch (Red).
5. Two candidates at $0.25 and $4.75 → lowest auto-picked. Candidates at $0.25 and $5.50 → review.
6. Unknown name → Couldn't match, not written; other rows still import.
7. A Fabrary export still previews and imports, with only Haves, into the chosen Binder.
8. Cancel at any step leaves all Binders unchanged.
9. `Usurp the Shadow Throne` (only Rainbow Foil $59 and Marvel Cold Foil $248 exist) → Needs review.

## Decisions (Max, 2026-10-27)

1. Fabrary exports: keep auto-detecting; only Have is imported, into this Binder.
2. Blank Foiling: prefer the non-foil printing. No treatment in the name keeps treated versions in play (revised 2026-10-27: "Usurp the Shadow Throne" must ask Rainbow Foil vs Marvel Cold Foil).
3. No candidate has a price: send the row to review.
