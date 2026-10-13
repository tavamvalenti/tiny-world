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
