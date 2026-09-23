-- Migration 11: Save Inbox — spots a family saves from anywhere (an Instagram
-- screenshot, a pasted link, a few typed words). /api/extract-spot turns the
-- capture into structured fields; /api/generate-plan reads the rows back and
-- weaves the ones that fit into the day ("⭐ Your save").
--
-- Run in the SQL Editor of the GOOD HOURS Supabase project (NOT GrayBrief).
-- Idempotent, safe to re-run.

create table if not exists public.saved_spots (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  name         text not null default 'Saved spot',
  description  text,                       -- one line: what it is / why it caught their eye
  address      text,                       -- street address or neighborhood, as found
  event_name   text,                       -- only when the save is a dated happening
  event_date   date,                       -- null = evergreen venue (a park, a cafe, a museum)
  event_time   text,                       -- free text as found: "10 AM", "6–8 PM"
  price        text,                       -- free text as found: "Free", "$15"
  source_url   text,
  source_type  text not null default 'text'
               check (source_type in ('link', 'screenshot', 'text')),
  raw_source   text,                       -- what they pasted / typed, or a screenshot note
  confidence   text not null default 'low'
               check (confidence in ('high', 'low')),
  extracted    jsonb,                      -- the model's full answer, kept for debugging
  created_at   timestamptz not null default now()
);
alter table public.saved_spots enable row level security;

drop policy if exists "saved_spots_select_own" on public.saved_spots;
create policy "saved_spots_select_own" on public.saved_spots
  for select to authenticated using (auth.uid() = profile_id);

drop policy if exists "saved_spots_insert_own" on public.saved_spots;
create policy "saved_spots_insert_own" on public.saved_spots
  for insert to authenticated with check (auth.uid() = profile_id);

drop policy if exists "saved_spots_update_own" on public.saved_spots;
create policy "saved_spots_update_own" on public.saved_spots
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "saved_spots_delete_own" on public.saved_spots;
create policy "saved_spots_delete_own" on public.saved_spots
  for delete to authenticated using (auth.uid() = profile_id);

create index if not exists saved_spots_profile_idx on public.saved_spots (profile_id, created_at desc);
grant select, insert, update, delete on public.saved_spots to authenticated;
