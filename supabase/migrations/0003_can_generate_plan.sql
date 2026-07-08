-- Migration 3: server-side plan gating (T6).
-- can_generate_plan: returns true if the profile has an active subscription,
-- otherwise atomically consumes the single free preview (free_plans_used < 1).
-- Called ONLY by /api/generate-plan with the service role key.

create or replace function public.can_generate_plan(p_profile uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.subscriptions
    where profile_id = p_profile and status = 'active'
  ) then
    return true;
  end if;

  update public.profiles
     set free_plans_used = free_plans_used + 1
   where id = p_profile and free_plans_used < 1;

  return found;
end; $$;

revoke execute on function public.can_generate_plan(uuid) from public;
revoke execute on function public.can_generate_plan(uuid) from anon;
revoke execute on function public.can_generate_plan(uuid) from authenticated;
grant execute on function public.can_generate_plan(uuid) to service_role;
