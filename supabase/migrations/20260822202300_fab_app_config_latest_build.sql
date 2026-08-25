-- Soft update prompts compare CFBundleVersion / versionCode as well as the
-- marketing version, so a new TestFlight or Play build of the same 1.0.x
-- can still nudge older installs.

ALTER TABLE public.fab_app_config
  ADD COLUMN IF NOT EXISTS latest_build text;
