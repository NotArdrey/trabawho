alter table public.reviews
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-images',
  'review-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Review images are publicly viewable" on storage.objects;
create policy "Review images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'review-images');

drop policy if exists "Users can upload own review images" on storage.objects;
create policy "Users can upload own review images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'review-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update own review images" on storage.objects;
create policy "Users can update own review images"
  on storage.objects for update to authenticated
  using (bucket_id = 'review-images' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'review-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete own review images" on storage.objects;
create policy "Users can delete own review images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'review-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own"
  on public.reviews for update to authenticated
  using (auth.uid() = reviewer_id)
  with check (auth.uid() = reviewer_id);
