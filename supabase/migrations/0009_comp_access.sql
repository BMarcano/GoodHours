-- Migration 9: comped ("unlimited access") accounts, granted from the admin
-- panel instead of the SQL editor. Built for influencers and press.
--
-- The part that matters: access is granted BY EMAIL, whether or not that person
-- has signed up yet. Twice now an email came in before the person registered
-- and there was nothing to attach a subscription to. So the grant is stored in
-- comp_access and handle_new_user() applies it the moment they join.
--
-- A real Stripe subscription is never touched by anything in here — comped rows
-- are the ones with stripe_subscription_id is null, and every write is fenced
-- on that.

create table if not exists public.comp_access (
  email      text primary key,          -- always lowercased, see norm_email()
  note       text,                      -- "influencer — IG @x", who asked, etc.
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.comp_access enable row level security;

-- No policies on purpose: the browser never reads or writes this table
-- directly, only through the security-definer RPCs below (each is_admin gated).
revoke all on public.comp_access from anon;
revoke all on public.comp_access from authenticated;

create or replace function public.norm_email(p text)
returns text language sql immutable as $$
  select lower(btrim(coalesce(p, '')));
$$;

-- ---------------------------------------------------------------- grant ----
-- Returns { registered, applied, already_paying, email } so the panel can tell
-- Ashley exactly what happened — "on now" vs "saved, applies when they sign up".
create or replace function public.admin_grant_access(p_email text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email  text := public.norm_email(p_email);
  v_user   uuid;
  v_paying boolean;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'invalid email';
  end if;

  insert into public.comp_access (email, note, granted_by)
  values (v_email, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  on conflict (email) do update
    set note       = coalesce(excluded.note, comp_access.note),
        granted_by = excluded.granted_by;

  select id into v_user from auth.users where lower(email) = v_email limit 1;
  if v_user is null then
    -- handle_new_user() picks this up at signup
    return jsonb_build_object('registered', false, 'applied', false, 'email', v_email);
  end if;

  select stripe_subscription_id is not null into v_paying
  from public.subscriptions where profile_id = v_user;

  if coalesce(v_paying, false) then
    -- they're already paying; leave Stripe's row exactly as it is
    return jsonb_build_object('registered', true, 'applied', false,
                              'already_paying', true, 'email', v_email);
  end if;

  insert into public.subscriptions (profile_id, plan, status)
  values (v_user, 'comp', 'active')
  on conflict (profile_id) do update
    set plan = 'comp', status = 'active', updated_at = now()
    where subscriptions.stripe_subscription_id is null;

  return jsonb_build_object('registered', true, 'applied', true, 'email', v_email);
end; $$;

-- --------------------------------------------------------------- revoke ----
create or replace function public.admin_revoke_access(p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := public.norm_email(p_email);
  v_user  uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.comp_access where email = v_email;

  select id into v_user from auth.users where lower(email) = v_email limit 1;
  if v_user is not null then
    -- the fence that matters: no Stripe id means nobody is paying for this row,
    -- so it's safe to switch off. A real subscription can never match.
    update public.subscriptions
       set status = 'canceled', updated_at = now()
     where profile_id = v_user
       and stripe_subscription_id is null;
  end if;

  return jsonb_build_object('email', v_email);
end; $$;

-- ----------------------------------------------------------------- list ----
create or replace function public.admin_comp_list()
returns table (
  email      text,
  note       text,
  created_at timestamptz,
  registered boolean,
  active     boolean
) language sql security definer set search_path = public stable as $$
  select c.email,
         c.note,
         c.created_at,
         (u.id is not null)                     as registered,
         coalesce(s.status = 'active', false)   as active
  from public.comp_access c
  left join auth.users u           on lower(u.email) = c.email
  left join public.subscriptions s on s.profile_id = u.id
  where public.is_admin()
  order by c.created_at desc;
$$;

-- ------------------------------------------------- apply on signup ----
-- Same function as migration 1, plus the comp_access lookup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  -- comped ahead of time from the admin panel: switch it on as they join
  if exists (select 1 from public.comp_access where email = lower(new.email)) then
    insert into public.subscriptions (profile_id, plan, status)
    values (new.id, 'comp', 'active')
    on conflict (profile_id) do update
      set plan = 'comp', status = 'active', updated_at = now();
  end if;

  return new;
end; $$;

-- --------------------------------------- signups list: comped vs paying ----
-- Return type changes, so it has to be dropped rather than replaced.
drop function if exists public.admin_users_list();
create or replace function public.admin_users_list()
returns table (
  email        text,
  created_at   timestamptz,
  display_name text,
  neighborhood text,
  is_member    boolean,
  is_comped    boolean,
  plans_count  bigint
) language sql security definer set search_path = public stable as $$
  select u.email::text,
         u.created_at,
         p.display_name,
         p.neighborhood,
         coalesce(s.status = 'active', false) as is_member,
         coalesce(s.status = 'active' and s.stripe_subscription_id is null, false) as is_comped,
         (select count(*) from public.plans pl where pl.profile_id = u.id) as plans_count
  from auth.users u
  left join public.profiles p      on p.id = u.id
  left join public.subscriptions s on s.profile_id = u.id
  where public.is_admin()
  order by u.created_at desc
  limit 1000;
$$;

revoke execute on function public.admin_users_list()               from public, anon;
revoke execute on function public.admin_grant_access(text, text)   from public, anon;
revoke execute on function public.admin_revoke_access(text)        from public, anon;
revoke execute on function public.admin_comp_list()                from public, anon;

grant execute on function public.admin_users_list()             to authenticated;
grant execute on function public.admin_grant_access(text, text) to authenticated;
grant execute on function public.admin_revoke_access(text)      to authenticated;
grant execute on function public.admin_comp_list()              to authenticated;
