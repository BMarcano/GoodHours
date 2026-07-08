-- Make someone an admin so they get the visual "Manage featured listings" panel
-- inside the app. One-time; run AFTER they've logged in at least once so their
-- profile exists. Replace the email if needed.
insert into public.admins (profile_id)
select id from auth.users where email = 'ashley@naset.org'
on conflict (profile_id) do nothing;
