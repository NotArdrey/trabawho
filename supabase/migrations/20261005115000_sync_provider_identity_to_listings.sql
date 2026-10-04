-- Provider photos and identity verification belong to the account, not a gig.
-- Keep the public sellers row current even when Didit/admin updates profiles
-- outside of the normal service-creation flow.
create or replace function public.sync_seller_account_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  account public.profiles%rowtype;
begin
  select * into account from public.profiles where user_id = new.user_id;
  if found then
    new.is_verified := account.is_verified;
    if nullif(btrim(coalesce(account.profile_photo, '')), '') is not null then
      new.profile_photo := account.profile_photo;
      new.avatar_url := account.profile_photo;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sellers_account_identity on public.sellers;
create trigger sellers_account_identity
before insert or update on public.sellers
for each row execute function public.sync_seller_account_identity();

create or replace function public.sync_profile_identity_to_seller()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.sellers
  set is_verified = new.is_verified,
      profile_photo = coalesce(nullif(btrim(new.profile_photo), ''), profile_photo),
      avatar_url = coalesce(nullif(btrim(new.profile_photo), ''), avatar_url)
  where user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists profiles_sync_seller_identity on public.profiles;
create trigger profiles_sync_seller_identity
after update of profile_photo, is_verified on public.profiles
for each row
when (old.profile_photo is distinct from new.profile_photo or old.is_verified is distinct from new.is_verified)
execute function public.sync_profile_identity_to_seller();

update public.sellers seller
set is_verified = profile.is_verified,
    profile_photo = coalesce(nullif(btrim(profile.profile_photo), ''), seller.profile_photo),
    avatar_url = coalesce(nullif(btrim(profile.profile_photo), ''), seller.avatar_url)
from public.profiles profile
where profile.user_id = seller.user_id
  and (seller.is_verified is distinct from profile.is_verified
    or (nullif(btrim(profile.profile_photo), '') is not null
      and (seller.profile_photo is distinct from profile.profile_photo
        or seller.avatar_url is distinct from profile.profile_photo)));
