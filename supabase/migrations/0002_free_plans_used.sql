-- Migration 2 (addendum): free-preview counter (1 free plan per account before the paywall)
alter table public.profiles
  add column if not exists free_plans_used int not null default 0;
