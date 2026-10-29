-- Shared binder page: include the owner's display name so the page can title
-- itself "<name>'s Binder" instead of "Shared Binder".
--
-- Same name order as the app's account label (apps/mobile/lib/core/models/
-- account.dart): a real name beats a handle. Never falls back to email, so an
-- account with no name in its provider metadata stays anonymous (owner_name
-- null) and the page keeps the generic title.

CREATE OR REPLACE FUNCTION private.get_public_binder_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share_user UUID;
  owner_name TEXT;
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

  SELECT COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
    NULLIF(trim(u.raw_user_meta_data->>'preferred_username'), ''),
    NULLIF(trim(u.raw_user_meta_data->>'user_name'), ''),
    NULLIF(trim(u.raw_user_meta_data->>'nickname'), '')
  ) INTO owner_name
  FROM auth.users u
  WHERE u.id = share_user;

  SELECT jsonb_build_object(
    'owner_name', owner_name,
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
