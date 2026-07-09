-- Migration 6: light community (T8 / Milestone 3).
-- Real public plans as the feed, likes, comments, admin moderation, and a
-- community on/off toggle the owner flips from the in-app admin panel.
-- Meetups, verified badges and selfie verification are a FUTURE phase.

-- ---- likes ----
create table if not exists public.plan_likes (
  plan_id    uuid not null references public.plans (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, profile_id)
);
alter table public.plan_likes enable row level security;

drop policy if exists "plan_likes_select_all" on public.plan_likes;
create policy "plan_likes_select_all" on public.plan_likes
  for select to authenticated using (true);

drop policy if exists "plan_likes_insert_own" on public.plan_likes;
create policy "plan_likes_insert_own" on public.plan_likes
  for insert to authenticated with check (auth.uid() = profile_id);

drop policy if exists "plan_likes_delete_own" on public.plan_likes;
create policy "plan_likes_delete_own" on public.plan_likes
  for delete to authenticated using (auth.uid() = profile_id);

grant select, insert, delete on public.plan_likes to authenticated;

-- ---- comments ----
create table if not exists public.plan_comments (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.plans (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
alter table public.plan_comments enable row level security;

drop policy if exists "plan_comments_select_all" on public.plan_comments;
create policy "plan_comments_select_all" on public.plan_comments
  for select to authenticated using (true);

drop policy if exists "plan_comments_insert_own" on public.plan_comments;
create policy "plan_comments_insert_own" on public.plan_comments
  for insert to authenticated with check (auth.uid() = profile_id);

-- own comment, or any comment if you're an admin (moderation)
drop policy if exists "plan_comments_delete_own_or_admin" on public.plan_comments;
create policy "plan_comments_delete_own_or_admin" on public.plan_comments
  for delete to authenticated using (auth.uid() = profile_id or public.is_admin());

grant select, insert, delete on public.plan_comments to authenticated;
create index if not exists plan_comments_plan_idx on public.plan_comments (plan_id, created_at);

-- ---- admin moderation: unpublish any public plan (removes it from the feed,
--      keeps the owner's private copy) ----
drop policy if exists "plans_admin_update" on public.plans;
create policy "plans_admin_update" on public.plans
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- community on/off toggle (single row, admin-writable) ----
create table if not exists public.app_config (
  id             int primary key default 1,
  community_live boolean not null default false,
  updated_at     timestamptz not null default now(),
  constraint app_config_singleton check (id = 1)
);
insert into public.app_config (id, community_live) values (1, false)
  on conflict (id) do nothing;
alter table public.app_config enable row level security;

drop policy if exists "app_config_select_all" on public.app_config;
create policy "app_config_select_all" on public.app_config
  for select to authenticated using (true);

drop policy if exists "app_config_update_admin" on public.app_config;
create policy "app_config_update_admin" on public.app_config
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, update on public.app_config to authenticated;

-- ---- feed: public plans + author display_name/neighborhood (NEVER email) ----
create or replace function public.community_feed()
returns table (
  id uuid, title text, summary text, location text, plan_date date,
  ages jsonb, blocks jsonb, pro_tip text, created_at timestamptz,
  author_name text, author_neighborhood text, author_id uuid,
  like_count bigint, liked_by_me boolean, comment_count bigint
) language sql security definer set search_path = public stable as $$
  select p.id, p.title, p.summary, p.location, p.plan_date,
         p.ages, p.blocks, p.pro_tip, p.created_at,
         coalesce(nullif(trim(pr.display_name), ''), 'A parent') as author_name,
         pr.neighborhood as author_neighborhood,
         p.profile_id as author_id,
         (select count(*) from plan_likes l where l.plan_id = p.id) as like_count,
         exists (select 1 from plan_likes l where l.plan_id = p.id and l.profile_id = auth.uid()) as liked_by_me,
         (select count(*) from plan_comments c where c.plan_id = p.id) as comment_count
  from plans p
  join profiles pr on pr.id = p.profile_id
  where p.is_public = true
  order by p.created_at desc
  limit 100;
$$;
grant execute on function public.community_feed() to authenticated;

-- ---- comments for a plan + author display_name (NEVER email) ----
create or replace function public.plan_comments_for(p_plan_id uuid)
returns table (id uuid, body text, created_at timestamptz, author_name text, author_id uuid)
language sql security definer set search_path = public stable as $$
  select c.id, c.body, c.created_at,
         coalesce(nullif(trim(pr.display_name), ''), 'A parent') as author_name,
         c.profile_id as author_id
  from plan_comments c
  join profiles pr on pr.id = c.profile_id
  where c.plan_id = p_plan_id
  order by c.created_at asc;
$$;
grant execute on function public.plan_comments_for(uuid) to authenticated;
