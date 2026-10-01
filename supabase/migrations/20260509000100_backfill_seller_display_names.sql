-- Backfill seller display names and searchable name metadata from profile data.
-- This repairs older seller rows that were created with NULL display_name.

begin;

with resolved_names as (
  select
    s.user_id,
    coalesce(
      nullif(btrim(s.display_name), ''),
      nullif(btrim(s.search_meta ->> 'name'), ''),
      nullif(btrim(p.full_name), ''),
      nullif(btrim(concat_ws(' ', p.first_name, p.middle_name, p.last_name)), ''),
      nullif(split_part(coalesce(p.email, ''), '@', 1), ''),
      'TrabaWho User'
    ) as resolved_display_name,
    coalesce(s.search_meta, '{}'::jsonb) as current_search_meta
  from public.sellers s
  join public.profiles p on p.user_id = s.user_id
)
update public.sellers s
set
  display_name = resolved_names.resolved_display_name,
  search_meta = jsonb_set(
    resolved_names.current_search_meta,
    '{name}',
    to_jsonb(resolved_names.resolved_display_name),
    true
  ),
  updated_at = now()
from resolved_names
where s.user_id = resolved_names.user_id
  and (
    s.display_name is null
    or btrim(s.display_name) = ''
    or nullif(btrim(s.search_meta ->> 'name'), '') is null
  );

commit;