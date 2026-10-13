-- Tiny World: friends. Run once in the Supabase SQL editor (after accounts.sql and referrals.sql).
-- Send a request by name; the other player accepts or declines; friends see each other online. Accounts only
-- (each call carries the account's token), at most 30 new requests a day, 200 friends.
create table if not exists public.tw_friends (
  a uuid not null,                     -- who asked
  b uuid not null,                     -- who was asked
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (a, b)
);
create index if not exists tw_friends_b on public.tw_friends (b);
alter table public.tw_friends enable row level security;
revoke all on public.tw_friends from anon, authenticated;

create or replace function public.tw_auth(p_player uuid, p_token uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tw_accounts where player = p_player and token = p_token)
$$;

create or replace function public.friend_request(p_player uuid, p_token uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare who uuid;
begin
  if not tw_auth(p_player, p_token) then return jsonb_build_object('ok', false, 'reason', 'account'); end if;
  select player into who from tw_players where lower(name) = lower(btrim(coalesce(p_name, '')));
  if who is null then return jsonb_build_object('ok', false, 'reason', 'no such player'); end if;
  if who = p_player then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  if not exists (select 1 from tw_accounts where player = who) then return jsonb_build_object('ok', false, 'reason', 'guest'); end if;
  if exists (select 1 from tw_friends where a = who and b = p_player) then        -- they already asked me: that's a yes
    update tw_friends set accepted = true where a = who and b = p_player;
    return jsonb_build_object('ok', true, 'state', 'friends');
  end if;
  if exists (select 1 from tw_friends where a = p_player and b = who) then return jsonb_build_object('ok', true, 'state', 'sent'); end if;
  if (select count(*) from tw_friends where a = p_player and created_at > now() - interval '1 day') >= 30 then return jsonb_build_object('ok', false, 'reason', 'limit'); end if;
  if (select count(*) from tw_friends where (a = p_player or b = p_player) and accepted) >= 200 then return jsonb_build_object('ok', false, 'reason', 'full'); end if;
  insert into tw_friends(a, b) values (p_player, who);
  return jsonb_build_object('ok', true, 'state', 'sent');
end $$;

-- accept (yes) or decline / cancel / unfriend (no), by name
create or replace function public.friend_respond(p_player uuid, p_token uuid, p_name text, p_yes boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare who uuid;
begin
  if not tw_auth(p_player, p_token) then return jsonb_build_object('ok', false, 'reason', 'account'); end if;
  select player into who from tw_players where lower(name) = lower(btrim(coalesce(p_name, '')));
  if who is null then return jsonb_build_object('ok', false, 'reason', 'no such player'); end if;
  if p_yes then update tw_friends set accepted = true where a = who and b = p_player;
  else delete from tw_friends where (a = who and b = p_player) or (a = p_player and b = who); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.friend_list(p_player uuid, p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not tw_auth(p_player, p_token) then return jsonb_build_object('ok', false, 'reason', 'account'); end if;
  return jsonb_build_object('ok', true,
    'friends', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'avatar', p.avatar, 'online', coalesce(v.last_seen > now() - interval '5 minutes', false), 'seen', v.last_seen) order by v.last_seen desc nulls last)
      from tw_friends f join tw_players p on p.player = case when f.a = p_player then f.b else f.a end
      left join tw_visitors v on v.player = p.player
      where f.accepted and (f.a = p_player or f.b = p_player)), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'avatar', p.avatar) order by f.created_at desc)
      from tw_friends f join tw_players p on p.player = f.a where f.b = p_player and not f.accepted), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('name', p.name) order by f.created_at desc)
      from tw_friends f join tw_players p on p.player = f.b where f.a = p_player and not f.accepted), '[]'::jsonb));
end $$;

grant execute on function public.friend_request(uuid, uuid, text) to anon;
grant execute on function public.friend_respond(uuid, uuid, text, boolean) to anon;
grant execute on function public.friend_list(uuid, uuid) to anon;

-- deleting an account also removes its friendships
create or replace function public.account_delete(p_player uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare acc record;
begin
  select * into acc from tw_accounts where player = p_player;
  if acc.player is null or acc.token <> p_token then return jsonb_build_object('ok', false, 'reason', 'signed out'); end if;
  delete from tw_friends f where f.a = p_player or f.b = p_player;
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

-- ---------------- private messages (friends only)
create table if not exists public.tw_dm (
  id bigserial primary key,
  a uuid not null,                     -- from
  b uuid not null,                     -- to
  body text not null,
  at timestamptz not null default now(),
  seen boolean not null default false
);
create index if not exists tw_dm_pair on public.tw_dm (least(a, b), greatest(a, b), id);
create index if not exists tw_dm_unseen on public.tw_dm (b) where not seen;
alter table public.tw_dm enable row level security;
revoke all on public.tw_dm from anon, authenticated;

create or replace function public.tw_friend_id(p_player uuid, p_name text) returns uuid
language sql stable security definer set search_path = public as $$
  select p.player from tw_players p join tw_friends f on f.accepted and ((f.a = p_player and f.b = p.player) or (f.b = p_player and f.a = p.player))
  where lower(p.name) = lower(btrim(coalesce(p_name, ''))) limit 1
$$;

create or replace function public.dm_send(p_player uuid, p_token uuid, p_name text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare who uuid; b text := left(btrim(coalesce(p_body, '')), 500);
begin
  if not tw_auth(p_player, p_token) then return jsonb_build_object('ok', false, 'reason', 'account'); end if;
  if b = '' then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
  who := tw_friend_id(p_player, p_name);
  if who is null then return jsonb_build_object('ok', false, 'reason', 'not friends'); end if;
  if exists (select 1 from tw_dm where a = p_player and at > now() - interval '1 second') then return jsonb_build_object('ok', false, 'reason', 'slow down'); end if;
  insert into tw_dm(a, b, body) values (p_player, who, b);
  return jsonb_build_object('ok', true);
end $$;

-- the conversation with one friend (newest 80, or newer than p_after); marks what I received as seen
create or replace function public.dm_list(p_player uuid, p_token uuid, p_name text, p_after bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare who uuid; out jsonb;
begin
  if not tw_auth(p_player, p_token) then return jsonb_build_object('ok', false, 'reason', 'account'); end if;
  who := tw_friend_id(p_player, p_name);
  if who is null then return jsonb_build_object('ok', false, 'reason', 'not friends'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'body', body, 'at', at, 'mine', a = p_player) order by id), '[]'::jsonb) into out
  from (select * from tw_dm where ((a = p_player and b = who) or (a = who and b = p_player)) and id > coalesce(p_after, 0) order by id desc limit 80) m;
  update tw_dm set seen = true where a = who and b = p_player and not seen;
  return jsonb_build_object('ok', true, 'msgs', out);
end $$;

-- friend_list again, now with unread private messages per friend
create or replace function public.friend_list(p_player uuid, p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not tw_auth(p_player, p_token) then return jsonb_build_object('ok', false, 'reason', 'account'); end if;
  return jsonb_build_object('ok', true,
    'friends', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'avatar', p.avatar, 'online', coalesce(v.last_seen > now() - interval '5 minutes', false), 'seen', v.last_seen,
        'unread', (select count(*) from tw_dm d where d.a = p.player and d.b = p_player and not d.seen)) order by v.last_seen desc nulls last)
      from tw_friends f join tw_players p on p.player = case when f.a = p_player then f.b else f.a end
      left join tw_visitors v on v.player = p.player
      where f.accepted and (f.a = p_player or f.b = p_player)), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'avatar', p.avatar) order by f.created_at desc)
      from tw_friends f join tw_players p on p.player = f.a where f.b = p_player and not f.accepted), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('name', p.name) order by f.created_at desc)
      from tw_friends f join tw_players p on p.player = f.b where f.a = p_player and not f.accepted), '[]'::jsonb));
end $$;

grant execute on function public.dm_send(uuid, uuid, text, text) to anon;
grant execute on function public.dm_list(uuid, uuid, text, bigint) to anon;

-- ---------------- world chat: profile pictures, and no player ids handed out (you learn only which lines are yours)
create or replace function public.chat_list(p_after bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'body', m.body, 'at', m.at, 'av', p.avatar) order by m.id), '[]'::jsonb)
  from (select * from tw_chat where id > coalesce(p_after, 0) order by id desc limit 60) m left join tw_players p on p.player = m.player and p.name = m.name
$$;
create or replace function public.chat_list2(p_after bigint, p_me uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'body', m.body, 'at', m.at, 'av', p.avatar, 'mine', m.player = p_me) order by m.id), '[]'::jsonb)
  from (select * from tw_chat where id > coalesce(p_after, 0) order by id desc limit 60) m left join tw_players p on p.player = m.player and p.name = m.name
$$;
grant execute on function public.chat_list(bigint) to anon;
grant execute on function public.chat_list2(bigint, uuid) to anon;
