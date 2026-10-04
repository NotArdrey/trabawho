-- The landing page features distinct providers, not merely the four newest gigs.
-- This is invoker-scoped so the services RLS policy still controls visibility.
create or replace function public.landing_featured_service_ids(p_limit integer default 4)
returns table(service_id bigint)
language sql stable security invoker set search_path = public as $$
  select latest.id
  from (
    select distinct on (service.seller_id) service.id, service.created_at
    from public.services service
    where service.active = true
    order by service.seller_id, service.created_at desc, service.id desc
  ) latest
  order by latest.created_at desc, latest.id desc
  limit least(greatest(coalesce(p_limit, 4), 1), 12);
$$;

revoke all on function public.landing_featured_service_ids(integer) from public;
grant execute on function public.landing_featured_service_ids(integer) to anon, authenticated;

create index if not exists services_active_seller_recent_idx
  on public.services (seller_id, created_at desc, id desc) where active = true;
