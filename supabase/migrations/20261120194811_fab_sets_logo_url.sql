-- Set logos move out of the bundled setLogos.json and onto the set row, with our
-- own copies of the image files in Storage. Additive only: older clients select
-- named columns from fab_sets and keep using their bundled logo list.
alter table public.fab_sets
  add column if not exists logo_url text;

comment on column public.fab_sets.logo_url is
  'Public URL of the set logo (normally in the set-logos bucket). Null when no logo is known; clients fall back to their bundled list, then the set name. Filled by the price pipeline, which never overwrites a non-null value.';

-- Public read through the storage public URL; only the service role writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('set-logos', 'set-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
