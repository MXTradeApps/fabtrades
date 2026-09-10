# Contract: Fabrary row → catalog Printing

Shared by web and mobile. Golden: `packages/contracts/fabrary_printing_match.json`.

Both suites MUST assert the fixture cases. If JS and Dart disagree, fix the implementation that drifted.

## Input

A Fabrary **owned row** (Have already known > 0) plus a catalog-shaped list of Printings (the fields in [data-model.md](../data-model.md)).

Identifier is **not** a match key.

## Output

| Result | Meaning |
| --- | --- |
| `{ printingId }` | Catalog id of the chosen Printing |
| `{ unmatched: { name, setNumber, foiling, treatment, edition } }` | No catalog Printing, or Have non-numeric (apply lists these) |

## Filter order

Documented in [research.md](../research.md). Fixture cases MUST cover at least:

1. Same set number, blank foil → regular / Normal, not Rainbow.
2. Rainbow / Cold / Gold → that foil, not Normal.
3. `(Extended Art)` (and other treatments) only when Treatment is set; blank Treatment excludes treated names.
4. First vs Unlimited vs blank edition.
5. Alpha only matches a catalog row that actually carries an alpha token; otherwise unmatched.
6. Pitch Red/Yellow/Blue vs colorless (blank Pitch).
7. Two catalog hits including a regular printing → regular wins.
8. Two treated hits, no regular → first by name, then set number, then finish.
9. Same file twice → same `printingId` (SC-012).
10. Quoted CSV name with a comma still parses to the right Name before match.

## Out of scope

- Inventing a catalog row
- Matching Want columns
- Price lookup (apply uses the already-matched Printing’s catalog stub)
