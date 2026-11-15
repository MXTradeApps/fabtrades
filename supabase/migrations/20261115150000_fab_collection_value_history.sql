-- Collection Stats "Value over time": the daily total value of a set of
-- Printings at the copies held today.
--
-- This values TODAY'S holdings at each past day's catalog price. Holdings
-- history is not stored, so cards added or removed along the way are not
-- reflected: the line answers "what were the cards I hold now worth then".
--
--   p_source      'tcgplayer' (Market, else Low) or 'cardmarket' (Trend, else Low),
--                 the same order the Total Value headline uses
--   p_card_ids    Printing ids (fab_cards.id)
--   p_quantities  copies held, same order and length as p_card_ids
--   p_days        window length, 7 to 120
--
-- A Printing with no snapshot on a day carries its most recent price from the
-- previous 7 days, so a missed pipeline day does not dent the line. A Printing
-- with no price in that span is left out of that day and counted in
-- unpriced_copies. Days where nothing is priced are omitted.

CREATE OR REPLACE FUNCTION public.fab_collection_value_history(
  p_source text,
  p_card_ids text[],
  p_quantities integer[],
  p_days integer DEFAULT 90
)
RETURNS TABLE (
  captured_on date,
  total_value numeric,
  priced_copies integer,
  unpriced_copies integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_source IS DISTINCT FROM 'tcgplayer' AND p_source IS DISTINCT FROM 'cardmarket' THEN
    RAISE EXCEPTION 'fab_collection_value_history: p_source must be tcgplayer or cardmarket, got %', p_source;
  END IF;
  IF p_days IS NULL OR p_days < 7 OR p_days > 120 THEN
    RAISE EXCEPTION 'fab_collection_value_history: p_days must be between 7 and 120, got %', p_days;
  END IF;
  IF COALESCE(array_length(p_card_ids, 1), 0) <> COALESCE(array_length(p_quantities, 1), 0) THEN
    RAISE EXCEPTION 'fab_collection_value_history: p_card_ids and p_quantities must be the same length';
  END IF;
  IF COALESCE(array_length(p_card_ids, 1), 0) > 5000 THEN
    RAISE EXCEPTION 'fab_collection_value_history: at most 5000 Printings per call';
  END IF;

  RETURN QUERY
  WITH held AS (
    SELECT u.cid, SUM(u.qty)::integer AS qty
    FROM unnest(p_card_ids, p_quantities) AS u(cid, qty)
    WHERE u.cid IS NOT NULL AND u.qty > 0
    GROUP BY u.cid
  ),
  -- 7 extra leading days so the first day of the window can carry a price forward.
  days AS (
    SELECT d::date AS day
    FROM generate_series(current_date - p_days - 7, current_date, interval '1 day') AS d
  ),
  px AS (
    SELECT
      h.card_id,
      h.captured_on AS day,
      CASE
        WHEN p_source = 'tcgplayer' THEN COALESCE(NULLIF(h.tcg_market, 0), NULLIF(h.tcg_low, 0))
        ELSE COALESCE(NULLIF(h.cm_trend, 0), NULLIF(h.cm_low, 0))
      END AS price
    FROM public.fab_price_history h
    WHERE h.card_id IN (SELECT hh.cid FROM held hh)
      AND h.captured_on >= current_date - p_days - 7
  ),
  -- One row per Printing per day; grp numbers the run that starts at each priced day.
  grid AS (
    SELECT
      dd.day,
      hh.cid,
      hh.qty,
      px.price,
      COUNT(px.price) OVER (PARTITION BY hh.cid ORDER BY dd.day) AS grp
    FROM days dd
    CROSS JOIN held hh
    LEFT JOIN px ON px.card_id = hh.cid AND px.day = dd.day
  ),
  filled AS (
    SELECT
      g.day,
      g.qty,
      CASE WHEN g.day - MIN(g.day) OVER w <= 7 THEN MAX(g.price) OVER w END AS price
    FROM grid g
    WINDOW w AS (PARTITION BY g.cid, g.grp)
  )
  SELECT
    f.day,
    ROUND(SUM(f.price * f.qty), 2),
    COALESCE(SUM(f.qty) FILTER (WHERE f.price IS NOT NULL), 0)::integer,
    COALESCE(SUM(f.qty) FILTER (WHERE f.price IS NULL), 0)::integer
  FROM filled f
  WHERE f.day >= current_date - p_days
  GROUP BY f.day
  HAVING SUM(f.price * f.qty) IS NOT NULL
  ORDER BY f.day;
END;
$$;

COMMENT ON FUNCTION public.fab_collection_value_history(text, text[], integer[], integer) IS
  'Collection Stats value over time: daily total of the given Printings at the copies held today.';

GRANT EXECUTE ON FUNCTION public.fab_collection_value_history(text, text[], integer[], integer) TO anon, authenticated;
