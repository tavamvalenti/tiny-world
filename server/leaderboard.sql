-- Tiny World global leaderboards (Supabase / Postgres). Run this once in the Supabase SQL editor.
-- The browser uses only the public anon key. It cannot read or write the table directly (row level security with
-- no policies); it can only call the three functions below, which check every submission.
-- Not cheat-proof: a determined player can still send a fake score that passes the checks. Flagged rows can be
-- reviewed in the table editor and hidden by setting hidden = true.

create table if not exists public.tw_scores (
  id bigserial primary key,
  player uuid not null,
  name text not null,
  category text not null,
  map text not null default '',
  value double precision not null,
  evidence jsonb not null default '{}'::jsonb,
  version text not null default '',
  flagged boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (player, category, map)
);
create index if not exists tw_scores_board on public.tw_scores (category, map, value desc) where not hidden;
create table if not exists public.tw_submissions (player uuid not null, at timestamptz not null default now());
create index if not exists tw_submissions_player on public.tw_submissions (player, at);

alter table public.tw_scores enable row level security;
alter table public.tw_submissions enable row level security;
revoke all on public.tw_scores, public.tw_submissions from anon, authenticated;

-- the categories the game has, the best direction and the most anyone could possibly score
create or replace function public.tw_category(p_category text, out higher boolean, out max_value double precision, out per_map boolean)
language sql immutable as $$
  select c.higher, c.max_value, c.per_map from (values
    ('destruction_event', true, 60000::float8, true),
    ('rampage_60',        true, 60000::float8, true),
    ('car_throw',         true, 900::float8,   false),
    ('person_throw',      true, 1200::float8,  false),
    ('drone_kamikaze',    true, 5000::float8,  false),
    ('jetpack_fall',      true, 80::float8,    false),
    ('chair_altitude',    true, 260::float8,   false)
  ) as c(cat, higher, max_value, per_map) where c.cat = p_category
$$;

create or replace function public.submit_score(p_player uuid, p_name text, p_category text, p_map text, p_value double precision, p_evidence jsonb, p_version text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cat record; recent int; better boolean; r int; flag boolean := false;
begin
  select * into cat from tw_category(p_category);
  if cat.higher is null then raise exception 'unknown category' using errcode = '22023'; end if;
  if p_value is null or p_value = 'NaN'::float8 or p_value <= 0 or p_value > cat.max_value then raise exception 'value out of range' using errcode = '22023'; end if;
  if p_name is null or p_name !~ '^[[:alnum:] _.\-]{3,18}$' then raise exception 'bad name' using errcode = '22023'; end if;
  if p_map !~ '^(|downtown|suburbs|tropical|vegas|london|greenland|cairo)$' then raise exception 'bad map' using errcode = '22023'; end if;
  if cat.per_map and p_map = '' then raise exception 'map required' using errcode = '22023'; end if;
  if not cat.per_map then p_map := ''; end if;
  -- rate limit: 12 submissions a minute per player
  select count(*) into recent from tw_submissions where player = p_player and at > now() - interval '1 minute';
  if recent >= 12 then raise exception 'slow down' using errcode = 'P0001', hint = '429'; end if;
  insert into tw_submissions(player) values (p_player);
  delete from tw_submissions where at < now() - interval '1 day';
  -- plausibility: a throw over 500 m or a destruction event over 20,000 blocks gets a second look
  if (p_category in ('car_throw', 'person_throw') and p_value > 500) or (p_category in ('destruction_event', 'rampage_60') and p_value > 20000) then flag := true; end if;
  -- keep only each player's best per category and map
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
end $$;

create or replace function public.top_scores(p_category text, p_map text, p_limit int)
returns table(rank bigint, name text, value double precision, map text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select rank() over (order by case when (select higher from tw_category(p_category)) then -s.value else s.value end), s.name, s.value, s.map, s.created_at
  from tw_scores s where s.category = p_category and s.map = coalesce(p_map, '') and not s.hidden
  order by 1 limit least(greatest(coalesce(p_limit, 10), 1), 100)
$$;

create or replace function public.my_rank(p_category text, p_map text, p_player uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('value', me.value, 'rank', (select count(*) + 1 from tw_scores s where s.category = me.category and s.map = me.map and not s.hidden
      and ((select higher from tw_category(p_category)) and s.value > me.value or not (select higher from tw_category(p_category)) and s.value < me.value)), 'total', (select count(*) from tw_scores s where s.category = me.category and s.map = me.map and not s.hidden))
    from tw_scores me where me.player = p_player and me.category = p_category and me.map = coalesce(p_map, '')), '{}'::jsonb)
$$;

grant execute on function public.submit_score(uuid, text, text, text, double precision, jsonb, text) to anon;
grant execute on function public.top_scores(text, text, int) to anon;
grant execute on function public.my_rank(text, text, uuid) to anon;
