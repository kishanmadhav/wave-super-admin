-- Ad Management: super-admin-curated ads served to the mobile app.
--
-- Two placements:
--   * 'banner'       — image only, shown for N seconds on the Watch & Earn
--                      screen. Mobile renders a vertical carousel of all
--                      active banners; each completed view credits nano.
--   * 'interstitial' — image + audio (any length). Triggered by the mobile
--                      app after every Nth completed play; user must
--                      complete the audio to receive the nano reward.
--
-- Media lives in a private `ads` bucket. The mobile app NEVER touches the
-- bucket directly — it calls list_active_ads(placement) which mints
-- short-lived signed URLs server-side. Service role uploads only (CMS).
--
-- Run AFTER mobile-ad-reward-rpc.sql. Safe to re-run.

-- ============================================================
-- 0) Admin-check helper (used by storage RLS and CRUD RPCs).
-- ============================================================
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_users where id = auth.uid()
  );
$$;

grant execute on function public.is_admin_user() to authenticated;

-- ============================================================
-- 1) Private bucket for ad media
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ads',
  'ads',
  false,
  20 * 1024 * 1024,  -- 20 MB cap (room for short audio + hi-res images)
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-m4a'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Reads happen via signed URLs minted by list_active_ads (SECURITY DEFINER
-- bypasses RLS). Direct SELECT is denied for clients. Writes are scoped
-- to admin_users via the is_admin_user() helper so the CMS can upload
-- without needing the service-role key in the browser.
drop policy if exists "ads: no client read"   on storage.objects;
drop policy if exists "ads: admin upload"     on storage.objects;
drop policy if exists "ads: admin update"     on storage.objects;
drop policy if exists "ads: admin delete"     on storage.objects;
drop policy if exists "ads: deny client access" on storage.objects;  -- legacy

create policy "ads: no client read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'ads' and false);

create policy "ads: admin upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ads' and public.is_admin_user());

create policy "ads: admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'ads' and public.is_admin_user())
  with check (bucket_id = 'ads' and public.is_admin_user());

create policy "ads: admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'ads' and public.is_admin_user());

-- ============================================================
-- 2) Ads table
-- ============================================================
create table if not exists public.ads (
  id              uuid        primary key default uuid_generate_v4(),
  placement       text        not null check (placement in ('banner', 'interstitial')),
  title           text        not null,
  subtitle        text,
  cta_label       text,                                -- "Buy Now", "Shop Now" etc
  cta_url         text,                                -- optional click-through
  image_path      text        not null,                -- storage path inside `ads` bucket
  audio_path      text,                                -- interstitial only
  nano_reward     integer     not null default 1 check (nano_reward >= 0 and nano_reward <= 50),
  duration_sec    integer     not null default 10 check (duration_sec > 0),
                                                       -- banners: how long to display
                                                       -- interstitial: ignored (uses audio length)
  display_order   integer     not null default 0,
  active          boolean     not null default true,
  starts_at       timestamptz,                         -- optional schedule
  ends_at         timestamptz,                         -- optional expiry
  created_by      uuid,                                -- admin_users.id who uploaded
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_ads_placement_active
  on public.ads(placement, active, display_order)
  where active = true;

create index if not exists idx_ads_schedule
  on public.ads(starts_at, ends_at)
  where active = true;

alter table public.ads enable row level security;

-- Direct client access denied — everything routes through the RPC below.
drop policy if exists ads_no_direct_access on public.ads;
create policy ads_no_direct_access
  on public.ads for all
  to anon, authenticated
  using (false)
  with check (false);

-- updated_at trigger
create or replace function public.touch_ads_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ads_touch_updated_at on public.ads;
create trigger trg_ads_touch_updated_at
  before update on public.ads
  for each row execute function public.touch_ads_updated_at();

-- ============================================================
-- 3) list_active_ads — REMOVED.
--
-- Earlier versions tried to mint signed URLs from inside PL/pgSQL via
-- `storage.create_signed_url(...)`, but that helper doesn't exist as a
-- callable SQL function in Supabase — signed URLs are only available
-- through the storage HTTP API (and the JS / server SDKs that wrap it).
--
-- Mobile now fetches active ads from the NestJS backend at
-- GET /ads/active?placement=banner|interstitial, which uses the
-- service-role JS client to mint URLs server-side.
--
-- This DROP is idempotent — safe even on databases where the function
-- never existed.
-- ============================================================
drop function if exists public.list_active_ads(text);

-- ============================================================
-- 4) Admin CRUD RPCs (called by wave-cms with the admin's JWT)
--
-- These check the caller is in admin_users via is_admin_user() defined
-- at the top of this file. The CMS already passes the admin JWT through
-- PostgREST; we look up admin_users.id = auth.uid().
-- ============================================================
create or replace function public.admin_create_ad(
  p_placement     text,
  p_title         text,
  p_subtitle      text,
  p_cta_label     text,
  p_cta_url       text,
  p_image_path    text,
  p_audio_path    text,
  p_nano_reward   integer,
  p_duration_sec  integer,
  p_display_order integer,
  p_active        boolean,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_admin_user() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  insert into public.ads (
    placement, title, subtitle, cta_label, cta_url,
    image_path, audio_path, nano_reward, duration_sec,
    display_order, active, starts_at, ends_at, created_by
  ) values (
    p_placement, p_title, p_subtitle, p_cta_label, p_cta_url,
    p_image_path, p_audio_path,
    coalesce(p_nano_reward, 1),
    coalesce(p_duration_sec, 10),
    coalesce(p_display_order, 0),
    coalesce(p_active, true),
    p_starts_at, p_ends_at,
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.admin_create_ad(
  text, text, text, text, text, text, text, integer, integer, integer, boolean, timestamptz, timestamptz
) to authenticated;

create or replace function public.admin_update_ad(
  p_id            uuid,
  p_title         text,
  p_subtitle      text,
  p_cta_label     text,
  p_cta_url       text,
  p_nano_reward   integer,
  p_duration_sec  integer,
  p_display_order integer,
  p_active        boolean,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz
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

  update public.ads
  set title         = coalesce(p_title,         title),
      subtitle      = coalesce(p_subtitle,      subtitle),
      cta_label     = coalesce(p_cta_label,     cta_label),
      cta_url       = coalesce(p_cta_url,       cta_url),
      nano_reward   = coalesce(p_nano_reward,   nano_reward),
      duration_sec  = coalesce(p_duration_sec,  duration_sec),
      display_order = coalesce(p_display_order, display_order),
      active        = coalesce(p_active,        active),
      starts_at     = p_starts_at,
      ends_at       = p_ends_at
  where id = p_id;
end;
$$;

grant execute on function public.admin_update_ad(
  uuid, text, text, text, text, integer, integer, integer, boolean, timestamptz, timestamptz
) to authenticated;

create or replace function public.admin_delete_ad(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  delete from public.ads where id = p_id;
end;
$$;

grant execute on function public.admin_delete_ad(uuid) to authenticated;

create or replace function public.admin_list_ads(p_placement text default null)
returns setof public.ads
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_placement is null then
    return query select * from public.ads order by placement, display_order, created_at desc;
  else
    return query select * from public.ads where placement = p_placement order by display_order, created_at desc;
  end if;
end;
$$;

grant execute on function public.admin_list_ads(text) to authenticated;
