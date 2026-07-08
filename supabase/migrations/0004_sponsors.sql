-- Migration 4: featured listings (T7 / Milestone 2).
-- sponsors: local kids' businesses that pay for placement. Read-only to
-- authenticated users (only active rows). Ashley adds/edits/removes rows
-- manually from the Supabase dashboard (service role bypasses RLS); there are
-- intentionally NO client write policies.

create table if not exists public.sponsors (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  neighborhood text,
  pitch        text,
  ages         text,
  offer_label  text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table public.sponsors enable row level security;

drop policy if exists "sponsors_select_active" on public.sponsors;
create policy "sponsors_select_active" on public.sponsors
  for select to authenticated using (active = true);

grant select on public.sponsors to authenticated;

create index if not exists sponsors_active_idx on public.sponsors (active, created_at desc);
