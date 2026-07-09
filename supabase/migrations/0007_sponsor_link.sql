-- Migration 7: give featured listings a destination for the "Claim offer" button.
alter table public.sponsors add column if not exists link_url text;
