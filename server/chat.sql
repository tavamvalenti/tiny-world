-- Tiny World: public world chat (prototype). Run once in the Supabase SQL editor.
-- Everyone can read the latest messages; sending is limited (200 characters, one message every 2 seconds per player).
create table if not exists public.tw_chat (
  id bigserial primary key,
  player uuid not null,
  name text not null,
  body text not null,
  at timestamptz not null default now()
);
alter table public.tw_chat enable row level security;
revoke all on public.tw_chat from anon, authenticated;

create or replace function public.chat_send(p_player uuid, p_name text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b text := btrim(coalesce(p_body, '')); n text := left(btrim(coalesce(p_name, 'guest')), 24);
begin
  if p_player is null or b = '' then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
  if exists (select 1 from tw_chat where player = p_player and at > now() - interval '2 seconds') then
    return jsonb_build_object('ok', false, 'reason', 'slow down'); end if;
  -- an account's name can't be borrowed by someone else
  if exists (select 1 from tw_players where lower(name) = lower(n) and player <> p_player) then n := 'guest'; end if;
  insert into tw_chat(player, name, body) values (p_player, coalesce(nullif(n, ''), 'guest'), left(b, 200));
  delete from tw_chat where id < (select max(id) - 2000 from tw_chat);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.chat_list(p_after bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'body', body, 'at', at, 'me', player) order by id), '[]'::jsonb)
  from (select * from tw_chat where id > coalesce(p_after, 0) order by id desc limit 60) m
$$;

grant execute on function public.chat_send(uuid, text, text) to anon;
grant execute on function public.chat_list(bigint) to anon;
