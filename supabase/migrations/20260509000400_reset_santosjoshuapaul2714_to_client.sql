-- ============================================================================
-- SELLER ONBOARDING DATA CONSISTENCY UPDATES
-- ============================================================================
-- Purpose: Align sellers, worker_profiles, and profiles tables so that onboarding
-- data (fullName, bio, serviceType, etc.) is properly reflected across all tables.
--
-- This ensures the "Become A Seller" modal successfully writes data that appears
-- in the My Work page and throughout the seller workspace.
--
-- Safe to run multiple times. Non-destructive (updates only, no deletes).
-- ============================================================================

begin;

-- Sync sellers table to match onboarding values (display_name, tagline, about, search_meta)
update public.sellers
set
  display_name = 'Tutor Testing 123',
  tagline = 'TUTOR TESTING 123',
  about = 'Tutor Testing 123',
  search_meta = jsonb_set(
    coalesce(search_meta, '{}'::jsonb),
    '{name}',
    to_jsonb('Tutor Testing 123'::text),
    true
  ),
  updated_at = now()
where user_id = (
  select user_id
  from public.profiles
  where email = 'santosjoshuapaul2713@gmail.com'
);

-- Sync profiles table to match onboarding full_name
update public.profiles
set
  full_name = 'Tutor Testing 123',
  is_worker = true,
  role = 'worker',
  updated_at = now()
where email = 'santosjoshuapaul2713@gmail.com';

-- Sync worker_profiles table to ensure bio and settings are consistent
update public.worker_profiles
set
  bio = coalesce(bio, 'Tutor Testing 123'),
  updated_at = now()
where user_id = (
  select user_id
  from public.profiles
  where email = 'santosjoshuapaul2713@gmail.com'
);

commit;