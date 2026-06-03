-- ============================================================
-- 006_taxonomy_rename_delete.sql
--
-- Rename + delete cascade for sa_taxonomies.
--
-- The mobile app stores the taxonomy LABEL (not the value) in
-- mobile_users.taste_genres/taste_languages, and the CMS catalog
-- stores LABEL strings in releases.primary_genre / primary_language
-- and tracks.primary_genre / sub_genre. Renaming a taxonomy without
-- cascading would orphan all those rows — they'd still hold the old
-- string and stop matching the canonical list.
--
-- This migration adds two SECURITY DEFINER RPCs that admin UI calls:
--
--   sa_taxonomy_rename(p_id, p_new_label):
--     - Renames the taxonomy and cascades the new label into every
--       referencing table in one transaction.
--     - Refuses if p_new_label collides with another taxonomy of the
--       same type.
--
--   sa_taxonomy_delete(p_id):
--     - STRICT: refuses delete if ANY release, track, or user still
--       references the label. Returns a count per reference type so
--       the admin UI can show a useful message.
--     - When refused, admin must either toggle active=false (hide
--       from new pickers, keep existing data intact) or manually
--       reassign references before deleting.
--
-- Both RPCs are SECURITY DEFINER so they can write to tables the
-- admin role might not have direct grants on. Restricted to the
-- super-admin role only — NOT to authenticated, so the mobile app
-- can never call them.
--
-- Safe to re-run.
-- ============================================================

BEGIN;

-- ============================================================
-- RENAME with cascade
-- ============================================================

CREATE OR REPLACE FUNCTION public.sa_taxonomy_rename(
  p_id        uuid,
  p_new_label text
)
RETURNS TABLE (
  ok                  boolean,
  reason              text,
  releases_updated    integer,
  tracks_updated      integer,
  users_updated       integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_taxonomy   RECORD;
  v_new_label  text;
  v_collision  uuid;
  v_releases   integer := 0;
  v_tracks     integer := 0;
  v_users      integer := 0;
BEGIN
  v_new_label := btrim(coalesce(p_new_label, ''));
  IF v_new_label = '' THEN
    RETURN QUERY SELECT false, 'New label cannot be empty'::text, 0, 0, 0;
    RETURN;
  END IF;

  SELECT id, type, value, label INTO v_taxonomy
  FROM public.sa_taxonomies
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Taxonomy not found'::text, 0, 0, 0;
    RETURN;
  END IF;

  -- No-op rename: skip the cascade work but report success so the UI
  -- doesn't show a confusing error.
  IF v_taxonomy.label = v_new_label THEN
    RETURN QUERY SELECT true, 'No change'::text, 0, 0, 0;
    RETURN;
  END IF;

  -- Block collisions: don't let two taxonomies of the same type share
  -- a label, which would break the unique display contract.
  SELECT id INTO v_collision
  FROM public.sa_taxonomies
  WHERE type = v_taxonomy.type
    AND label = v_new_label
    AND id <> p_id
  LIMIT 1;

  IF v_collision IS NOT NULL THEN
    RETURN QUERY SELECT false,
      format('Another %s already has the label "%s"', v_taxonomy.type, v_new_label)::text,
      0, 0, 0;
    RETURN;
  END IF;

  -- Cascade order matters less than atomicity. Whole thing runs in
  -- the same transaction; any failure rolls everything back.

  -- 1. The canonical row itself.
  UPDATE public.sa_taxonomies
     SET label = v_new_label,
         updated_at = now()
   WHERE id = p_id;

  -- 2. Release-level references.
  IF v_taxonomy.type = 'genre' THEN
    UPDATE public.releases
       SET primary_genre = v_new_label
     WHERE primary_genre = v_taxonomy.label;
    GET DIAGNOSTICS v_releases = ROW_COUNT;

    UPDATE public.tracks
       SET primary_genre = v_new_label
     WHERE primary_genre = v_taxonomy.label;
    GET DIAGNOSTICS v_tracks = ROW_COUNT;

  ELSIF v_taxonomy.type = 'sub_genre' THEN
    -- Sub-genres only live on tracks (releases have only primary_genre).
    UPDATE public.tracks
       SET sub_genre = v_new_label
     WHERE sub_genre = v_taxonomy.label;
    GET DIAGNOSTICS v_tracks = ROW_COUNT;

  ELSIF v_taxonomy.type = 'language' THEN
    UPDATE public.releases
       SET primary_language = v_new_label
     WHERE primary_language = v_taxonomy.label;
    GET DIAGNOSTICS v_releases = ROW_COUNT;
    -- (Tracks don't have a language column today; if added later,
    -- mirror the genre pattern.)
  END IF;

  -- 3. Mobile user preferences (array columns).
  IF v_taxonomy.type = 'genre' THEN
    UPDATE public.mobile_users
       SET taste_genres = array_replace(taste_genres, v_taxonomy.label, v_new_label),
           updated_at = now()
     WHERE v_taxonomy.label = ANY(taste_genres);
    GET DIAGNOSTICS v_users = ROW_COUNT;
  ELSIF v_taxonomy.type = 'language' THEN
    UPDATE public.mobile_users
       SET taste_languages = array_replace(taste_languages, v_taxonomy.label, v_new_label),
           updated_at = now()
     WHERE v_taxonomy.label = ANY(taste_languages);
    GET DIAGNOSTICS v_users = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT true, 'ok'::text, v_releases, v_tracks, v_users;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sa_taxonomy_rename(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sa_taxonomy_rename(uuid, text) FROM authenticated, anon;
-- Super-admin frontend uses the service-role key, so no explicit GRANT
-- needed. If you ever introduce a 'super_admin' DB role, add:
--   GRANT EXECUTE ON FUNCTION public.sa_taxonomy_rename(uuid, text) TO super_admin;

-- ============================================================
-- DELETE with strict reference check
-- ============================================================

CREATE OR REPLACE FUNCTION public.sa_taxonomy_delete(
  p_id uuid
)
RETURNS TABLE (
  ok                       boolean,
  reason                   text,
  releases_referencing     integer,
  tracks_referencing       integer,
  users_referencing        integer,
  sub_genres_referencing   integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_taxonomy          RECORD;
  v_releases          integer := 0;
  v_tracks            integer := 0;
  v_users             integer := 0;
  v_sub_genres        integer := 0;
  v_total             integer := 0;
BEGIN
  SELECT id, type, value, label INTO v_taxonomy
  FROM public.sa_taxonomies
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Taxonomy not found'::text, 0, 0, 0, 0;
    RETURN;
  END IF;

  -- Count references per source. Strict mode: if any > 0, refuse.
  IF v_taxonomy.type = 'genre' THEN
    SELECT count(*) INTO v_releases FROM public.releases
     WHERE primary_genre = v_taxonomy.label;
    SELECT count(*) INTO v_tracks FROM public.tracks
     WHERE primary_genre = v_taxonomy.label;
    SELECT count(*) INTO v_users FROM public.mobile_users
     WHERE v_taxonomy.label = ANY(taste_genres);
    -- Sub-genres reference the parent genre via parent_id.
    SELECT count(*) INTO v_sub_genres FROM public.sa_taxonomies
     WHERE parent_id = p_id;

  ELSIF v_taxonomy.type = 'sub_genre' THEN
    SELECT count(*) INTO v_tracks FROM public.tracks
     WHERE sub_genre = v_taxonomy.label;

  ELSIF v_taxonomy.type = 'language' THEN
    SELECT count(*) INTO v_releases FROM public.releases
     WHERE primary_language = v_taxonomy.label;
    SELECT count(*) INTO v_users FROM public.mobile_users
     WHERE v_taxonomy.label = ANY(taste_languages);

  -- Other taxonomy types (mood, credit_role, tag) currently have no
  -- direct catalog references — feel free to add counts here as those
  -- get wired up. For now, allowing delete is safe.
  END IF;

  v_total := v_releases + v_tracks + v_users + v_sub_genres;

  IF v_total > 0 THEN
    RETURN QUERY SELECT
      false,
      format(
        'Cannot delete: %s release(s), %s track(s), %s user(s), %s sub-genre(s) still reference this. Toggle active=false to hide it, or remap the references first.',
        v_releases, v_tracks, v_users, v_sub_genres
      )::text,
      v_releases, v_tracks, v_users, v_sub_genres;
    RETURN;
  END IF;

  DELETE FROM public.sa_taxonomies WHERE id = p_id;

  RETURN QUERY SELECT true, 'ok'::text, 0, 0, 0, 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sa_taxonomy_delete(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sa_taxonomy_delete(uuid) FROM authenticated, anon;

COMMIT;

-- ─── Verification ─────────────────────────────────────────────────────
-- Rename a genre:
--   select * from public.sa_taxonomy_rename(
--     '<genre-uuid>'::uuid, 'New Label Here'
--   );
--   -- expect ok=true, with counts for affected releases/tracks/users.
--
-- Try to rename to a label that already exists for the same type:
--   select * from public.sa_taxonomy_rename(
--     '<genre-uuid>'::uuid, 'Pop'
--   );
--   -- expect ok=false, reason='Another genre already has the label "Pop"'
--
-- Delete a taxonomy still in use:
--   select * from public.sa_taxonomy_delete('<genre-uuid>'::uuid);
--   -- expect ok=false, counts > 0
--
-- Delete an unreferenced taxonomy:
--   -- (create a test row first):
--   insert into public.sa_taxonomies (type, value, label)
--   values ('genre', 'test_delete_me', 'Test Delete Me');
--   -- then delete:
--   select * from public.sa_taxonomy_delete(
--     (select id from public.sa_taxonomies where value='test_delete_me')
--   );
--   -- expect ok=true
