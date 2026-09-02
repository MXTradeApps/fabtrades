-- Recent movers ranking over existing history + current catalog Lows.
-- Eligibility, window, floor, and order must match packages/contracts/recent_movers.json.
-- Apps only SELECT / RPC-read; ingest is unchanged.

CREATE INDEX IF NOT EXISTS fab_price_history_captured_on_idx
  ON public.fab_price_history (captured_on);

CREATE OR REPLACE FUNCTION public.fab_recent_movers(
  p_source text,
  p_card_ids text[] DEFAULT NULL
)
RETURNS TABLE (
  direction text,
  rank integer,
  card_id text,
  name text,
  set_name text,
  finish text,
  image_url text,
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
    RAISE EXCEPTION 'fab_recent_movers: p_source must be tcgplayer or cardmarket, got %', p_source;
  END IF;

  IF p_card_ids IS NOT NULL AND cardinality(p_card_ids) = 0 THEN
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
      AND (p_card_ids IS NULL OR h.card_id = ANY (p_card_ids))
    ORDER BY h.card_id, h.captured_on DESC
  ),
  eligible AS (
    SELECT
      c.id AS card_id,
      c.name,
      s.name AS set_name,
      COALESCE(c.sub_type_name, '') AS finish,
      c.image_url,
      so.start_on,
      so.start_low,
      CASE
        WHEN p_source = 'tcgplayer' THEN p.tcg_low
        ELSE p.cm_low
      END AS latest_low
    FROM start_obs so
    JOIN public.fab_cards c ON c.id = so.card_id
    JOIN public.fab_sets s ON s.group_id = c.set_id
    JOIN public.fab_card_prices p ON p.card_id = c.id
    WHERE c.is_sealed = false
      AND so.start_low >= 1
      AND CASE
        WHEN p_source = 'tcgplayer' THEN p.tcg_low
        ELSE p.cm_low
      END IS NOT NULL
      AND CASE
        WHEN p_source = 'tcgplayer' THEN p.tcg_low
        ELSE p.cm_low
      END IS DISTINCT FROM so.start_low
  ),
  scored AS (
    SELECT
      e.*,
      (e.latest_low - e.start_low) AS amount_change,
      (e.latest_low - e.start_low) / e.start_low AS percent_change
    FROM eligible e
  ),
  ranked AS (
    SELECT
      CASE WHEN sc.percent_change > 0 THEN 'gainer' ELSE 'loser' END AS direction,
      sc.card_id,
      sc.name,
      sc.set_name,
      sc.finish,
      sc.image_url,
      sc.start_low,
      sc.start_on,
      sc.latest_low,
      sc.percent_change,
      sc.amount_change,
      ROW_NUMBER() OVER (
        PARTITION BY CASE WHEN sc.percent_change > 0 THEN 'gainer' ELSE 'loser' END
        ORDER BY
          CASE WHEN sc.percent_change > 0 THEN sc.percent_change END DESC,
          CASE WHEN sc.percent_change < 0 THEN sc.percent_change END ASC,
          sc.card_id ASC
      ) AS rank
    FROM scored sc
  )
  SELECT
    r.direction,
    r.rank::integer,
    r.card_id,
    r.name,
    r.set_name,
    r.finish,
    r.image_url,
    r.start_low,
    r.start_on,
    r.latest_low,
    r.percent_change,
    r.amount_change
  FROM ranked r
  WHERE r.rank <= 10
  ORDER BY r.direction, r.rank;
END;
$$;

COMMENT ON FUNCTION public.fab_recent_movers(text, text[]) IS
  'Rank recent Low movers. Eligibility, window, floor, and order must match packages/contracts/recent_movers.json.';

REVOKE ALL ON FUNCTION public.fab_recent_movers(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fab_recent_movers(text, text[]) TO anon, authenticated;
