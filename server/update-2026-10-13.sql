-- Tiny World update: run this whole thing once in the Supabase SQL editor (safe to run again).

-- Tiny World: accounts fix. Run once in the Supabase SQL editor (after accounts.sql).
-- An account's saved progress never goes backwards: a device holding an older copy can't overwrite a newer one.

-- keep the account's progress up to date (with the sign-in token)
create or replace function public.account_save(p_player uuid, p_token uuid, p_profile jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from tw_accounts where player = p_player;
  if a.player is null or a.token <> p_token then return jsonb_build_object('ok', false, 'reason', 'signed out'); end if;
  if length(p_profile::text) > 400000 then return jsonb_build_object('ok', false, 'reason', 'too big'); end if;
  if a.profile_at is not null and a.profile_at > now() - interval '3 seconds' then return jsonb_build_object('ok', false, 'reason', 'slow down'); end if;
  -- never go backwards: a copy older than the one already kept (another device has played since) is refused
  if a.profile is not null and coalesce((a.profile->>'savedAt')::float8, 0) > coalesce((p_profile->>'savedAt')::float8, 0) then
    return jsonb_build_object('ok', false, 'reason', 'older');
  end if;
  update tw_accounts set profile = p_profile, profile_at = now() where player = p_player;
  return jsonb_build_object('ok', true, 'at', now());
end $$;

-- delete my account: the account, its saved progress, its scores and its name (needs the sign-in token)
create or replace function public.account_delete(p_player uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from tw_accounts where player = p_player;
  if a.player is null or a.token <> p_token then return jsonb_build_object('ok', false, 'reason', 'signed out'); end if;
  delete from tw_scores where player = p_player;
  delete from tw_accounts where player = p_player;
  delete from tw_players where player = p_player;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.account_delete(uuid, uuid) to anon;

-- clean-up: two test identities from the developer's testing that reached the live boards (Total XP); removes only them
delete from public.tw_scores      where player in ('75a37b86-d25e-4bf8-838b-07551c613a2e', 'e3c360d7-e914-4369-9b98-1e0e261dac0e');
delete from public.tw_accounts    where player in ('75a37b86-d25e-4bf8-838b-07551c613a2e', 'e3c360d7-e914-4369-9b98-1e0e261dac0e');
delete from public.tw_players     where player in ('75a37b86-d25e-4bf8-838b-07551c613a2e', 'e3c360d7-e914-4369-9b98-1e0e261dac0e');
delete from public.tw_submissions where player in ('75a37b86-d25e-4bf8-838b-07551c613a2e', 'e3c360d7-e914-4369-9b98-1e0e261dac0e');

-- Tiny World: profile pictures. Run once in the Supabase SQL editor (after accounts.sql).
-- An account can set a small square picture (a JPEG/PNG/WebP data URL, at most ~45 KB); the boards show it by the name.

alter table public.tw_players add column if not exists avatar text;

create or replace function public.account_set_avatar(p_player uuid, p_token uuid, p_avatar text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from tw_accounts where player = p_player;
  if a.player is null or a.token <> p_token then return jsonb_build_object('ok', false, 'reason', 'signed out'); end if;
  if p_avatar is not null and (length(p_avatar) > 60000 or p_avatar !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$') then
    return jsonb_build_object('ok', false, 'reason', 'bad picture');
  end if;
  update tw_players set avatar = p_avatar where player = p_player;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.account_set_avatar(uuid, uuid, text) to anon;

-- the boards with each player's picture
create or replace function public.top_scores_v2(p_category text, p_map text, p_limit int)
returns table(rank bigint, name text, value double precision, map text, created_at timestamptz, avatar text)
language sql stable security definer set search_path = public as $$
  select rank() over (order by case when (select higher from tw_category(p_category)) then -s.value else s.value end), s.name, s.value, s.map, s.created_at, p.avatar
  from tw_scores s left join tw_players p on p.player = s.player
  where s.category = p_category and s.map = coalesce(p_map, '') and not s.hidden
  order by 1 limit least(greatest(coalesce(p_limit, 10), 1), 100)
$$;
grant execute on function public.top_scores_v2(text, text, int) to anon;

-- Tiny World: the player count. Everyone who opens the game counts once (by the anonymous player id every visitor
-- gets, whether or not they choose a name); "online now" is everyone seen in the last five minutes.

create table if not exists public.tw_visitors (
  player uuid primary key,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  visits int not null default 1
);
alter table public.tw_visitors enable row level security;
revoke all on public.tw_visitors from anon, authenticated;

-- the players already known (from the boards and names) count too
insert into public.tw_visitors (player, first_seen, last_seen)
  select player, min(created_at), max(created_at) from public.tw_scores group by player
  on conflict do nothing;
insert into public.tw_visitors (player) select player from public.tw_players on conflict do nothing;

-- "I'm here": counts this player (once ever), keeps them online, returns the totals
create or replace function public.hello(p_player uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_player is not null then
    insert into tw_visitors(player) values (p_player)
    on conflict (player) do update set last_seen = now(),
      visits = tw_visitors.visits + case when tw_visitors.last_seen < now() - interval '30 minutes' then 1 else 0 end;
  end if;
  return jsonb_build_object('players', (select count(*) from tw_visitors), 'online', (select count(*) from tw_visitors where last_seen > now() - interval '5 minutes'));
end $$;
grant execute on function public.hello(uuid) to anon;
