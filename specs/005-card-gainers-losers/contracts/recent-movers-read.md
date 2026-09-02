# Contract: Recent movers read

Public catalog ranking. New PostgREST RPC; no client writes.

## Function

```text
public.fab_recent_movers(
  p_source   text,
  p_card_ids text[] DEFAULT NULL
)
```

`SECURITY INVOKER`, `STABLE`, `search_path = public`. Reads `fab_cards`, `fab_sets`, `fab_card_prices`, `fab_price_history` (already public SELECT). `GRANT EXECUTE` to `anon` and `authenticated`. Revoke from `PUBLIC` then grant those two, matching `get_public_binder`.

| Client | Call |
| --- | --- |
| Mobile | `CardRepository.recentMovers(source, {cardIds})` → `supabase.rpc('fab_recent_movers', …)` |
| Web | `recentMovers(source, cardIds?)` on `apps/web/src/services/fabDb.js` — `POST /rest/v1/rpc/fab_recent_movers` with the publishable key (extend `restFetch` with POST + JSON body; do not overload GET) |

Do not use the auth `supabase-js` client on web for this read (keep catalog reads on `fabDb.js`).

## Parameters

| Name | Required | Meaning |
| --- | --- | --- |
| `p_source` | yes | `tcgplayer` or `cardmarket`. Any other value → error (do not default). |
| `p_card_ids` | no | `NULL` (omit) = catalog-wide. Non-null array = rank only those Printing ids (owned). Empty array = zero rows. |

Window and ranking: [recent-movers.md](./recent-movers.md). `today` is `CURRENT_DATE`.

Sealed Printings are excluded even if listed in `p_card_ids`.

Unknown ids in `p_card_ids` are skipped (not an error).

## Response row

JSON keys as returned by PostgREST (snake_case).

```json
{
  "direction": "gainer",
  "rank": 1,
  "card_id": "684123-foil",
  "name": "Awakening",
  "set_name": "The Hunted",
  "finish": "Rainbow Foil",
  "image_url": "https://…",
  "start_low": 4.00,
  "start_on": "2026-08-22",
  "latest_low": 6.00,
  "percent_change": 0.5,
  "amount_change": 2.00
}
```

| Field | Type | Null | Notes |
| --- | --- | --- | --- |
| `direction` | `gainer` \| `loser` | no | Split lists in the client; do not mix into one sort |
| `rank` | int 1…10 | no | Per direction |
| `card_id` | string | no | Printing id; details navigation key |
| `name`, `set_name`, `finish` | string | finish may be empty | FR-004 identity. `finish` is `sub_type_name` |
| `image_url` | string | yes | Thumbnail; missing art is allowed |
| `start_low`, `latest_low` | number | no | Observed Lows; never 0-filled |
| `start_on` | `YYYY-MM-DD` | no | Date of the start snapshot |
| `percent_change` | number | no | Ratio `(latest-start)/start` (0.5 = +50%) |
| `amount_change` | number | no | `latest - start` (negative for losers) |

Empty list `[]` is success: no Printings qualify → client empty copy, not an error.

Catalog-wide and owned are **two calls** (omit ids vs pass ids). Do not mix rows from different `p_source` values on one screen.

Web details: look up `card_id` in the catalog snapshot and call `openDetail` with that Printing. Do not open details from RPC fields alone.

## Errors

| Case | Client behavior |
| --- | --- |
| Network / 5xx / timeout | Movers **error + retry**. Search, mobile set list, web Browse Sets, Binder, trade still usable. |
| Invalid `p_source` | Error + retry. Do not substitute TCGplayer. |
| CardMarket, zero eligible | `[]` → empty copy that still names CardMarket / recent movers, not a TCG list |
| Stale response after marketplace change or unmount | Ignore; do not paint the previous source’s rows |
| RPC missing on an old backend | Error + retry (fail visible). Do not invent lists from the snapshot |

Web Browse Sets never calls this RPC. A Trends fetch failure MUST NOT blank `/sets`.

## Writes

Not part of this contract. History upserts remain pipeline-only.

## Caching

In-memory per session keyed by `(source, owned|catalog, sorted ids)` is allowed. Do not persist to disk. Do not add movers to the web catalog snapshot.
