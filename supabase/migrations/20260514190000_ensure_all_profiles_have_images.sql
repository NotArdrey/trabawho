create or replace function public.default_profile_image_url(p_user_id uuid)
returns text
language sql
immutable
set search_path = public
as $$
  select 'https://api.dicebear.com/9.x/initials/svg?seed='
    || p_user_id::text
    || '&backgroundColor=2563eb,059669,f59e0b,dc2626,7c3aed&fontColor=ffffff&fontWeight=700';
$$;

create or replace function public.ensure_profile_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(coalesce(new.profile_photo, '')), '') is null then
    new.profile_photo := public.default_profile_image_url(new.user_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ensure_profile_photo on public.profiles;
create trigger trg_ensure_profile_photo
  before insert or update of profile_photo on public.profiles
  for each row
  execute function public.ensure_profile_photo();

insert into public.profiles (
  user_id,
  email,
  full_name,
  first_name,
  middle_name,
  last_name,
  role,
  account_status,
  is_client,
  is_worker,
  profile_photo,
  created_at,
  updated_at
)
select
  u.id,
  lower(u.email),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    split_part(u.email, '@', 1),
    'TrabaWho User'
  ) as full_name,
  split_part(
    coalesce(
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(u.email, '@', 1),
      'TrabaWho User'
    ),
    ' ',
    1
  ) as first_name,
  null as middle_name,
  null as last_name,
  'client' as role,
  'active' as account_status,
  true as is_client,
  false as is_worker,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'profile_photo', ''),
    nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
    public.default_profile_image_url(u.id)
  ) as profile_photo,
  coalesce(u.created_at, now()) as created_at,
  now() as updated_at
from auth.users u
where u.deleted_at is null
  and u.email is not null
  and not exists (
    select 1
    from public.profiles p
    where p.user_id = u.id
  );

update public.profiles p
set
  profile_photo = public.default_profile_image_url(p.user_id),
  updated_at = now()
where nullif(btrim(coalesce(p.profile_photo, '')), '') is null;

comment on function public.default_profile_image_url(uuid) is
  'Returns a deterministic default profile image URL for TrabaWho profiles without uploaded photos.';
