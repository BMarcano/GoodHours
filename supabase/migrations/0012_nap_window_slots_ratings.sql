-- Migration 12: three small "it gets my family" features.
--   • profiles.nap_window  — set once, every plan works around it
--   • plans.slots          — the hours a plan was built for, so "Run it back"
--                            can rebuild a saved plan for today
--   • venue_ratings        — one-tap 👍/👎 per stop after the day. Collected
--                            now, displayed later ("rated 👍 by 12 families").
--
-- Run in the SQL Editor of the GOOD HOURS Supabase project (NOT GrayBrief).
-- Idempotent, safe to re-run.

alter table public.profiles add column if not exists nap_window text;
alter table public.plans    add column if not exists slots jsonb;

create table if not exists public.venue_ratings (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  plan_id     uuid not null references public.plans (id) on delete cascade,
  block_index int  not null,
  venue       text,                       -- copied from the block so ratings survive plan edits
  activity    text,
  rating      smallint not null check (rating in (1, -1)),
  created_at  timestamptz not null default now(),
  unique (profile_id, plan_id, block_index)
);
alter table public.venue_ratings enable row level security;

drop policy if exists "venue_ratings_select_own" on public.venue_ratings;
create policy "venue_ratings_select_own" on public.venue_ratings
  for select to authenticated using (auth.uid() = profile_id);

drop policy if exists "venue_ratings_insert_own" on public.venue_ratings;
create policy "venue_ratings_insert_own" on public.venue_ratings
  for insert to authenticated with check (auth.uid() = profile_id);

drop policy if exists "venue_ratings_update_own" on public.venue_ratings;
create policy "venue_ratings_update_own" on public.venue_ratings
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "venue_ratings_delete_own" on public.venue_ratings;
create policy "venue_ratings_delete_own" on public.venue_ratings
  for delete to authenticated using (auth.uid() = profile_id);

create index if not exists venue_ratings_profile_idx on public.venue_ratings (profile_id, created_at desc);
create index if not exists venue_ratings_venue_idx   on public.venue_ratings (venue);
grant select, insert, update, delete on public.venue_ratings to authenticated;
