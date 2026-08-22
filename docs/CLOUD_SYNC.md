# Cloud sync

How a customer's binders, want list, lend groups, trades, and settings get to the
server and back, and why it works the way it does.

## The constraint that shapes everything

Mobile shipped without accounts. Every screen reads its data synchronously from
`SharedPreferences` and renders on the first frame. Trades on web, meanwhile, have
always lived in Postgres.

So this is not a greenfield sync design. It has two hard requirements:

1. **Existing device data must survive.** Somebody with a 900-card binder and no
   account must not lose it, and must not have to do anything to keep it.
2. **The app must keep working signed out, and keep working offline.** Sync is an
   addition, never a precondition. A screen that waits on the network to draw a
   binder that is already on the device is a regression.

Both point at the same shape: **local storage stays the source of truth for
reads, and the server is reconciled against it in the background.**

## Tables

| Table | Holds | Key |
| --- | --- | --- |
| `binders` | Binder records (name, role, tombstone) | `(user_id, client_id)` |
| `binder_entries` | Owned Binder rows and Want List rows | `(user_id, client_id)` |
| `lend_groups` | Lend groups and their cards | `(user_id, client_id)` |
| `trades` | Confirmed and saved trades | `(user_id, client_id)` |
| `user_settings` | One row per account | `user_id` |

Every table is `select`/`insert`/`update`/`delete` where `auth.uid() = user_id`,
and no client can see another account's rows.

`client_id` is the identity that matters. The client mints it, so a record can be
referred to before the server has ever heard of it, and an insert can be retried
without creating a duplicate. `id` remains the primary key for web's existing
foreign-key-shaped code, but sync never keys on it.

### Binders and owned-entry identity

`binders` holds one row per Binder: `client_id` (`system:trade`,
`system:collection`, or a UUID), display `name`, `role` (`trade` or
`standard`), and `deleted_at`. Live names are unique per user after
`lower(btrim(name))`. Exactly one live Trade Binder (`role = trade`) exists
per user; it is never tombstoned.

Owned `binder_entries` belong to a Binder (`binder_id` = that Binder's
`client_id`). Want List rows stay `is_wanted = true` with `binder_id` null —
Want List is not a Binder.

Entry identity, also stored as `binder_entries.client_id` for upsert:

| List | Identity |
| --- | --- |
| Owned | `binder|{binderId}|{cardId}|{condition}` |
| Want List | `want|{cardId}` |

Conflict target is `(user_id, client_id)`. Live product uniqueness is a
partial unique on owned `(user_id, card_id, binder_id, condition)` and want
`(user_id, card_id)`. Last write wins per record. A unique-violation on a
live Binder name is a surfaced error, not a silent rename.

`trades` was FAB-web's table before mobile had accounts, so this migration
generalized it rather than replacing it: `name` became nullable (mobile saves a
trade as a side effect of confirming one and never asks for a name), and
`client_id`, `notes`, `have_cash`, `want_cash`, `currency_symbol`, and
`deleted_at` were added.

## Reconciliation

Last write wins on `updated_at`, per record, with deletions as tombstones.

Nothing here is a merge in the interesting sense. Two devices editing the *same
binder row* at the same time is rare, and the losing side loses one quantity edit.
Two devices editing *different rows* is the common case and both survive, because
reconciliation is per record rather than per collection.

Deletion is the part that needs the care. A deleted row that is simply absent is
indistinguishable from a row the other device has not uploaded yet, so deleting on
one device and syncing on another would resurrect it. Instead a delete sets
`deleted_at`, the row stays, and the tombstone propagates. Web does this too —
`deleteTrade` updates rather than deletes.

### The journal

`SyncJournal` keeps, in `SharedPreferences` beside the data itself:

- `updated_at` per record, since the local models never had a timestamp field and
  adding one would have changed the storage format every existing install depends on
- tombstones for records deleted locally
- a **high-water mark** per domain
- the account id the local cache belongs to

The high-water mark exists because `DateTime.now()` is not a clock you can order
edits with. Two taps inside the same millisecond produce equal timestamps, and
last-write-wins cannot pick a winner. So a new local timestamp is
`max(now, previous + 1ms)`: monotonic per domain, still roughly wall-clock, and
strictly ordered for rapid successive edits. This is a Lamport clock wearing a
timestamp's clothes.

### Two kinds of write

`LocalCollection` distinguishes them, and the distinction is load-bearing:

- `save` — the customer changed something. Journals a new timestamp, so it will be
  pushed.
- `saveSynced` — the engine wrote merged server state into the cache. Does **not**
  journal, because stamping it as a fresh local edit would push server data back to
  the server as if it were new, forever.

## First sign-in

There is no separate migration step, which is the nicest property of the design.

A device that has never synced has local records and no tombstones. Ordinary
reconciliation therefore sees records the server does not have and uploads them.
The migration off device-local storage is just the first sync.

## A device that changes hands

`SyncJournal` records which account the cache belongs to. On sign-in:

- **No previous account.** The data was built while signed out, so it is this
  customer's. Left alone, and it uploads.
- **A different account.** A shared device, or a phone that was sold. The local
  cache is discarded via `saveSynced` — not `save`, or those "deletions" would be
  pushed into the new account and delete the wrong person's binder.
- **Same account.** Ordinary incremental sync.

Settings survive an account switch. A theme is as much a property of the device as
of the account, and resetting somebody's dark mode on sign-in reads as a bug.

## Failure

A sync failure is not a failed screen. Every screen still renders from the local
cache, so failures are reported beside the data (a snack bar via `SyncHost`, and
the sync row in Settings) rather than in place of it.

Each collection is reconciled independently and a failure in one does not abandon
the others: one unreachable table should not strand a binder. `SyncService.run`
throws only when all five failed, which is the signal that the problem is the
connection rather than the data.

## The one asymmetry between clients

`trades.have_list` / `want_list` are JSONB, and the two clients do not agree on
what goes in them. Web stores its in-memory card objects, carrying `cardGroup` and
`availableEditions` so the edition dropdown still works after a reload. Mobile
stores lean lines with the card nested under `card`.

Migrating either would break trades already saved in that format, so both clients
read both shapes and keep writing their own: `TradeItem.fromSharedJson` on mobile,
`normalizeTradeItem` in `apps/web/src/utils/tradeItems.js`.

## Where the code is

```
apps/mobile/lib/core/sync/
  sync_record.dart      SyncRecord + mergeRecords — the whole conflict rule
  sync_journal.dart     Local timestamps, tombstones, high-water marks
  sync_adapter.dart     LocalCollection / SyncAdapter interfaces
  collection_sync.dart  The engine, one instance per collection
  settings_sync.dart    The singleton-row variant
  remote_store.dart     RemoteCollection / RemoteSettings + Supabase impls
  binder_sync.dart      Per-domain row mapping (entries)
  binders_sync.dart     Binder records (`public.binders`)
  lend_sync.dart
  trade_sync.dart
  sync_service.dart     Orchestration + account-switch handling
apps/mobile/lib/core/data/cached_collection.dart
                        SharedPreferences-backed LocalCollection base
apps/mobile/lib/features/sync/sync_host.dart
                        Keeps sync alive; reports failures
```

`RemoteCollection` and `RemoteSettings` exist so the engines can be tested against
an in-memory fake. The tests in `apps/mobile/test/core/sync/` cover first sign-in,
conflicts in both directions, tombstones, re-adding after a delete, partial
failure, and account switching, none of which need a network.
