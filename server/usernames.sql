-- Tiny World: unique player names. Run once in the Supabase SQL editor (after leaderboard.sql).
-- Each name belongs to one player; names compare without regard to capitals ("Tava" and "tava" are the same name).

create table if not exists public.tw_players (
  player uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists tw_players_name_ci on public.tw_players (lower(name));
alter table public.tw_players enable row level security;
revoke all on public.tw_players from anon, authenticated;

-- the names already on the boards: the first player to use a name keeps it
insert into public.tw_players (player, name)
select distinct on (lower(name)) player, name from public.tw_scores order by lower(name), created_at
on conflict do nothing;

-- claim (or change to) a name: refused if another player has it
create or replace function public.claim_name(p_player uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare owner uuid; recent int;
begin
  p_name := btrim(coalesce(p_name, ''));
  if p_name !~ '^[[:alnum:] _.\-]{3,18}$' then raise exception 'bad name' using errcode = '22023'; end if;
  select count(*) into recent from tw_submissions where player = p_player and at > now() - interval '1 minute';
  if recent >= 12 then raise exception 'slow down' using errcode = 'P0001'; end if;
  insert into tw_submissions(player) values (p_player);
  select player into owner from tw_players where lower(name) = lower(p_name);
  if owner is not null and owner <> p_player then return jsonb_build_object('ok', false, 'reason', 'taken'); end if;
  insert into tw_players(player, name) values (p_player, p_name) on conflict (player) do update set name = excluded.name;
  update tw_scores set name = p_name where player = p_player;
  return jsonb_build_object('ok', true, 'name', p_name);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'taken');
end $$;
grant execute on function public.claim_name(uuid, text) to anon;

-- scores now carry the player's claimed name; a name that belongs to someone else is refused
create or replace function public.submit_score(p_player uuid, p_name text, p_category text, p_map text, p_value double precision, p_evidence jsonb, p_version text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cat record; recent int; r int; flag boolean := false; reg text; owner uuid;
begin
  select * into cat from tw_category(p_category);
  if cat.higher is null then raise exception 'unknown category' using errcode = '22023'; end if;
  if p_value is null or p_value = 'NaN'::float8 or p_value <= 0 or p_value > cat.max_value then raise exception 'value out of range' using errcode = '22023'; end if;
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
