# FAB Trades

A trade companion for Flesh and Blood TCG players: price lookup, trade
balancing, want lists, and card scanning. Web app plus Flutter mobile app
sharing one Supabase catalog.

## Language

**Binder**:
A named pile of owned Printings that belong to the player. This is the
type. A player can have several Binders. Putting a card in a Binder is
owning it in that pile.
_Avoid_: inventory, “owned cards” as a product noun

**Trade Binder**:
The default Binder that is **tradeable stock**. Confirm Trade, Trade
Filler, and public share use this Binder. Putting a card in Trade Binder
is the act of marking it for trade. Always present; never deletable.
Renaming it does not change its role.

**Collection**:
The default Binder **name** for owned cards the player is not offering
for trade (the keep pile). Collection is a display name, not a different
product type. Do not rename the Binder destination or tab to Collection.

**Want List**:
Cards a player is looking to acquire. Shown to other players as a visual
grid so they can check their Trade Binder against it. Want List is not a
Binder.

**Trade Filler**:
A suggested card whose price closes the value gap of a live trade. The
side that owes value determines whose cards are relevant: my side needs
value → my Trade Binder; their side needs value → my Want List.

**Confirm Trade**:
The single action that executes a live trade: it is recorded to history
and Trade Binder updates to match — given cards leave Trade Binder,
received cards enter Trade Binder (each skippable, but on by default).
Collection and other Binders are not auto-reconciled. A cleared trade
touches nothing.
_Avoid_: Save trade

**Printing**:
A specific physical version of a card (set + finish), keyed by
`<product_id>-<subtype>`. Binder and trade entries reference printings,
not card names.

**Condition**:
Physical wear grade of a Binder entry (NM, LP, MP, HP, DMG). Descriptive
only — the app does not price-adjust by condition.
