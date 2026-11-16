-- Trending movers: allow a 2-day window, and count the window back from the
-- newest snapshot instead of from today's date.
--
-- Before this, p_days had to be 3 or more, and the start price was the latest
-- snapshot on or before (today - p_days). The daily ingest runs at 06:00 UTC,
-- so from midnight to 06:00 UTC the newest snapshot is yesterday's and every
-- window was a day short. That is small on 7 or 30 days but would turn a
-- 2-day window into a 1-day one. Now:
--   latest price  the newest snapshot from the last 3 days (unchanged)
--   start price   the latest snapshot in
--                 [newest - p_days - 2, newest - p_days]
-- Same signature, columns, caps and ranking as 20261109000000; nothing else
-- changes. fab_recent_movers is unchanged: the mobile app still calls it.

CREATE OR REPLACE FUNCTION public.fab_trending_movers(
  p_source text,
  p_days integer DEFAULT 7,
  p_sort text DEFAULT 'percent',
  p_min_price numeric DEFAULT 0,
  p_card_ids text[] DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  direction text,
  rank integer,
  direction_total integer,
  price_kind text,
  card_id text,
  name text,
  set_name text,
  finish text,
  image_url text,
  start_price numeric,
  start_on date,
  latest_price numeric,
  percent_change numeric,
  amount_change numeric,
  history numeric[]
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_latest date;
BEGIN
  IF p_source IS DISTINCT FROM 'tcgplayer' AND p_source IS DISTINCT FROM 'cardmarket' THEN
    RAISE EXCEPTION 'fab_trending_movers: p_source must be tcgplayer or cardmarket, got %', p_source;
  END IF;
  IF p_days IS NULL OR p_days < 2 OR p_days > 90 THEN
    RAISE EXCEPTION 'fab_trending_movers: p_days must be between 2 and 90, got %', p_days;
  END IF;
  IF p_sort IS DISTINCT FROM 'percent' AND p_sort IS DISTINCT FROM 'amount' THEN
    RAISE EXCEPTION 'fab_trending_movers: p_sort must be percent or amount, got %', p_sort;
  END IF;
  IF p_limit IS NOT NULL AND p_limit < 1 THEN
    RAISE EXCEPTION 'fab_trending_movers: p_limit must be positive, got %', p_limit;
  END IF;
  IF p_card_ids IS NOT NULL AND cardinality(p_card_ids) = 0 THEN
    RETURN;
  END IF;

  SELECT max(h.captured_on) INTO v_latest
  FROM public.fab_price_history h
  WHERE h.captured_on >= CURRENT_DATE - 2;
  IF v_latest IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH obs AS (
    SELECT
      h.card_id AS cid,
      h.captured_on AS day,
      CASE WHEN p_source = 'tcgplayer' THEN h.tcg_low ELSE h.cm_low END AS low,
      CASE WHEN p_source = 'tcgplayer' THEN h.tcg_market ELSE h.cm_trend END AS mkt
    FROM public.fab_price_history h
    WHERE (
        h.captured_on BETWEEN (v_latest - p_days - 2) AND (v_latest - p_days)
        OR h.captured_on = v_latest
      )
      AND (p_card_ids IS NULL OR h.card_id = ANY (p_card_ids))
  ),
  start_low AS (
    SELECT DISTINCT ON (o.cid) o.cid, o.day AS s_on, o.low AS s_price
    FROM obs o
    WHERE o.day <= v_latest - p_days AND o.low IS NOT NULL
    ORDER BY o.cid, o.day DESC
  ),
  start_mkt AS (
    SELECT DISTINCT ON (o.cid) o.cid, o.day AS s_on, o.mkt AS s_price
    FROM obs o
    WHERE o.day <= v_latest - p_days AND o.mkt IS NOT NULL
    ORDER BY o.cid, o.day DESC
  ),
  latest AS (
    SELECT o.cid, o.low, o.mkt
    FROM obs o
    WHERE o.day = v_latest
  ),
  cand AS (
    SELECT 'gainer'::text AS dir, 'low'::text AS kind, sl.cid, sl.s_on, sl.s_price, l.low AS l_price
    FROM start_low sl
    JOIN latest l ON l.cid = sl.cid
    WHERE l.low > sl.s_price
    UNION ALL
    SELECT 'loser'::text, 'market'::text, sm.cid, sm.s_on, sm.s_price, l.mkt
    FROM start_mkt sm
    JOIN latest l ON l.cid = sm.cid
    WHERE l.mkt < sm.s_price
  ),
  scored AS (
    SELECT
      cd.dir,
      cd.kind,
      c.id AS cid,
      c.name AS c_name,
      st.name AS c_set,
      COALESCE(c.sub_type_name, '') AS c_finish,
      c.image_url AS c_image,
      cd.s_on,
      cd.s_price,
      cd.l_price,
      (cd.l_price - cd.s_price) AS amt,
      (cd.l_price - cd.s_price) / cd.s_price AS pct
    FROM cand cd
    JOIN public.fab_cards c ON c.id = cd.cid
    JOIN public.fab_sets st ON st.group_id = c.set_id
    WHERE c.is_sealed = false
      AND cd.s_price >= 1
      AND cd.s_price <= 10000
      AND cd.l_price <= 10000
      AND abs((cd.l_price - cd.s_price) / cd.s_price) <= 10
      AND GREATEST(cd.s_price, cd.l_price) >= COALESCE(p_min_price, 0)
  ),
  ranked AS (
    SELECT
      sc.*,
      ROW_NUMBER() OVER (
        PARTITION BY sc.dir
        ORDER BY
          CASE WHEN p_sort = 'amount' THEN abs(sc.amt) ELSE abs(sc.pct) END DESC,
          sc.cid ASC
      ) AS rn,
      COUNT(*) OVER (PARTITION BY sc.dir) AS total
    FROM scored sc
  )
  SELECT
    r.dir,
    r.rn::integer,
    r.total::integer,
    r.kind,
    r.cid,
    r.c_name,
    r.c_set,
    r.c_finish,
    r.c_image,
    r.s_price,
    r.s_on,
    r.l_price,
    r.pct,
    r.amt,
    (
      SELECT array_agg(
        CASE
          WHEN r.kind = 'low' THEN
            CASE WHEN p_source = 'tcgplayer' THEN h.tcg_low ELSE h.cm_low END
          ELSE
            CASE WHEN p_source = 'tcgplayer' THEN h.tcg_market ELSE h.cm_trend END
        END
        ORDER BY h.captured_on
      )
      FROM public.fab_price_history h
      WHERE h.card_id = r.cid
        AND h.captured_on >= r.s_on
        AND CASE
          WHEN r.kind = 'low' THEN
            CASE WHEN p_source = 'tcgplayer' THEN h.tcg_low ELSE h.cm_low END
          ELSE
            CASE WHEN p_source = 'tcgplayer' THEN h.tcg_market ELSE h.cm_trend END
        END IS NOT NULL
    )
  FROM ranked r
  WHERE p_limit IS NULL OR r.rn <= p_limit
  ORDER BY r.dir, r.rn;
END;
$$;

COMMENT ON FUNCTION public.fab_trending_movers(text, integer, text, numeric, text[], integer) IS
  'Trending page movers: risers by catalog Low, fallers by Market/Trend, with window, sort, price floor and sparkline history.';

GRANT EXECUTE ON FUNCTION public.fab_trending_movers(text, integer, text, numeric, text[], integer) TO anon, authenticated;
