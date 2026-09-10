# Feature Specification: Fabrary CSV Binder Import

**Feature Branch**: `008-fabrary-csv-import`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "I want to build an import feature from a fabrary CSV to populate the binder. This should live within the settings of a specific binder."

## Clarifications

### Session 2026-09-10

- Q: If this Binder already has cards, should confirming the Fabrary file replace those cards or add the imported copies on top of them? → A: Add the imported copies on top of whatever is already in this Binder (same Printing quantities combine).
- Q: If one owned Fabrary row could match more than one catalog Printing, should that row be skipped or should the product pick one? → A: Pick one candidate using a stable rule (prefer the regular printing when it is a candidate; otherwise a fixed catalog order).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Binder settings and start a Fabrary import (Priority: P1)

A player has a Fabrary collection export and wants those owned cards in one of their Binders — typically Collection, sometimes Trade Binder or a custom Binder. They open **that Binder**, then open **that Binder's settings** (not the app-wide Settings screen). From those Binder settings they start **Import from Fabrary**.

The action is scoped to the Binder they came from. Importing into Collection does not write Trade Binder. Importing into Trade Binder does not write Collection. Want List is not offered and is not changed.

**Why this priority**: Without a Binder-scoped entry point, there is no feature. Players must be able to choose *which pile* the Fabrary file fills.

**Independent Test**: Open Collection, open that Binder's settings, and confirm Import from Fabrary is there. Open Trade Binder's settings and confirm the same action is offered for Trade Binder only. Confirm app-wide Settings does not contain this import.

**Acceptance Scenarios**:

1. **Given** the player is inside a Binder (Trade Binder, Collection, or a custom Binder), **When** they open that Binder's settings, **Then** they see an action to import a Fabrary collection file into *this* Binder.
2. **Given** they started import from Collection, **When** they complete or cancel, **Then** only Collection is in scope — Trade Binder, other Binders, and Want List are unchanged by that choice of destination.
3. **Given** they are on the app-wide Settings screen, **When** they look for Fabrary import, **Then** it is not there; import lives on the Binder, not in global settings.
4. **Given** they are on Want List, **When** they look for Binder settings or Fabrary import, **Then** it is not offered (Want List is not a Binder).
5. **Given** they use web or mobile, **When** they open a Binder's settings, **Then** Import from Fabrary is available on both surfaces with the same meaning; layout may be native to each surface.
6. **Given** a signed-out player with Binders already on the device, **When** they open a Binder's settings, **Then** they can start import without creating an account.

---

### User Story 2 - Preview owned cards before the Binder changes (Priority: P1)

The player picks their Fabrary collection file. Fabrary exports the whole catalog, so most rows are cards they do **not** own. The product reads **Have** as the owned quantity and ignores empty or zero Have.

Before anything is written, they see a **preview** for this Binder:

- how many owned rows were found (Have greater than zero)
- how many of those owned rows match a catalog Printing
- how many owned copies that represents (sum of Have on matched rows)
- how many owned rows could not be matched
- that this import will **add** those matched copies to this Binder (existing cards stay)

They can cancel and leave the Binder as it was. They do not have to understand Fabrary's extra columns (wants, extras for trade/sale).

**Why this priority**: A typical Fabrary file is tens of thousands of catalog rows with only a fraction owned. Writing blindly would dump the whole catalog. Preview is the safety rail that makes import trustworthy.

**Independent Test**: Use the attached-style Fabrary export (full catalog, Have filled only on owned printings). Confirm the preview counts owned rows only, shows match vs unmatched, and that canceling leaves the Binder unchanged.

**Acceptance Scenarios**:

1. **Given** a Fabrary collection file with many catalog rows and a smaller set of Have quantities, **When** the player selects that file, **Then** the preview's owned-row count equals the number of rows whose Have is greater than zero — not the total number of rows in the file.
2. **Given** that preview, **When** they read it, **Then** they see matched owned rows, unmatched owned rows, and the total owned copies that will land in this Binder if they confirm.
3. **Given** the preview is showing, **When** they cancel or go back, **Then** this Binder, other Binders, and Want List are unchanged.
4. **Given** the Binder already has cards, **When** they read the preview, **Then** they are told that confirming will **add** the imported copies on top of the cards already in this Binder (same Near Mint Printing quantities combine) and will not touch other Binders.
5. **Given** the Binder is empty, **When** they read the preview, **Then** they still see the same owned/matched/unmatched figures and can confirm to add the imported copies to the empty Binder.
6. **Given** rows that have Want in trade, Want to buy, Extra for trade, or Extra to sell filled, **When** they read the preview, **Then** those columns do not add extra copies and do not appear as a Want List change — only Have counts as owned quantity.

---

### User Story 3 - Confirm and see imported cards added to this Binder (Priority: P1)

The player confirms. Matched owned printings are **added** to this Binder. Cards that were already here stay. Each imported row becomes the same Printing they would pick by hand: same card, pitch, set, finish (normal / rainbow / cold / gold), treatment (extended art, full art, alternate art, and the other Fabrary treatments), and edition (First, Unlimited, Alpha, or none). Copies use the Have quantity. Condition is Near Mint because Fabrary's file does not carry condition. If this Binder already has that Printing in Near Mint, the Have quantity is added to that row.

Afterward they are back on this Binder's list (or a clear one-step return to it). Card count and Collection Stats for this Binder include both the previous cards and the imported copies. Unmatched owned rows are listed so they can fix those by hand later. Other Binders and Want List are untouched.

**Why this priority**: Preview without a successful write is not a collection import. This is the outcome the player came for.

**Independent Test**: Confirm import of a fixture file with a mix of normal, foil, treated, and edition rows plus some unmatched names. Open the Binder and verify counts, printings, and that a second Binder and Want List did not change. Re-open settings and confirm the unmatched list was shown.

**Acceptance Scenarios**:

1. **Given** a preview the player trusts and a Binder that already has cards, **When** they confirm, **Then** every previous card in this Binder is still there and the matched owned printings have been added.
2. **Given** a matched row with Have 3 for a Printing this Binder does not yet have, **When** import finishes, **Then** that Printing is in this Binder with quantity 3, Near Mint, and the finish/treatment/edition from that row.
3. **Given** this Binder already has quantity 2 Near Mint of a Printing and the file has Have 3 for that same Printing, **When** import finishes, **Then** this Binder has quantity 5 Near Mint of that Printing (2 + 3).
4. **Given** two owned rows in the file that are the same Printing (same card, set number, finish, treatment, and edition), **When** import finishes, **Then** the Have values from those rows are added together (and then added to any Near Mint quantity already in this Binder).
5. **Given** owned rows that could not be matched to a catalog Printing, **When** import finishes, **Then** those rows are not added and the player can see which owned cards were skipped and why (not found in the catalog).
6. **Given** import just finished, **When** they look at another Binder and at Want List, **Then** those piles are unchanged.
7. **Given** import just finished, **When** they look at this Binder's card count and Collection Stats, **Then** both reflect previous copies plus the imported Have totals on matched rows.
8. **Given** they confirm on web or on mobile, **When** they open the same Binder on the other surface after the data is available there, **Then** that Binder shows the same printings and combined quantities.
9. **Given** an owned row that fits more than one catalog Printing, including a regular printing, **When** import finishes, **Then** this Binder received the regular printing (not a treated variant), and a second run of the same file adds that same printing again.

---

### User Story 4 - Get a clear refusal when the file or the account cannot import (Priority: P2)

If the file is not a Fabrary collection export, is unreadable, or contains no owned cards, the player is told so in plain language and the Binder does not change.

If they are on the free tier and the import would put them over the shared distinct-card cap across all Binders, the import is refused entirely (no silent first-fifty). They see that they need Pro to hold a collection this large, and the Binder is unchanged.

**Why this priority**: A bad file or a 3,800-printing Fabrary dump against a 50-card free cap must not corrupt the Binder or quietly import a sliver. Refusal is still a complete, testable slice.

**Independent Test**: Feed a random non-Fabrary file, a Fabrary file with every Have empty, and a large owned set while over the free cap. In every case the Binder is unchanged and the message says what to do next.

**Acceptance Scenarios**:

1. **Given** a file that is not a Fabrary collection export (wrong columns or not a collection table), **When** they select it, **Then** they see that this is not a Fabrary collection file and no Binder changes.
2. **Given** a Fabrary collection file where every Have is empty or zero, **When** they select it, **Then** they see that no owned cards were found and no Binder changes.
3. **Given** a free player whose Binders would exceed the shared distinct-card cap if this import added its new distinct printings, **When** they confirm, **Then** the import is refused, they see the Pro upgrade, and every Binder is unchanged.
4. **Given** a Pro player (or a free player whose resulting distinct-card count stays at or under the cap), **When** they confirm a valid preview, **Then** the import proceeds as in User Story 3.
5. **Given** a refusal, **When** they dismiss it, **Then** they can pick a different file or leave settings without a partial write.

---

### Edge Cases

- **Full-catalog Fabrary export**: Tens of thousands of rows with Have blank on most of them is the normal file, not an error. Only Have greater than zero is owned.
- **Have of 0**: Treated as not owned, same as blank Have.
- **Non-numeric Have**: That row is skipped and listed with unmatched/skipped owned rows; it does not abort the rest of a valid file.
- **Duplicate owned rows for one Printing**: Have quantities add together in this Binder.
- **Identifier is not unique**: Fabrary repeats the same identifier across sets, finishes, treatments, and editions. Matching MUST use set number, finish, treatment, and edition — not identifier or name alone.
- **More than one catalog Printing fits**: The product MUST pick exactly one. Prefer the regular printing (no special treatment) when it is a candidate. Otherwise pick the first in a fixed catalog order (name, then set number, then finish) so the same file against the same catalog always chooses the same Printing. That row is matched, not unmatched.
- **Blank finish**: A blank Foiling is the regular (non-foil) printing, not "any foil."
- **Blank treatment / edition**: Matches the ordinary printing of that set number, not an extended-art, full-art, or First/Unlimited/Alpha variant.
- **Unmatched owned rows**: Shown to the player. They are not added. Matched rows still import when the player confirms (unless a cap or file refusal applies).
- **Zero matched owned rows**: Even if Have is filled, if nothing matches the catalog, import is refused and the Binder is unchanged.
- **Add to a non-empty Binder**: Previous cards in *this* Binder stay, including quantity, finish, treatment, edition, and condition. Cards in other Binders stay.
- **Same Printing already in this Binder (Near Mint)**: Have is added to that Near Mint quantity.
- **Same Printing already in this Binder (only a worn condition)**: Existing worn-condition row is unchanged. Import adds a separate Near Mint row for that Printing with the Have quantity.
- **Add and the free cap**: The cap is evaluated on the *resulting* set of distinct owned printings across all Binders after the add. A Printing already owned in any Binder does not consume an extra slot. Only printings the player does not yet own anywhere count as new. If that result would exceed the cap, the whole import is refused.
- **Same Printing already in another Binder**: Import still adds the copies into *this* Binder. The product does not steal copies from the other Binder. Distinct-card cap counts that Printing once across Binders (existing rule).
- **Trade Binder import**: Allowed. Confirm Trade and Trade Filler then see Trade Binder stock including the added copies. Collection is not auto-filled.
- **Lent copies in this Binder**: They stay. Import does not remove or move lends. If the lent Printing is also in the file, Have is added to the Near Mint row as usual.
- **Very large owned sets**: A collection on the order of several thousand owned printings (the attached export has thousands of Have rows) MUST complete without appearing stuck; the player sees progress or a clear "working" state until preview or finish.
- **Offline / signed out**: File is on the device. Import writes the on-device Binder. An account is not required. Signed-in sync later carries this Binder the same way a manual add would.
- **Second import of the same file**: Adds the Have quantities again. It does not replace or skip printings already imported. The preview MUST make that add-on-top behavior obvious.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each Binder MUST have a settings surface, reachable from that Binder, that includes **Import from Fabrary**. App-wide Settings MUST NOT be the home of this import. Want List MUST NOT offer it.
- **FR-002**: Import MUST apply only to the Binder whose settings started it. Other Binders and Want List MUST NOT be written by the import.
- **FR-003**: The player MUST be able to choose a Fabrary collection file from the device (web and mobile).
- **FR-004**: The product MUST accept the Fabrary collection export shape documented in Key Entities (header row plus one row per printing). A file that does not look like that export MUST be refused before any Binder write, with a message that a Fabrary collection export is required.
- **FR-005**: A row is **owned** only when Have is a number greater than zero. Blank Have, zero Have, and catalog-only rows MUST NOT create Binder cards.
- **FR-006**: Want in trade, Want to buy, Extra for trade, and Extra to sell MUST NOT change Binder quantities and MUST NOT write Want List.
- **FR-007**: Before any write, the product MUST show a preview: owned-row count, matched count, unmatched count, copies that will be added (sum of Have on matched rows), and that confirming **adds** those copies to this Binder without removing existing cards.
- **FR-008**: Canceling the preview or the file picker MUST leave all Binders and Want List unchanged.
- **FR-009**: Confirming MUST add the matched owned printings to this Binder. Existing cards in this Binder MUST remain. Same Near Mint Printing quantities MUST combine. Other Binders MUST NOT be edited.
- **FR-010**: Each matched row MUST become the catalog Printing that shares that row's card identity, set number, finish, treatment, and edition. A blank finish MUST map to the regular printing. A filled finish (Rainbow, Cold, Gold) MUST NOT land on a different finish. A treated or edition-specific row MUST NOT land on the untreated / edition-less printing of the same set number. If more than one catalog Printing still fits, the product MUST pick exactly one: the regular (no special treatment) printing when it is a candidate, otherwise the first in a fixed catalog order (name, then set number, then finish). The same file against the same catalog MUST always pick the same Printing. That row MUST be counted as matched, not unmatched.
- **FR-011**: Added quantity MUST be the row's Have value (summed when several owned rows match one Printing). Added copies MUST be Near Mint. If this Binder already has that Printing in Near Mint, the Have quantity MUST be added to that row. Existing rows in other conditions MUST stay unchanged.
- **FR-012**: Unmatched owned rows MUST be listed for the player (enough identity to find the card: name, set number, finish, treatment, edition). Those rows MUST NOT appear in the Binder.
- **FR-013**: If the file is readable as a Fabrary export but no owned row matches the catalog, the product MUST refuse the write and say that none of the owned cards were found.
- **FR-014**: If the file is a Fabrary export but no row is owned, the product MUST refuse the write and say that no owned cards were found.
- **FR-015**: Free-tier distinct-card limits MUST use the existing **shared cap across all Binders**. The product MUST evaluate the cap on the collection that would exist *after* the add. Printings already owned in any Binder MUST NOT consume an extra slot. If the result would exceed the cap, the import MUST be refused in full, the player MUST see the Pro upgrade, and no Binder MUST change. Pro MUST NOT be blocked by that cap.
- **FR-016**: Import MUST work without an account when Binders are already on the device. For a signed-in player, this Binder MUST appear the same on the other peer surface once that Binder is available there.
- **FR-017**: After a successful import, this Binder's list, tile card count, tile value, cover, and Collection Stats MUST match previous copies plus the added copies.
- **FR-018**: The same import rules (Have-only, add-to-this-Binder, matching, cap, unmatched reporting) MUST hold on web and mobile.

### Key Entities

- **Fabrary collection export**: A collection table exported from Fabrary. The attached example (September 2026) has these columns: Identifier, Name, Pitch, Set, Set number, Edition, Foiling, Treatment, Have, Want in trade, Want to buy, Extra for trade, Extra to sell. One row is one printing of a card. A typical file lists the whole catalog (example: ~17,000 rows) and fills Have only where the player owns copies (example: ~3,800 owned rows, ~6,900 copies).
- **Owned row**: A file row whose Have is a number greater than zero. This is the only row type that can become a Binder card.
- **Printing match**: The catalog Printing that corresponds to an owned row's set number, finish, treatment, and edition (plus card/pitch identity). Identifier alone is not a Printing — Fabrary reuses it across variants. When more than one catalog Printing fits, one is chosen by the stable rule in FR-010.
- **Binder settings**: The per-Binder management surface for one Binder (rename/delete remain elsewhere or here; this feature requires import to live here). Not app-wide Settings. Not Want List.
- **Import preview**: The confirmation the player sees after a valid file is read and before copies are added to this Binder.
- **Unmatched owned row**: An owned row with no catalog Printing. Shown to the player; never written.
- **Binder add**: The write that inserts matched owned printings into this Binder (combining Have into an existing Near Mint row of the same Printing). Other Binders are not part of the add.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From an open Binder, a player can reach Import from Fabrary and finish a valid import (file chosen, preview understood, confirm) in under 2 minutes of their own time, not counting file-read wait on a very large export.
- **SC-002**: After they confirm a valid file, this Binder's copy count equals its pre-import copy count plus the sum of Have on matched owned rows, and 100% of those matched printings appear in the list.
- **SC-003**: 100% of rows with blank or zero Have add zero copies (they do not create or increase Binder rows).
- **SC-004**: 0% of Want in trade / Want to buy / Extra for trade / Extra to sell values appear as extra Binder copies or as new Want List entries.
- **SC-005**: After import into Binder A, Binder B's list and Want List match their pre-import snapshot in 100% of checks.
- **SC-006**: At least 90% of first-time testers asked "where do I load my Fabrary collection into Collection?" open Collection's settings (not app-wide Settings, not Trade, not Want List) on the first try.
- **SC-007**: 100% of non-Fabrary files and empty-Have Fabrary files leave every Binder unchanged and show a message the tester can act on (get a Fabrary collection export, or export after marking Have).
- **SC-008**: 100% of free-tier imports that would exceed the shared distinct-card cap leave every Binder unchanged and show the Pro upgrade.
- **SC-009**: When a valid import includes unmatched owned rows, 100% of those skipped cards are visible to the player by name (and set/finish when present) after confirm.
- **SC-012**: Importing the same Fabrary file twice against the same catalog adds the same Printings each time (the stable pick for an ambiguous row does not change between runs).
- **SC-010**: A signed-out player can complete import into an on-device Binder without creating an account.
- **SC-011**: Canceling at preview leaves this Binder's previous cards in place in 100% of attempts, including when the Binder was non-empty.

## Assumptions

- **Have is owned quantity.** Fabrary's catalog dump is expected. Extra for trade / Extra to sell are notes about copies already counted in Have, not additional copies. Want columns belong to Fabrary's want/trade tools, not this Binder.
- **Add on top, after preview.** Confirming adds matched Have copies to this Binder. Existing cards stay. A second import of the same file adds those quantities again. Replacing this Binder's existing cards is out of scope for v1.
- **Near Mint default.** The file has no condition column. Condition stays descriptive-only and is not priced. Imported copies combine only with an existing Near Mint row of the same Printing.
- **Both peer surfaces.** Players export from Fabrary on a computer or phone; both web and mobile must accept the file.
- **No account gate** to import into Binders already on the device, matching existing Binder organization.
- **Shared free-tier card cap still applies.** A real Fabrary collection is often thousands of distinct printings (the attached export is). Free players will be refused and pointed at Pro rather than receiving a silent partial Binder. The 4-Binder count limit is unrelated (import does not create Binders).
- **Matching uses the live catalog.** Cards Fabrary lists that are not in the catalog yet are unmatched, not invented, and never priced as zero.
- **Binder settings is the entry.** Today rename/delete live on the Binder tile menu. This feature needs a settings place *for that Binder*. It may be a new settings screen for the open Binder or an expansion of that Binder's existing management; either way it is not global Settings.
- **Lent copies stay.** Import does not clear lends or rewrite worn-condition rows.
- **Vocabulary.** The destination is a **Binder**. Collection is only a default Binder name. Import does not rename the Binder tab to Collection and does not treat Want List as a Binder.

## Out of Scope

- Importing Want in trade / Want to buy into Want List.
- Choosing Extra for trade (or Extra to sell) as the quantity instead of Have.
- Splitting one file across Trade Binder and Collection automatically.
- Replacing this Binder's existing cards (wiping scans or earlier imports).
- Other collection files (TCGplayer, CardMarket, Dragon Shield, generic CSV).
- Exporting a Binder back to Fabrary.
- Condition, language, cost basis, or purchase-date columns (not in the Fabrary file).
- Changing catalog prices, inventing missing printings, or adjusting price by condition.
- Requiring an account to import.
- App-wide Settings as the import home.
- Deck lists, set-completion checklists, or marketplace listing.
