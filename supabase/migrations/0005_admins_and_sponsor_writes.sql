-- Migration 5: admin role + in-app sponsor management (T7 visual admin).
-- Lets an owner (Ashley) manage featured listings from a visual panel inside
-- the app instead of the Supabase dashboard. admins allowlist + is_admin()
-- gate; sponsors gets admin-only write policies.

create table if not exists public.admins (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- security-definer so it reads the admins table without recursing through RLS
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admins where profile_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admins_select_own" on public.admins;
create policy "admins_select_own" on public.admins
  for select to authenticated using (profile_id = auth.uid());
grant select on public.admins to authenticated;

-- sponsors: admins get full read + write from the app.
-- (regular users keep the existing read-active-only policy from migration 4)
drop policy if exists "sponsors_admin_select" on public.sponsors;
create policy "sponsors_admin_select" on public.sponsors
  for select to authenticated using (public.is_admin());

drop policy if exists "sponsors_admin_insert" on public.sponsors;
create policy "sponsors_admin_insert" on public.sponsors
  for insert to authenticated with check (public.is_admin());

drop policy if exists "sponsors_admin_update" on public.sponsors;
create policy "sponsors_admin_update" on public.sponsors
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sponsors_admin_delete" on public.sponsors;
create policy "sponsors_admin_delete" on public.sponsors
  for delete to authenticated using (public.is_admin());

grant insert, update, delete on public.sponsors to authenticated;
