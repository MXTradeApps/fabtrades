-- Multi-Binder grid: first-class Binder records plus binder_id on owned entries.
--
-- Pre-feature binder_entries were one owned pile (UNIQUE user_id, card_id,
-- is_wanted). Copies could not live in two Binders, names could not persist, and
-- Trade Binder had no stable role. This migration adds public.binders and
-- scopes owned rows to a Binder. Want List stays is_wanted with binder_id null.
--
-- Entry identity is stored as client_id so PostgREST upsert can conflict on
-- (user_id, client_id) including tombstones. Partial unique indexes enforce
-- live product uniqueness (owned: printing + binder + condition; want: printing).

-- ---------------------------------------------------------------------------
-- Binders
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.binders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('trade', 'standard')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Client-supplied. Last-write-wins merge depends on this, not server now().
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (user_id, client_id)
);

ALTER TABLE public.binders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own binders"
  ON public.binders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own binders"
  ON public.binders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own binders"
  ON public.binders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own binders"
  ON public.binders FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS binders_user_id_updated_at_idx
  ON public.binders(user_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS binders_user_live_name_idx
  ON public.binders (user_id, lower(btrim(name)))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS binders_one_trade_idx
  ON public.binders (user_id)
  WHERE role = 'trade' AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- binder_entries: binder_id + client_id identity
-- ---------------------------------------------------------------------------

ALTER TABLE public.binder_entries
  ADD COLUMN IF NOT EXISTS binder_id TEXT,
  ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Seed defaults for anyone who already has binder data (entries or a share).
INSERT INTO public.binders (user_id, client_id, name, role, created_at, updated_at)
SELECT src.user_id, 'system:trade', 'Trade Binder', 'trade', NOW(), NOW()
FROM (
  SELECT user_id FROM public.binder_entries
  UNION
  SELECT user_id FROM public.binder_shares
) src
ON CONFLICT (user_id, client_id) DO NOTHING;

INSERT INTO public.binders (user_id, client_id, name, role, created_at, updated_at)
SELECT src.user_id, 'system:collection', 'Collection', 'standard', NOW(), NOW()
FROM (
  SELECT user_id FROM public.binder_entries
  UNION
  SELECT user_id FROM public.binder_shares
) src
ON CONFLICT (user_id, client_id) DO NOTHING;

UPDATE public.binder_entries
SET binder_id = 'system:trade'
WHERE is_wanted = FALSE
  AND (binder_id IS NULL OR btrim(binder_id) = '');

UPDATE public.binder_entries
SET client_id = CASE
  WHEN is_wanted THEN 'want|' || card_id
  ELSE 'binder|' || binder_id || '|' || card_id || '|' || condition
END
WHERE client_id IS NULL;

ALTER TABLE public.binder_entries
  ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE public.binder_entries
  DROP CONSTRAINT IF EXISTS binder_entries_user_id_card_id_is_wanted_key;

ALTER TABLE public.binder_entries
  DROP CONSTRAINT IF EXISTS binder_entries_user_client_id_key;

ALTER TABLE public.binder_entries
  ADD CONSTRAINT binder_entries_user_client_id_key UNIQUE (user_id, client_id);

CREATE UNIQUE INDEX IF NOT EXISTS binder_entries_owned_live_idx
  ON public.binder_entries (user_id, card_id, binder_id, condition)
  WHERE is_wanted = FALSE AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS binder_entries_want_live_idx
  ON public.binder_entries (user_id, card_id)
  WHERE is_wanted = TRUE AND deleted_at IS NULL;

ALTER TABLE public.binder_entries
  DROP CONSTRAINT IF EXISTS binder_entries_binder_id_wanted_check;

ALTER TABLE public.binder_entries
  ADD CONSTRAINT binder_entries_binder_id_wanted_check
  CHECK (
    (is_wanted AND binder_id IS NULL)
    OR (NOT is_wanted AND binder_id IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- Public share: Trade Binder only (do not leak Collection)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.get_public_binder_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share_user UUID;
  result jsonb;
BEGIN
  IF p_token IS NULL OR char_length(trim(p_token)) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT user_id INTO share_user
  FROM public.binder_shares
  WHERE token = trim(p_token)
    AND is_enabled = TRUE;

  IF share_user IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'entries', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'card_id', be.card_id,
            'quantity', be.quantity,
            'condition', be.condition,
            'card', be.card,
            'added_at', be.added_at,
            'updated_at', be.updated_at
          )
          ORDER BY be.added_at DESC
        )
        FROM public.binder_entries be
        INNER JOIN public.binders b
          ON b.user_id = be.user_id
         AND b.client_id = be.binder_id
         AND b.role = 'trade'
         AND b.deleted_at IS NULL
        WHERE be.user_id = share_user
          AND be.is_wanted = FALSE
          AND be.deleted_at IS NULL
      ),
      '[]'::jsonb
    )
  ) INTO result;

  RETURN result;
END;
$$;
