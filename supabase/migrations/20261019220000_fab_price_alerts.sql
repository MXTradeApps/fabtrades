-- Price alerts: "tell me when this printing rises to / drops to a price".
--
-- The mobile app writes alerts from a card's detail page and lists them under
-- More. Nothing on the client decides when an alert fires: after the daily
-- price ingest, the `price-alerts` Edge Function calls
-- `fab_fire_price_alerts()`, which stamps every alert whose condition now
-- holds, then pushes a notification to the owner's devices.
--
-- An alert fires once. The owner can re-arm it from the app, which clears
-- `triggered_at`; until then it stays in the list as "Hit".

CREATE TABLE IF NOT EXISTS public.fab_price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES public.fab_cards(id) ON DELETE CASCADE,
  -- 'above' fires at or over the target, 'below' at or under it.
  direction TEXT NOT NULL CHECK (direction IN ('above', 'below')),
  -- The marketplace the target is in: TCGplayer market (USD) or CardMarket
  -- trend (EUR). Matches the price the app shows for the user's setting.
  source TEXT NOT NULL CHECK (source IN ('tcgplayer', 'cardmarket')),
  target_price NUMERIC(10, 2) NOT NULL CHECK (target_price > 0),
  -- Price when the alert was set, so the list can show the move since then.
  price_at_creation NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_at TIMESTAMPTZ,
  triggered_price NUMERIC(10, 2),
  -- Set once a push was attempted, so a re-run of the function never sends
  -- the same alert twice.
  notified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS fab_price_alerts_user_idx
  ON public.fab_price_alerts(user_id, created_at DESC);

-- The sweep only ever reads armed alerts.
CREATE INDEX IF NOT EXISTS fab_price_alerts_armed_idx
  ON public.fab_price_alerts(card_id)
  WHERE triggered_at IS NULL;

ALTER TABLE public.fab_price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own price alerts"
  ON public.fab_price_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own price alerts"
  ON public.fab_price_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id AND triggered_at IS NULL);

CREATE POLICY "Users can update own price alerts"
  ON public.fab_price_alerts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own price alerts"
  ON public.fab_price_alerts FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fab_price_alerts TO authenticated;

-- A per-user cap so one account cannot make the nightly sweep arbitrarily big.
CREATE OR REPLACE FUNCTION private.fab_price_alerts_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.fab_price_alerts WHERE user_id = NEW.user_id) >= 200 THEN
    RAISE EXCEPTION 'price alert limit reached' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER fab_price_alerts_cap
  BEFORE INSERT ON public.fab_price_alerts
  FOR EACH ROW EXECUTE FUNCTION private.fab_price_alerts_cap();

-- Device tokens for push (Firebase Cloud Messaging, which also delivers to iOS
-- through APNs). Keyed on the token: a device that signs into another account
-- moves its token to that account instead of notifying both.
CREATE TABLE IF NOT EXISTS public.fab_push_tokens (
  token TEXT PRIMARY KEY CHECK (char_length(token) BETWEEN 1 AND 4096),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fab_push_tokens_user_idx
  ON public.fab_push_tokens(user_id);

ALTER TABLE public.fab_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push tokens"
  ON public.fab_push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push tokens"
  ON public.fab_push_tokens FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, DELETE ON public.fab_push_tokens TO authenticated;

-- Registering goes through this function rather than an upsert policy: the
-- token is the key, so moving it from a previous account means updating a
-- row the caller does not own, which RLS rightly forbids.
CREATE OR REPLACE FUNCTION public.fab_register_push_token(p_token text, p_platform text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'insufficient_privilege';
  END IF;
  INSERT INTO public.fab_push_tokens (token, user_id, platform, updated_at)
  VALUES (p_token, auth.uid(), p_platform, NOW())
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.fab_register_push_token(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fab_register_push_token(text, text) TO authenticated;

-- The sweep. Uses the same price the app shows: TCGplayer market (falling
-- back to low/mid/high), or CardMarket trend (the foil trend for a foil
-- printing). Returns the alerts it fired on this call (for analytics). Sending
-- is separate: the Edge
-- Function reads every fired alert with no `notified_at`, so a push that failed
-- on one run is retried on the next.
CREATE OR REPLACE FUNCTION public.fab_fire_price_alerts()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  card_id TEXT,
  direction TEXT,
  source TEXT,
  target_price NUMERIC,
  triggered_price NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH current_prices AS (
    SELECT
      a.id AS alert_id,
      CASE a.source
        WHEN 'tcgplayer' THEN coalesce(p.tcg_market, p.tcg_low, p.tcg_mid, p.tcg_high)
        ELSE coalesce(
          CASE WHEN c.is_foil THEN p.cm_trend_foil END,
          p.cm_trend, p.cm_avg, p.cm_low
        )
      END AS price
    FROM public.fab_price_alerts a
    JOIN public.fab_cards c ON c.id = a.card_id
    JOIN public.fab_card_prices p ON p.card_id = a.card_id
    WHERE a.triggered_at IS NULL
  ),
  fired AS (
    UPDATE public.fab_price_alerts a
    SET triggered_at = NOW(), triggered_price = cp.price
    FROM current_prices cp
    WHERE a.id = cp.alert_id
      AND cp.price IS NOT NULL
      AND (
        (a.direction = 'above' AND cp.price >= a.target_price)
        OR (a.direction = 'below' AND cp.price <= a.target_price)
      )
    RETURNING a.id, a.user_id, a.card_id, a.direction, a.source,
      a.target_price, a.triggered_price
  )
  SELECT * FROM fired;
$$;

-- Service role only: a client that could call this could fire anyone's alerts.
REVOKE ALL ON FUNCTION public.fab_fire_price_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fab_fire_price_alerts() TO service_role;

CREATE INDEX IF NOT EXISTS fab_price_alerts_unnotified_idx
  ON public.fab_price_alerts(user_id)
  WHERE triggered_at IS NOT NULL AND notified_at IS NULL;
