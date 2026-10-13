-- Tiny World: player accounts and the Total XP board. Run once in the Supabase SQL editor (after the other scripts).
-- An account is a username (the leaderboard name, unique) with a password or a PIN, and an account ID (the player id).
-- The player's progress is kept with the account, so it can be signed into on any device. Passwords and PINs are
-- stored only as bcrypt hashes; the game keeps a sign-in token, never the password. Five wrong tries locks the
-- account for a minute. (Simple by design: enough to own a name and carry progress, not a bank.)

create extension if not exists pgcrypto with schema extensions;

create or replace function public.tw_category(p_category text, out higher boolean, out max_value double precision, out per_map boolean)
language sql immutable as $$
  select c.higher, c.max_value, c.per_map from (values
    ('destruction_event', true, 60000::float8, true),
    ('rampage_60',        true, 60000::float8, true),
    ('car_throw',         true, 900::float8,   false),
    ('person_throw',      true, 1200::float8,  false),
    ('drone_kamikaze',    true, 5000::float8,  false),
    ('jetpack_fall',      true, 80::float8,    false),
    ('chair_altitude',    true, 260::float8,   false),
    -- Highway Cut-Up (Las Vegas)
    ('traffic_score90',   true, 5000000::float8, false),
    ('traffic_distance',  true, 1000000::float8, false),
    ('traffic_combo',     true, 5000::float8,    false),
    ('traffic_clean',     true, 1000000::float8, false),
    -- Snowmobile Jump & Time Trial (Sisimiut): times are lower-is-better
    ('sled_time',         false, 900::float8,    false),
    ('sled_clean',        false, 900::float8,    false),
    ('sled_jump',         true, 400::float8,     false),
    ('sled_stunt',        true, 2000000::float8, false),
    -- Casino (Las Vegas)
    ('casino_jackpot',    true, 10000000::float8, false),
    ('casino_session',    true, 10000000::float8, false),
    ('casino_streak',     true, 200::float8,      false),
    -- Drone Combat
    ('dogfight_wave',     true, 500::float8,     false),
    ('dogfight_kills',    true, 500::float8,     false),
    ('dogfight_boss',     false, 1200::float8,   false),
    ('dogfight_score',    true, 5000000::float8, false),
    -- the main board: total XP across every map
    ('xp_total',          true, 50000000::float8, false)
  ) as c(cat, higher, max_value, per_map) where c.cat = p_category
$$;

create table if not exists public.tw_accounts (
  player uuid primary key,
  secret_hash text not null,
  kind text not null default 'password',
  token uuid not null default gen_random_uuid(),
  profile jsonb,
  profile_at timestamptz,
  fails int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
alter table public.tw_accounts enable row level security;
revoke all on public.tw_accounts from anon, authenticated;

-- create an account for this player: the name must be free (or already theirs)
create or replace function public.account_create(p_player uuid, p_name text, p_secret text, p_kind text, p_profile jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare owner uuid; tok uuid; recent int;
begin
  p_name := btrim(coalesce(p_name, ''));
  if p_name !~ '^[[:alnum:] _.\-]{3,18}$' then return jsonb_build_object('ok', false, 'reason', 'bad name'); end if;
  if p_kind = 'pin' and coalesce(p_secret, '') !~ '^[0-9]{4,8}$' then return jsonb_build_object('ok', false, 'reason', 'bad pin'); end if;
  if p_secret is null or length(p_secret) < 4 or length(p_secret) > 64 then return jsonb_build_object('ok', false, 'reason', 'bad password'); end if;
  select count(*) into recent from tw_submissions where player = p_player and at > now() - interval '1 minute';
  if recent >= 12 then return jsonb_build_object('ok', false, 'reason', 'slow down'); end if;
  insert into tw_submissions(player) values (p_player);
  if exists (select 1 from tw_accounts where player = p_player) then return jsonb_build_object('ok', false, 'reason', 'exists'); end if;
  select player into owner from tw_players where lower(name) = lower(p_name);
  if owner is not null and owner <> p_player then return jsonb_build_object('ok', false, 'reason', 'taken'); end if;
  insert into tw_players(player, name) values (p_player, p_name) on conflict (player) do update set name = excluded.name;
  update tw_scores set name = p_name where player = p_player;
  insert into tw_accounts(player, secret_hash, kind, profile, profile_at)
    values (p_player, crypt(p_secret, gen_salt('bf', 8)), case when p_kind = 'pin' then 'pin' else 'password' end, p_profile, now())
    returning token into tok;
  return jsonb_build_object('ok', true, 'player', p_player, 'name', p_name, 'token', tok);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'taken');
end $$;

-- sign in by name and password / PIN: returns the account id, a token for saving, and the saved progress
create or replace function public.account_login(p_name text, p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare pl uuid; nm text; a record;
begin
  select player, name into pl, nm from tw_players where lower(name) = lower(btrim(coalesce(p_name, '')));
  if pl is null then return jsonb_build_object('ok', false, 'reason', 'no account'); end if;
  select * into a from tw_accounts where player = pl;
  if a.player is null then return jsonb_build_object('ok', false, 'reason', 'no account'); end if;
  if a.locked_until is not null and a.locked_until > now() then return jsonb_build_object('ok', false, 'reason', 'locked'); end if;
  if a.secret_hash <> crypt(coalesce(p_secret, ''), a.secret_hash) then
    update tw_accounts set fails = fails + 1, locked_until = case when fails + 1 >= 5 then now() + interval '1 minute' else null end where player = pl;
    return jsonb_build_object('ok', false, 'reason', 'wrong');
  end if;
  update tw_accounts set fails = 0, locked_until = null where player = pl;
  return jsonb_build_object('ok', true, 'player', pl, 'name', nm, 'token', a.token, 'kind', a.kind, 'profile', a.profile, 'profile_at', a.profile_at);
end $$;

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

-- fetch the account's latest progress (another device may have played since)
create or replace function public.account_load(p_player uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; nm text;
begin
  select * into a from tw_accounts where player = p_player;
  if a.player is null or a.token <> p_token then return jsonb_build_object('ok', false, 'reason', 'signed out'); end if;
  select name into nm from tw_players where player = p_player;
  return jsonb_build_object('ok', true, 'name', nm, 'kind', a.kind, 'profile', a.profile, 'profile_at', a.profile_at);
end $$;

-- change the password or PIN (needs the current one); signs other devices out
create or replace function public.account_change_secret(p_player uuid, p_token uuid, p_old text, p_new text, p_kind text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare a record; tok uuid;
begin
  select * into a from tw_accounts where player = p_player;
  if a.player is null or a.token <> p_token then return jsonb_build_object('ok', false, 'reason', 'signed out'); end if;
  if a.secret_hash <> crypt(coalesce(p_old, ''), a.secret_hash) then return jsonb_build_object('ok', false, 'reason', 'wrong'); end if;
  if p_kind = 'pin' and coalesce(p_new, '') !~ '^[0-9]{4,8}$' then return jsonb_build_object('ok', false, 'reason', 'bad pin'); end if;
  if p_new is null or length(p_new) < 4 or length(p_new) > 64 then return jsonb_build_object('ok', false, 'reason', 'bad password'); end if;
  update tw_accounts set secret_hash = crypt(p_new, gen_salt('bf', 8)), kind = case when p_kind = 'pin' then 'pin' else 'password' end, token = gen_random_uuid()
    where player = p_player returning token into tok;
  return jsonb_build_object('ok', true, 'token', tok);
end $$;

grant execute on function public.account_create(uuid, text, text, text, jsonb) to anon;
grant execute on function public.account_login(text, text) to anon;
grant execute on function public.account_save(uuid, uuid, jsonb) to anon;
grant execute on function public.account_load(uuid, uuid) to anon;
grant execute on function public.account_change_secret(uuid, uuid, text, text, text) to anon;

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
