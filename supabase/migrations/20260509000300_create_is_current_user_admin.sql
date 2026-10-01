-- Migration: create is_current_user_admin() and ensure safe profiles SELECT policy
-- Run this in the Supabase SQL editor as the project SQL migration.

begin;

-- Create helper to check whether the caller is an active admin.
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.account_status, 'active') = 'active'
  );
$$;

-- Replace policies to use the helper function (idempotent)
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles
  for select
  using (auth.uid() = user_id or public.is_current_user_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles
  for update
  using (auth.uid() = user_id or public.is_current_user_admin())
  with check (auth.uid() = user_id or public.is_current_user_admin());

commit;

-- Note: this function is SECURITY DEFINER so it can safely read `public.profiles`
-- without causing recursive RLS evaluation when called from policies.
