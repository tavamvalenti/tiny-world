-- Tiny World: accounts fix. Run once in the Supabase SQL editor (after accounts.sql).
-- An account's saved progress never goes backwards: a device holding an older copy can't overwrite a newer one.

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

-- clean-up: two test identities from the developer's testing that reached the live boards (Total XP); removes only them
delete from public.tw_scores      where player in ('75a37b86-d25e-4bf8-838b-07551c613a2e', 'e3c360d7-e914-4369-9b98-1e0e261dac0e');
delete from public.tw_accounts    where player in ('75a37b86-d25e-4bf8-838b-07551c613a2e', 'e3c360d7-e914-4369-9b98-1e0e261dac0e');
delete from public.tw_players     where player in ('75a37b86-d25e-4bf8-838b-07551c613a2e', 'e3c360d7-e914-4369-9b98-1e0e261dac0e');
delete from public.tw_submissions where player in ('75a37b86-d25e-4bf8-838b-07551c613a2e', 'e3c360d7-e914-4369-9b98-1e0e261dac0e');
