-- Configurable nano emission rate for the listening reward.
--
-- Replaces the hardcoded "1 nano per 10 seconds" math in
-- credit_listening_progress / credit_listening_play with a value read
-- from a settings table at runtime. Super-admin can tune this without
-- shipping a new SQL migration or rebuilding the mobile app.
--
-- Default policy: 1 nano per 10 seconds (same as before this migration).
-- Admin sets the values via app.admin_set_emission_rate(p_nano, p_seconds);
-- mobile + admin clients read them via app.get_emission_rate().
--
-- The credit functions read the policy once at call-time and use
-- floor(seconds * nano / window) - floor(prev * nano / window) to count
-- whole earned-units across calls, so partial seconds aren't lost.
--
-- Run AFTER mobile-listening-credit-rpc.sql (or the auto-join-dj-wave-and-
-- 10s-credit.sql, which last touched the credit functions). Safe to re-run.

-- ============================================================
-- 1) Settings table — one row per scoped key. Wide schema so other
--    runtime knobs can live here too without another migration.
-- ============================================================
create table if not exists public.app_settings (
  key         text        primary key,
  value       jsonb       not null,
  updated_by  uuid,                                  -- admin_users.id
  updated_at  timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Mobile reads (via the get_emission_rate RPC). No direct table access.
drop policy if exists app_settings_no_direct on public.app_settings;
create policy app_settings_no_direct
  on public.app_settings for all
  to anon, authenticated
  using (false)
  with check (false);

-- Seed default emission rate. nano_per_window = 1, window_seconds = 10.
insert into public.app_settings (key, value)
values ('listening_emission', '{"nano_per_window": 1, "window_seconds": 10}'::jsonb)
on conflict (key) do nothing;

-- ============================================================
-- 2) Public read RPC — any signed-in user can fetch the current rate.
--    The mobile app calls this to show the rate in the wallet screen.
-- ============================================================
create or replace function public.get_emission_rate()
returns table (nano_per_window integer, window_seconds integer)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    coalesce((value->>'nano_per_window')::integer, 1) as nano_per_window,
    coalesce((value->>'window_seconds')::integer, 10) as window_seconds
  from public.app_settings
  where key = 'listening_emission'
  limit 1;
$$;

grant execute on function public.get_emission_rate() to authenticated, anon;

-- ============================================================
-- 3) Admin write RPC — admin_users only. Updates the rate atomically.
-- ============================================================
create or replace function public.admin_set_emission_rate(
  p_nano_per_window integer,
  p_window_seconds  integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_nano_per_window is null or p_nano_per_window < 0 then
    raise exception 'nano_per_window must be >= 0';
  end if;
  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'window_seconds must be > 0';
  end if;

  insert into public.app_settings (key, value, updated_by)
  values (
    'listening_emission',
    jsonb_build_object(
      'nano_per_window', p_nano_per_window,
      'window_seconds',  p_window_seconds
    ),
    auth.uid()
  )
  on conflict (key) do update
    set value = excluded.value,
        updated_by = auth.uid(),
        updated_at = now();
end;
$$;

grant execute on function public.admin_set_emission_rate(integer, integer) to authenticated;

-- ============================================================
-- 4) Rebuild credit_listening_progress to read the rate from settings.
--    Formula: nano_earned = floor(seconds * N / W) - floor(prev * N / W)
--    where N = nano_per_window, W = window_seconds.
-- ============================================================
drop function if exists public.credit_listening_progress(uuid, integer);
create function public.credit_listening_progress(
  p_session_token uuid,
  p_listened_seconds integer
)
returns table (delta_nano integer, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_session public.mobile_play_sessions%rowtype;
  v_seconds integer;
  v_prev integer;
  v_delta integer;
  v_n integer;
  v_w integer;
begin
  if v_me is null then
    return query select 0, 'Not signed in'::text;
    return;
  end if;

  select * into v_session
  from public.mobile_play_sessions ps
  where ps.id = p_session_token and ps.mobile_user_id = v_me
  for update;

  if not found then
    return query select 0, 'Unknown session'::text;
    return;
  end if;

  if v_session.credited_at is not null then
    return query select 0, 'Already finalized'::text;
    return;
  end if;

  v_seconds := greatest(0, coalesce(p_listened_seconds, 0));
  v_seconds := least(
    v_seconds,
    ceil(extract(epoch from (now() - v_session.started_at)))::integer
  );

  v_prev := coalesce(v_session.listened_seconds, 0);

  -- Pull live rate. Safe defaults if the row is missing.
  select nano_per_window, window_seconds into v_n, v_w
  from public.get_emission_rate();
  if v_n is null then v_n := 1; end if;
  if v_w is null or v_w <= 0 then v_w := 10; end if;

  -- Count whole earned-units (1 unit = v_n nano per v_w seconds).
  v_delta := ((v_seconds * v_n) / v_w) - ((v_prev * v_n) / v_w);

  if v_delta <= 0 then
    -- Advance the high-water mark even if nothing earned this tick.
    if v_seconds > v_prev then
      update public.mobile_play_sessions ps
      set listened_seconds = v_seconds
      where ps.id = p_session_token;
    end if;
    return query select 0, 'No new earned units'::text;
    return;
  end if;

  insert into public.mobile_wallets (mobile_user_id, nano_earned_total, mini_balance)
  values (v_me, v_delta, 0)
  on conflict (mobile_user_id) do update
    set nano_earned_total = public.mobile_wallets.nano_earned_total + v_delta,
        updated_at = now();

  update public.mobile_play_sessions ps
  set listened_seconds = v_seconds,
      credited_nano = coalesce(ps.credited_nano, 0) + v_delta
  where ps.id = p_session_token;

  return query select v_delta, 'ok'::text;
end;
$$;

grant execute on function public.credit_listening_progress(uuid, integer) to authenticated;

-- ============================================================
-- 5) Rebuild credit_listening_play with the same dynamic formula.
-- ============================================================
drop function if exists public.credit_listening_play(uuid, integer);
create function public.credit_listening_play(
  p_session_token uuid,
  p_listened_seconds integer
)
returns table (credited_nano integer, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_session public.mobile_play_sessions%rowtype;
  v_seconds integer;
  v_prev integer;
  v_delta integer;
  v_total integer;
  v_n integer;
  v_w integer;
begin
  if v_me is null then
    return query select 0, 'Not signed in'::text;
    return;
  end if;

  select * into v_session
  from public.mobile_play_sessions ps
  where ps.id = p_session_token and ps.mobile_user_id = v_me
  for update;

  if not found then
    return query select 0, 'Unknown session'::text;
    return;
  end if;

  if v_session.credited_at is not null then
    return query select coalesce(v_session.credited_nano, 0), 'Already credited'::text;
    return;
  end if;

  v_seconds := greatest(0, coalesce(p_listened_seconds, 0));
  v_seconds := least(
    v_seconds,
    ceil(extract(epoch from (now() - v_session.started_at)))::integer
  );

  v_prev := coalesce(v_session.listened_seconds, 0);

  select nano_per_window, window_seconds into v_n, v_w
  from public.get_emission_rate();
  if v_n is null then v_n := 1; end if;
  if v_w is null or v_w <= 0 then v_w := 10; end if;

  v_delta := greatest(0, ((v_seconds * v_n) / v_w) - ((v_prev * v_n) / v_w));
  v_total := coalesce(v_session.credited_nano, 0) + v_delta;

  if v_delta > 0 then
    insert into public.mobile_wallets (mobile_user_id, nano_earned_total, mini_balance)
    values (v_me, v_delta, 0)
    on conflict (mobile_user_id) do update
      set nano_earned_total = public.mobile_wallets.nano_earned_total + v_delta,
          updated_at = now();
  end if;

  if v_total > 0 then
    insert into public.mobile_wallet_ledger (
      mobile_user_id, entry_type, source_type, source_reference_id,
      description, nano_delta, mini_delta
    ) values (
      v_me, 'listening_reward', 'song_listening', v_session.track_id::text,
      format('Listened for %s seconds', v_seconds), v_total, 0
    );
  end if;

  update public.mobile_play_sessions ps
  set credited_at = now(),
      credited_nano = v_total,
      listened_seconds = greatest(coalesce(ps.listened_seconds, 0), v_seconds)
  where ps.id = p_session_token;

  return query select v_total, 'ok'::text;
end;
$$;

grant execute on function public.credit_listening_play(uuid, integer) to authenticated;
