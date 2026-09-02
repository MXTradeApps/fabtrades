# Contract: Printing recent-change read

Public catalog lookup for search-result overlays. New PostgREST RPC; no client writes.

## Function

```text
public.fab_printing_recent_changes(
  p_source   text,
  p_card_ids text[]
)
```

`SECURITY INVOKER`, `STABLE`, `search_path = public`. Reads `fab_card_prices` and `fab_price_history` (already public SELECT). Identity joins are optional; clients already have catalog Printings. `GRANT EXECUTE` to `anon` and `authenticated`. Revoke from `PUBLIC` then grant those two, matching `fab_recent_movers`.

| Client | Call |
| --- | --- |
| Mobile | `CardRepository.printingRecentChanges(source, cardIds)` → `supabase.rpc('fab_printing_recent_changes', …)` |
| Web | `printingRecentChanges(source, cardIds)` on `apps/web/src/services/fabDb.js` — `POST /rest/v1/rpc/fab_printing_recent_changes` with the publishable key (same `restFetch` POST family as `recentMovers`) |

Do not use the auth `supabase-js` client on web for this read.

Do **not** call `fab_recent_movers` for search overlays.

## Parameters

| Name | Required | Meaning |
| --- | --- | --- |
| `p_source` | yes | `tcgplayer` or `cardmarket`. Any other value → error (do not default). |
| `p_card_ids` | yes | Printing ids currently shown as search matches. `NULL` → error (do not catalog-scan). Empty array → zero rows. |

Window and overlay eligibility: [printing-recent-changes.md](./printing-recent-changes.md). `today` is `CURRENT_DATE`.

Unknown ids are skipped (not an error). Duplicate ids in the array produce at most one row per id.

Callers MUST pass only ids in the current search result list (existing catalog match cap). Debounce typing; abort/ignore stale.

## Response row

JSON keys as returned by PostgREST (snake_case). No `rank`. No top-10.

```json
{
  "card_id": "684123-foil",
  "start_low": 0.30,
  "start_on": "2026-08-22",
  "latest_low": 0.60,
  "percent_change": 1.0,
  "amount_change": 0.30
}
```

| Field | Type | Null | Notes |
| --- | --- | --- | --- |
| `card_id` | string | no | Printing id; merge key onto the catalog box |
| `start_low`, `latest_low` | number | no | Observed Lows; never 0-filled |
| `start_on` | `YYYY-MM-DD` | no | Date of the start snapshot |
| `percent_change` | number | no | Ratio `(latest-start)/start`; never 0 in this payload |
| `amount_change` | number | no | `latest - start` (negative for losers) |

Empty list `[]` is success: no requested Printing has a displayable overlay → every box omits the change line, not an error.

Do not mix rows from different `p_source` values on one result set.

Web/mobile details: look up `card_id` in the catalog and open that Printing. Do not open details from overlay fields alone.

## Errors

| Case | Client behavior |
| --- | --- |
| Network / 5xx / timeout | Search **boxes stay** (identity + current Low). Brief retry on trend figures only. Binder, trade, Browse Sets still usable. |
| Invalid `p_source` or `NULL` ids | Error + retry on figures. Do not substitute TCGplayer. Do not invent percents. |
| CardMarket, no overlay rows | `[]` → omit change lines; still CardMarket Lows on boxes when the catalog has `cm_low` |
| Stale response after query, marketplace change, or unmount | Ignore |
| RPC missing on an old backend | Error + retry on figures. Do not invent overlays from the snapshot |
| Ranked movers RPC failure | Must not block this search path (and the reverse) |

Web Browse Sets does not need this RPC for v1 (list presentation). A Trends lookup failure MUST NOT blank `/sets`.

## Writes

Not part of this contract. History upserts remain pipeline-only.

## Caching

In-memory per session keyed by `(source, sorted ids)` is allowed. Do not persist to disk. Do not add overlays to the web catalog snapshot.
