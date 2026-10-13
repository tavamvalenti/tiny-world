-- Tiny World: invite friends. Run once in the Supabase SQL editor (after accounts.sql, players.sql, avatars.sql).
--
-- Every player has a short referral code (tavamadethis.com/?ref=CODE). A friend counts for you when:
--   1. they open your link and create a NEW account (their player id first seen in the last 7 days, never an
--      account before), and
--   2. they actually play a little: their account's saved progress reaches 300 XP (checked here, as it's saved).
-- Never yourself, never someone on the same internet connection as you (compared by a salted fingerprint of the
-- address, never the address itself), each friend once, at most 10 new referrals per referrer per day.
-- Rewards (the game pays them in Cash, once each, recorded here so they can't be claimed twice from any device):
--   share  ($3,000)  your first qualifying friend
--   five   ($10,000) five qualifying friends
-- Honest limits: the counting and the one-time rewards are decided here; Cash itself lives in the player's profile
-- (as the rest of the economy does). Someone determined enough (different connections, real play to 300 XP each)
-- can still farm it slowly; this makes casual abuse pointless, not impossible.

alter table public.tw_visitors add column if not exists net text;           -- salted fingerprint of the connection

create table if not exists public.tw_ref_codes (
  player uuid primary key,
  code text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.tw_referrals (
  referred uuid primary key,                     -- each new account can be referred once, ever
  referrer uuid not null,
  created_at timestamptz not null default now(),
  qualified_at timestamptz
);
create index if not exists tw_referrals_referrer on public.tw_referrals (referrer);
create table if not exists public.tw_ref_rewards (
  player uuid not null,
  kind text not null,
  amount int not null,
  claimed_at timestamptz not null default now(),
  primary key (player, kind)
);
alter table public.tw_ref_codes enable row level security;
alter table public.tw_referrals enable row level security;
alter table public.tw_ref_rewards enable row level security;
revoke all on public.tw_ref_codes, public.tw_referrals, public.tw_ref_rewards from anon, authenticated;

-- the connection fingerprint for this request (salted hash of the first forwarded address)
create or replace function public.tw_net() returns text language sql stable as $$
  select case when x = '' then null else md5('tiny-world-net-' || x) end
  from (select btrim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)) as x) h
$$;

-- "I'm here" now also notes the connection fingerprint (for the same-connection rule)
create or replace function public.hello(p_player uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_player is not null then
    insert into tw_visitors(player, net) values (p_player, tw_net())
    on conflict (player) do update set last_seen = now(), net = coalesce(tw_net(), tw_visitors.net),
      visits = tw_visitors.visits + case when tw_visitors.last_seen < now() - interval '30 minutes' then 1 else 0 end;
  end if;
  return jsonb_build_object('players', (select count(*) from tw_visitors), 'online', (select count(*) from tw_visitors where last_seen > now() - interval '5 minutes'));
end $$;

-- my code (made the first time it's asked for)
create or replace function public.ref_code(p_player uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c text; tries int := 0;
begin
  if p_player is null then return jsonb_build_object('ok', false); end if;
  select code into c from tw_ref_codes where player = p_player;
  while c is null and tries < 8 loop
    begin
      c := upper(substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=0O1Il', ''), 1, 7));
      if length(c) < 6 then c := null; tries := tries + 1; continue; end if;
      insert into tw_ref_codes(player, code) values (p_player, c);
    exception when unique_violation then c := null; tries := tries + 1;
    end;
  end loop;
  return jsonb_build_object('ok', c is not null, 'code', c);
end $$;

-- a new account says who sent them (right after it's created): checked, then recorded once
create or replace function public.ref_attach(p_player uuid, p_token uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; who uuid; v record; rv record; today int;
begin
  select * into a from tw_accounts where player = p_player;
  if a.player is null or a.token <> p_token then return jsonb_build_object('ok', false, 'reason', 'signed out'); end if;
  if a.created_at < now() - interval '2 days' then return jsonb_build_object('ok', false, 'reason', 'not new'); end if;
  select player into who from tw_ref_codes where code = upper(btrim(coalesce(p_code, '')));
  if who is null then return jsonb_build_object('ok', false, 'reason', 'bad code'); end if;
  if who = p_player then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  if exists (select 1 from tw_referrals where referred = p_player) then return jsonb_build_object('ok', false, 'reason', 'already'); end if;
  select * into v from tw_visitors where player = p_player;
  if v.player is not null and v.first_seen < now() - interval '7 days' then return jsonb_build_object('ok', false, 'reason', 'not new'); end if;
  select * into rv from tw_visitors where player = who;
  if rv.net is not null and (rv.net = v.net or rv.net = tw_net()) then return jsonb_build_object('ok', false, 'reason', 'same connection'); end if;
  select count(*) into today from tw_referrals where referrer = who and created_at > now() - interval '1 day';
  if today >= 10 then return jsonb_build_object('ok', false, 'reason', 'limit'); end if;
  insert into tw_referrals(referred, referrer) values (p_player, who);
  return jsonb_build_object('ok', true);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'already');
end $$;

-- the account's progress, saved: also marks a referred friend as qualified once they reach 300 XP
create or replace function public.account_save(p_player uuid, p_token uuid, p_profile jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from tw_accounts where player = p_player;
  if a.player is null or a.token <> p_token then return jsonb_build_object('ok', false, 'reason', 'signed out'); end if;
  if length(p_profile::text) > 400000 then return jsonb_build_object('ok', false, 'reason', 'too big'); end if;
  if a.profile_at is not null and a.profile_at > now() - interval '3 seconds' then return jsonb_build_object('ok', false, 'reason', 'slow down'); end if;
  if a.profile is not null and coalesce((a.profile->>'savedAt')::float8, 0) > coalesce((p_profile->>'savedAt')::float8, 0) then
    return jsonb_build_object('ok', false, 'reason', 'older');
  end if;
  update tw_accounts set profile = p_profile, profile_at = now() where player = p_player;
  update tw_referrals set qualified_at = now() where referred = p_player and qualified_at is null and coalesce((p_profile->>'xp')::float8, 0) >= 300;
  return jsonb_build_object('ok', true, 'at', now());
end $$;

-- where I stand: my code, friends who joined, friends who qualified, rewards already collected
create or replace function public.ref_status(p_player uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', (select code from tw_ref_codes where player = p_player),
    'joined', (select count(*) from tw_referrals where referrer = p_player),
    'qualified', (select count(*) from tw_referrals where referrer = p_player and qualified_at is not null),
    'claimed', coalesce((select jsonb_object_agg(kind, amount) from tw_ref_rewards where player = p_player), '{}'::jsonb))
$$;

-- collect a reward (an account's own, with its token): once each, only when earned
create or replace function public.ref_claim(p_player uuid, p_token uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; q int; amt int; need int;
begin
  select * into a from tw_accounts where player = p_player;
  if a.player is null or a.token <> p_token then return jsonb_build_object('ok', false, 'reason', 'signed out'); end if;
  if p_kind = 'share' then amt := 3000; need := 1; elsif p_kind = 'five' then amt := 10000; need := 5; else return jsonb_build_object('ok', false, 'reason', 'bad kind'); end if;
  select count(*) into q from tw_referrals where referrer = p_player and qualified_at is not null;
  if q < need then return jsonb_build_object('ok', false, 'reason', 'not yet', 'qualified', q); end if;
  insert into tw_ref_rewards(player, kind, amount) values (p_player, p_kind, amt) on conflict do nothing;
  if not found then return jsonb_build_object('ok', false, 'reason', 'already'); end if;
  return jsonb_build_object('ok', true, 'amount', amt);
end $$;

grant execute on function public.ref_code(uuid) to anon;
grant execute on function public.ref_attach(uuid, uuid, text) to anon;
grant execute on function public.ref_status(uuid) to anon;
grant execute on function public.ref_claim(uuid, uuid, text) to anon;
grant execute on function public.hello(uuid) to anon;

-- deleting an account also removes its invite code, referrals and invite rewards
create or replace function public.account_delete(p_player uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from tw_accounts where player = p_player;
  if a.player is null or a.token <> p_token then return jsonb_build_object('ok', false, 'reason', 'signed out'); end if;
  delete from tw_scores where player = p_player;
  delete from tw_ref_rewards where player = p_player;
  delete from tw_referrals where referred = p_player or referrer = p_player;
  delete from tw_ref_codes where player = p_player;
  delete from tw_visitors where player = p_player;
  delete from tw_accounts where player = p_player;
  delete from tw_players where player = p_player;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.account_delete(uuid, uuid) to anon;
