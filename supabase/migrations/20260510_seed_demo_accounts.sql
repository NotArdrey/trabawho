-- Confirmed demo accounts for development and E2E runs.
-- Password for both accounts: pass123

create extension if not exists pgcrypto with schema extensions;

with desired_users as (
  select *
  from (
    values
      (
        '00000000-0000-4000-8000-000000000101'::uuid,
        'demo.user@trabawho.test'::text,
        'Demo User'::text,
        'client'::text,
        'Demo'::text,
        null::text,
        'User'::text
      ),
      (
        '00000000-0000-4000-8000-000000000102'::uuid,
        'demo.admin@trabawho.test'::text,
        'Demo Admin'::text,
        'admin'::text,
        'Demo'::text,
        null::text,
        'Admin'::text
      )
  ) as rows(target_id, email, full_name, app_role, first_name, middle_name, last_name)
),
resolved_users as (
  select
    coalesce(existing.id, desired_users.target_id) as id,
    desired_users.email,
    desired_users.full_name,
    desired_users.app_role,
    desired_users.first_name,
    desired_users.middle_name,
    desired_users.last_name
  from desired_users
  left join auth.users existing
    on lower(existing.email::text) = lower(desired_users.email)
),
upserted_users as (
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    email_change_confirm_status,
    phone_change,
    phone_change_token,
    reauthentication_token,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_super_admin,
    is_sso_user,
    is_anonymous
  )
  select
    '00000000-0000-0000-0000-000000000000'::uuid,
    id,
    'authenticated',
    'authenticated',
    email,
    extensions.crypt('pass123', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    0,
    '',
    '',
    '',
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object(
      'full_name', full_name,
      'first_name', first_name,
      'middle_name', middle_name,
      'last_name', last_name,
      'role', app_role,
      'email_verified', true
    ),
    now(),
    now(),
    false,
    false,
    false
  from resolved_users
  on conflict (id) do update set
    aud = excluded.aud,
    role = excluded.role,
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    confirmation_token = excluded.confirmation_token,
    recovery_token = excluded.recovery_token,
    email_change = excluded.email_change,
    email_change_token_new = excluded.email_change_token_new,
    email_change_token_current = excluded.email_change_token_current,
    email_change_confirm_status = excluded.email_change_confirm_status,
    phone_change = excluded.phone_change,
    phone_change_token = excluded.phone_change_token,
    reauthentication_token = excluded.reauthentication_token,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now(),
    is_sso_user = false,
    is_anonymous = false
  returning id, email
),
identity_rows as (
  select
    case
      when resolved_users.email = 'demo.user@trabawho.test'
        then '00000000-0000-4000-8000-000000000201'::uuid
      else '00000000-0000-4000-8000-000000000202'::uuid
    end as identity_id,
    resolved_users.id,
    resolved_users.email,
    resolved_users.full_name,
    resolved_users.app_role
  from resolved_users
)
insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  identity_id,
  id::text,
  id,
  jsonb_build_object(
    'sub', id::text,
    'email', email,
    'email_verified', true,
    'full_name', full_name,
    'role', app_role
  ),
  'email',
  now(),
  now(),
  now()
from identity_rows
on conflict (provider_id, provider) do update set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();

do $$
declare
  has_profile_id boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
  ) into has_profile_id;

  if has_profile_id then
    execute $profiles$
      with profile_rows as (
        select
          users.id,
          users.email,
          desired.full_name,
          desired.app_role,
          desired.first_name,
          desired.middle_name,
          desired.last_name
        from (
          values
            ('demo.user@trabawho.test'::text, 'Demo User'::text, 'client'::text, 'Demo'::text, null::text, 'User'::text),
            ('demo.admin@trabawho.test'::text, 'Demo Admin'::text, 'admin'::text, 'Demo'::text, null::text, 'Admin'::text)
        ) as desired(email, full_name, app_role, first_name, middle_name, last_name)
        join auth.users users
          on lower(users.email::text) = lower(desired.email)
      )
      insert into public.profiles (
        id,
        user_id,
        email,
        first_name,
        middle_name,
        last_name,
        full_name,
        role,
        account_status,
        is_client,
        is_worker,
        province,
        city,
        barangay,
        address,
        created_at,
        updated_at
      )
      select
        id,
        id,
        email,
        first_name,
        middle_name,
        last_name,
        full_name,
        app_role,
        'active',
        true,
        false,
        'Bulacan',
        'Meycauayan',
        'Poblacion',
        'Demo Address',
        now(),
        now()
      from profile_rows
      on conflict (user_id) do update set
        email = excluded.email,
        first_name = excluded.first_name,
        middle_name = excluded.middle_name,
        last_name = excluded.last_name,
        full_name = excluded.full_name,
        role = excluded.role,
        account_status = 'active',
        is_client = true,
        is_worker = excluded.is_worker,
        province = excluded.province,
        city = excluded.city,
        barangay = excluded.barangay,
        address = excluded.address,
        updated_at = now()
    $profiles$;
  else
    execute $profiles$
      with profile_rows as (
        select
          users.id,
          users.email,
          desired.full_name,
          desired.app_role,
          desired.first_name,
          desired.middle_name,
          desired.last_name
        from (
          values
            ('demo.user@trabawho.test'::text, 'Demo User'::text, 'client'::text, 'Demo'::text, null::text, 'User'::text),
            ('demo.admin@trabawho.test'::text, 'Demo Admin'::text, 'admin'::text, 'Demo'::text, null::text, 'Admin'::text)
        ) as desired(email, full_name, app_role, first_name, middle_name, last_name)
        join auth.users users
          on lower(users.email::text) = lower(desired.email)
      )
      insert into public.profiles (
        user_id,
        email,
        first_name,
        middle_name,
        last_name,
        full_name,
        role,
        account_status,
        is_client,
        is_worker,
        province,
        city,
        barangay,
        address,
        created_at,
        updated_at
      )
      select
        id,
        email,
        first_name,
        middle_name,
        last_name,
        full_name,
        app_role,
        'active',
        true,
        false,
        'Bulacan',
        'Meycauayan',
        'Poblacion',
        'Demo Address',
        now(),
        now()
      from profile_rows
      on conflict (user_id) do update set
        email = excluded.email,
        first_name = excluded.first_name,
        middle_name = excluded.middle_name,
        last_name = excluded.last_name,
        full_name = excluded.full_name,
        role = excluded.role,
        account_status = 'active',
        is_client = true,
        is_worker = excluded.is_worker,
        province = excluded.province,
        city = excluded.city,
        barangay = excluded.barangay,
        address = excluded.address,
        updated_at = now()
    $profiles$;
  end if;
end $$;
