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
