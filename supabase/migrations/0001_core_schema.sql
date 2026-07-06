-- Migration 1: core schema (profiles, plans, subscriptions) — idempotent, safe to re-run
-- Run in the SQL Editor of the GOOD HOURS Supabase project (NOT GrayBrief)

-- profiles: one row per user, auto-created on signup
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  neighborhood text,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

grant select, update on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- plans: JSONB blocks; is_public already present for the future community phase
create table if not exists public.plans (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title      text,
  summary    text,
  location   text,
  plan_date  date,
  ages       jsonb not null default '[]'::jsonb,
  blocks     jsonb not null default '[]'::jsonb,
  pro_tip    text,
  is_public  boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.plans enable row level security;

drop policy if exists "plans_select_own_or_public" on public.plans;
create policy "plans_select_own_or_public" on public.plans
  for select to authenticated using (auth.uid() = profile_id or is_public = true);

drop policy if exists "plans_insert_own" on public.plans;
create policy "plans_insert_own" on public.plans
  for insert to authenticated with check (auth.uid() = profile_id);

drop policy if exists "plans_update_own" on public.plans;
create policy "plans_update_own" on public.plans
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "plans_delete_own" on public.plans;
create policy "plans_delete_own" on public.plans
  for delete to authenticated using (auth.uid() = profile_id);

create index if not exists plans_profile_idx on public.plans (profile_id, created_at desc);
create index if not exists plans_public_idx  on public.plans (is_public, created_at desc);
grant select, insert, update, delete on public.plans to authenticated;

-- subscriptions: written ONLY by the Stripe webhook (service role bypasses RLS).
-- Clients can read their own row; there are intentionally NO write policies.
create table if not exists public.subscriptions (
  profile_id             uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text,
  status                 text,
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);
alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using (auth.uid() = profile_id);

grant select on public.subscriptions to authenticated;
