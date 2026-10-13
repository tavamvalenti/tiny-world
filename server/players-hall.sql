-- Tiny World: the players' hall (the trophy on the menu). Run once in the Supabase SQL editor (after players.sql).
-- The totals, plus the players with names (newest first, with their pictures) to show off; guests are counted, not named.
create or replace function public.players_overview(p_limit int)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'players', (select count(*) from tw_visitors),
    'online', (select count(*) from tw_visitors where last_seen > now() - interval '5 minutes'),
    'today', (select count(*) from tw_visitors where first_seen > now() - interval '1 day'),
    'named', (select count(*) from tw_players),
    'list', coalesce((select jsonb_agg(x) from (
      select p.name, p.avatar, coalesce(v.first_seen, p.created_at) as since, (v.last_seen > now() - interval '5 minutes') as online
      from tw_players p left join tw_visitors v on v.player = p.player
      order by coalesce(v.last_seen, p.created_at) desc
      limit least(greatest(coalesce(p_limit, 60), 1), 200)) x), '[]'::jsonb))
$$;
grant execute on function public.players_overview(int) to anon;
