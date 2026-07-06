-- Tester unlock: grants full access until Stripe lands.
-- Run AFTER each person has logged in at least once (so their profile exists).
-- Replace ASHLEY_EMAIL_HERE with the real email before running.
insert into public.subscriptions (profile_id, plan, status)
select id, 'year', 'active'
from auth.users
where email in ('brayanmarcanor@gmail.com', 'ASHLEY_EMAIL_HERE')
on conflict (profile_id) do update
  set status = 'active', plan = excluded.plan, updated_at = now();
