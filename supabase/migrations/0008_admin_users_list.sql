-- Migration 8: owner dashboard — see signups from inside the app.
-- Emails live in auth.users, which the browser can never read directly. This
-- security-definer function exposes them to admins ONLY: the is_admin() gate in
-- the WHERE clause means a non-admin gets zero rows, never a leak.

create or replace function public.admin_users_list()
returns table (
  email        text,
  created_at   timestamptz,
  display_name text,
  neighborhood text,
  is_member    boolean,
  plans_count  bigint
) language sql security definer set search_path = public stable as $$
  select u.email::text,
         u.created_at,
         p.display_name,
         p.neighborhood,
         coalesce(s.status = 'active', false) as is_member,
         (select count(*) from public.plans pl where pl.profile_id = u.id) as plans_count
  from auth.users u
  left join public.profiles p      on p.id = u.id
  left join public.subscriptions s on s.profile_id = u.id
  where public.is_admin()
  order by u.created_at desc
  limit 1000;
$$;

revoke execute on function public.admin_users_list() from public;
revoke execute on function public.admin_users_list() from anon;
grant execute on function public.admin_users_list() to authenticated;
