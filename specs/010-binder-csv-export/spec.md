# Feature Specification: Binder CSV Export

**Feature Branch**: `claude/binder-csv-export`

**Created**: 2026-10-27

**Status**: Confirmed 2026-10-27, implemented (web)

**Related**: [009-binder-csv-import](../009-binder-csv-import/spec.md)

**Input**: "Now that we've put an import, please also create an export. The schema for the exported csv should be Name, Pitch, Set, Code, Quantity, Price, Total Price." Confirmed follow-up: "Add in foiling and treatment not condition."

## Summary

An open Binder's **⋯** menu (the same menu as **Import cards**) gets **Export cards**, which downloads that Binder as a CSV. The file reads well in a spreadsheet and imports back through **Import cards** into the same printings.

## Entry point

- Open Binder page → **⋯** at the top right → **Export cards**. Want List has no ⋯ menu, so no export there.
- Only the open Binder's cards are exported, never other Binders or the Want List.
- An empty Binder shows "Nothing to export" and downloads nothing.
- File name: the Binder name slugged plus the date, e.g. `trade-binder-2026-10-27.csv`.
- The My Binders page keeps its existing **Export for Fabrary** button (008) unchanged.

## CSV schema

Columns, in order: `Name, Pitch, Set, Code, Foiling, Treatment, Quantity, Price, Total Price`.

| Column | Value |
| --- | --- |
| Name | Base card name without `(Red)` / `(Marvel)` / ` - FAB061` qualifiers |
| Pitch | `Red` / `Yellow` / `Blue`, blank for cards without pitch |
| Set | Set name (`Welcome to Rathe`) |
| Code | Collector number (`WTR167`) |
| Foiling | `Normal`, `Rainbow`, `Cold`, `Gold` (`Foil` for a foil of unknown finish) |
| Treatment | Name qualifiers other than pitch (`Marvel`, `Extended Art`, `Golden`), comma-separated; blank when none |
| Quantity | Copies in this Binder, all conditions summed |
| Price | TCGplayer market price per copy, 2 decimals; blank when unpriced |
| Total Price | Quantity × Price, 2 decimals; blank when unpriced |

- One row per printing. Condition is not exported (Max, 2026-10-27).
- Rows are sorted by Name, then Pitch, Set, Code, Foiling, Treatment.
- Fields with commas, quotes or newlines are quoted (RFC 4180).

## Round trip through Import cards

The general import (009) also accepts these optional columns so an exported file matches without guessing:

- `Code` (also `Card Code`, `Collector Number`, `Card Number`, `Set Number`): used like a code in Name.
- `Pitch` (also `Color`): used like `(Red)` in Name.
- `Treatment` (also `Art`, `Art Treatment`): used like `(Extended Art)` in Name.
- A **blank Treatment cell** in a file that has a Treatment column prefers untreated printings (when any exist). A file without a Treatment column keeps 009's rule: Marvel / Extended Art / … versions stay in play and the $5 spread decides.
- `Price` and `Total Price` are ignored on import.

## Acceptance

1. A Binder with 2 × Lightning Press (SUP001, Normal, $12.50) exports `Lightning Press,,Super Slam,SUP001,Normal,,2,12.50,25.00`.
2. Two conditions of one printing export as one row with the summed quantity.
3. Exporting a Binder and importing the file into an empty Binder adds the same printings and quantities, with no review rows, including Marvel and Extended Art versions that share a collector number with the regular printing.
