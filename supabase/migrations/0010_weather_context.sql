-- Migration 10: persist the exact forecast snapshot that shaped a generated
-- plan. Nullable keeps every existing plan valid and allows plans beyond the
-- forecast horizon to save normally.

alter table public.plans
  add column if not exists weather_context jsonb;
