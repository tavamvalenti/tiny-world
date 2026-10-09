-- Tiny World: the mini-games' leaderboard categories. Run once in the Supabase SQL editor (after leaderboard.sql
-- and usernames.sql). It adds every mini-game board (Highway Cut-Up, Snowmobile, Casino, Drone Combat), a lowest
-- allowed value for times (so an impossible 0.5 s lap is refused), and a second look at implausible results.

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
    ('dogfight_score',    true, 5000000::float8, false)
  ) as c(cat, higher, max_value, per_map) where c.cat = p_category
$$;

-- the lowest believable value (times can't be near zero)
create or replace function public.tw_category_min(p_category text) returns double precision
language sql immutable as $$
  select coalesce((select m from (values ('sled_time', 20::float8), ('sled_clean', 20::float8), ('dogfight_boss', 15::float8)) as c(cat, m) where c.cat = p_category), 0)
$$;

create or replace function public.submit_score(p_player uuid, p_name text, p_category text, p_map text, p_value double precision, p_evidence jsonb, p_version text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cat record; recent int; r int; flag boolean := false; reg text; owner uuid;
begin
  select * into cat from tw_category(p_category);
  if cat.higher is null then raise exception 'unknown category' using errcode = '22023'; end if;
  if p_value is null or p_value = 'NaN'::float8 or p_value <= 0 or p_value > cat.max_value or p_value < tw_category_min(p_category) then raise exception 'value out of range' using errcode = '22023'; end if;
  if p_name is null or p_name !~ '^[[:alnum:] _.\-]{3,18}$' then raise exception 'bad name' using errcode = '22023'; end if;
  if p_map !~ '^(|downtown|suburbs|tropical|vegas|london|greenland|cairo)$' then raise exception 'bad map' using errcode = '22023'; end if;
  if cat.per_map and p_map = '' then raise exception 'map required' using errcode = '22023'; end if;
  if not cat.per_map then p_map := ''; end if;
  -- the name: the player's own (claimed now if new), never someone else's
  select name into reg from tw_players where player = p_player;
  if reg is null or lower(reg) <> lower(p_name) then
    select player into owner from tw_players where lower(name) = lower(p_name);
    if owner is not null and owner <> p_player then raise exception 'name taken' using errcode = '22023'; end if;
    insert into tw_players(player, name) values (p_player, p_name) on conflict (player) do update set name = excluded.name;
  end if;
  select count(*) into recent from tw_submissions where player = p_player and at > now() - interval '1 minute';
  if recent >= 12 then raise exception 'slow down' using errcode = 'P0001'; end if;
  insert into tw_submissions(player) values (p_player);
  delete from tw_submissions where at < now() - interval '1 day';
  if (p_category in ('car_throw', 'person_throw') and p_value > 500) or (p_category in ('destruction_event', 'rampage_60') and p_value > 20000) then flag := true; end if;
  -- mini-games: a second look at results far beyond what a human run produces
  if (p_category = 'traffic_score90' and p_value > 400000) or (p_category = 'traffic_combo' and p_value > 400)
     or (p_category in ('traffic_distance', 'traffic_clean') and p_value > 150000)
     or (p_category = 'traffic_score90' and coalesce((p_evidence->>'t')::float8, 90) < 89)
     or (p_category = 'sled_jump' and p_value > 250) or (p_category = 'casino_streak' and p_value > 40)
     or (p_category = 'dogfight_kills' and p_value > 150) then flag := true; end if;
  insert into tw_scores(player, name, category, map, value, evidence, version, flagged)
  values (p_player, p_name, p_category, p_map, p_value, coalesce(p_evidence, '{}'::jsonb), coalesce(p_version, ''), flag)
  on conflict (player, category, map) do update
    set value = excluded.value, evidence = excluded.evidence, version = excluded.version, flagged = excluded.flagged, created_at = now(), name = excluded.name
    where (cat.higher and excluded.value > tw_scores.value) or (not cat.higher and excluded.value < tw_scores.value);
  update tw_scores set name = p_name where player = p_player;
  select count(*) + 1 into r from tw_scores s, tw_scores me
    where me.player = p_player and me.category = p_category and me.map = p_map and s.category = p_category and s.map = p_map and not s.hidden
      and ((cat.higher and s.value > me.value) or (not cat.higher and s.value < me.value));
  return jsonb_build_object('ok', true, 'rank', r, 'flagged', flag);
exception when unique_violation then
  raise exception 'name taken' using errcode = '22023';
end $$;
grant execute on function public.submit_score(uuid, text, text, text, double precision, jsonb, text) to anon;
