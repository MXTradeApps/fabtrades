-- Lookup recent Low change for requested Printing ids (search-result overlays).
-- Eligibility and window must match packages/contracts/printing_recent_changes.json.
-- Do not change fab_recent_movers. No $1 floor, no top-10 cut, no sealed extra-filter.
-- Apps only SELECT / RPC-read; ingest is unchanged.

CREATE OR REPLACE FUNCTION public.fab_printing_recent_changes(
  p_source text,
  p_card_ids text[]
)
RETURNS TABLE (
  card_id text,
  start_low numeric,
  start_on date,
  latest_low numeric,
  percent_change numeric,
  amount_change numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_source IS DISTINCT FROM 'tcgplayer' AND p_source IS DISTINCT FROM 'cardmarket' THEN
    RAISE EXCEPTION 'fab_printing_recent_changes: p_source must be tcgplayer or cardmarket, got %', p_source;
  END IF;

  IF p_card_ids IS NULL THEN
    RAISE EXCEPTION 'fab_printing_recent_changes: p_card_ids must not be null';
  END IF;

  IF cardinality(p_card_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH start_obs AS (
    SELECT DISTINCT ON (h.card_id)
      h.card_id,
      h.captured_on AS start_on,
      CASE
        WHEN p_source = 'tcgplayer' THEN h.tcg_low
        ELSE h.cm_low
      END AS start_low
    FROM public.fab_price_history h
    WHERE h.captured_on BETWEEN (CURRENT_DATE - 5) AND (CURRENT_DATE - 3)
      AND CASE
        WHEN p_source = 'tcgplayer' THEN h.tcg_low
        ELSE h.cm_low
      END IS NOT NULL
      AND h.card_id = ANY (p_card_ids)
    ORDER BY h.card_id, h.captured_on DESC
  ),
  eligible AS (
    SELECT
      so.card_id,
      so.start_on,
      so.start_low,
      CASE
        WHEN p_source = 'tcgplayer' THEN p.tcg_low
        ELSE p.cm_low
      END AS latest_low
    FROM start_obs so
    JOIN public.fab_card_prices p ON p.card_id = so.card_id
    WHERE CASE
        WHEN p_source = 'tcgplayer' THEN p.tcg_low
        ELSE p.cm_low
      END IS NOT NULL
      AND so.start_low <= 10000
      AND CASE
        WHEN p_source = 'tcgplayer' THEN p.tcg_low
        ELSE p.cm_low
      END <= 10000
      AND CASE
        WHEN p_source = 'tcgplayer' THEN p.tcg_low
        ELSE p.cm_low
      END IS DISTINCT FROM so.start_low
  ),
  scored AS (
    SELECT
      e.card_id,
      e.start_low,
      e.start_on,
      e.latest_low,
      (e.latest_low - e.start_low) / e.start_low AS percent_change,
      (e.latest_low - e.start_low) AS amount_change
    FROM eligible e
    WHERE abs((e.latest_low - e.start_low) / e.start_low) <= 10
  )
  SELECT
    s.card_id,
    s.start_low,
    s.start_on,
    s.latest_low,
    s.percent_change,
    s.amount_change
  FROM scored s;
END;
$$;

COMMENT ON FUNCTION public.fab_printing_recent_changes(text, text[]) IS
  'Lookup displayable recent Low change for requested Printing ids. Must match packages/contracts/printing_recent_changes.json. Must not change fab_recent_movers.';

REVOKE ALL ON FUNCTION public.fab_printing_recent_changes(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fab_printing_recent_changes(text, text[]) TO anon, authenticated;
