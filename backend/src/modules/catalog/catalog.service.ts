import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class CatalogService {
  constructor(private readonly supabase: SupabaseService) {}

  async findReleases(opts: { search?: string; status?: string; limit?: number; offset?: number }) {
    const { search, status, limit = 50, offset = 0 } = opts;
    // Super Admin must not see drafts (drafts are user-only).
    if (status === 'draft') return { data: [], total: 0 };
    let q = this.supabase.getClient()
      .from('releases')
      .select('id,title,primary_artist,status,type,release_date,created_at,metadata_completeness_score', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (search) q = q.or(`title.ilike.%${search}%,primary_artist.ilike.%${search}%`);
    q = q.neq('status', 'draft');
    if (status) q = q.eq('status', status);
    const { data, count, error } = await q;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async findRelease(id: string) {
    const { data: release, error } = await this.supabase.getClient()
      .from('releases')
      .select('*, tracks(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    if ((release as any)?.status === 'draft') {
      throw new ForbiddenException('Draft releases are not visible in Super Admin.');
    }
    const tracks = (release as any).tracks ?? [];
    const trackIds = tracks.map((t: any) => t.id).filter(Boolean);

    const [splitRes, contributorsRes] = await Promise.all([
      this.supabase.getClient()
        .from('split_recipients')
        .select('id, release_id, name, identifier, role, share_percent, created_at')
        .eq('release_id', id)
        .order('created_at', { ascending: true }),
      trackIds.length > 0
        ? this.supabase.getClient()
            .from('contributors')
            .select('id, track_id, name, role, publisher, share_percent, created_at')
            .in('track_id', trackIds)
            .order('track_id')
            .order('created_at', { ascending: true })
        : { data: [] },
    ]);

    const split_recipients = splitRes.data ?? [];
    const contributorsByTrack: Record<string, any[]> = {};
    (contributorsRes.data ?? []).forEach((c: any) => {
      if (!contributorsByTrack[c.track_id]) contributorsByTrack[c.track_id] = [];
      contributorsByTrack[c.track_id].push(c);
    });

    const tracksWithContributors = tracks.map((t: any) => ({
      ...t,
      contributors: contributorsByTrack[t.id] ?? [],
    }));

    return {
      ...release,
      tracks: tracksWithContributors,
      split_recipients,
    };
  }

  async updateReleaseStatus(id: string, status: string, adminId: string, comment?: string) {
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (comment != null && comment.trim() !== '') {
      updates.reviewer_comment = comment.trim();
    }
    const { data, error } = await this.supabase.getClient()
      .from('releases')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await this.supabase.getClient()
      .from('audit_logs')
      .insert({
        admin_id: adminId,
        action: 'update_status',
        entity_type: 'release',
        entity_id: id,
        changes: { status, comment: comment ?? null },
      });
    return data;
  }

  async findTracks(opts: { search?: string; limit?: number; offset?: number }) {
    const { search, limit = 50, offset = 0 } = opts;
    let q = this.supabase.getClient()
      .from('tracks')
      .select('id,title,isrc,upload_status,created_at,releases(title)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (search) q = q.ilike('title', `%${search}%`);
    const { data, count, error } = await q;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async takedownRelease(id: string, adminId: string, comment?: string) {
    return this.updateReleaseStatus(id, 'takedown', adminId, comment);
  }

  async forcePublishRelease(id: string, adminId: string, comment?: string) {
    return this.updateReleaseStatus(id, 'published', adminId, comment);
  }

  private parseStorageKey(key: string | null | undefined): { bucket: string; path: string } | null {
    if (!key) return null;
    // If it's a full URL, we can't reliably map it back to a storage path here.
    if (/^https?:\/\//i.test(key)) return null;
    const slash = key.indexOf('/');
    if (slash === -1) return null;
    return { bucket: key.slice(0, slash), path: key.slice(slash + 1) };
  }

  private async removeStorageKeys(keys: Array<string | null | undefined>) {
    const resolved = keys
      .map((k) => this.parseStorageKey(k))
      .filter(Boolean) as Array<{ bucket: string; path: string }>;
    // Best-effort deletes. We intentionally ignore errors here to ensure DB cleanup proceeds.
    for (const { bucket, path } of resolved) {
      try {
        await this.supabase.getClient().storage.from(bucket).remove([path]);
      } catch {
        // ignore
      }
    }
  }

  /** Permanently remove a release everywhere (DB + storage best-effort). */
  async permanentDeleteRelease(id: string, adminId: string, comment?: string) {
    if (!comment || comment.trim() === '') {
      throw new BadRequestException('comment is required');
    }

    // Load release + tracks first (for cascade deletes and storage cleanup)
    const { data: release, error } = await this.supabase.getClient()
      .from('releases')
      .select('id,status,cover_art_url,tracks(id,file_url,file_name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    if ((release as any)?.status === 'draft') {
      throw new ForbiddenException('Draft releases are user-only and cannot be permanently deleted from Super Admin.');
    }

    const tracks = ((release as any).tracks ?? []) as Array<{ id: string; file_url: string | null; file_name: string | null }>;
    const trackIds = tracks.map((t) => t.id).filter(Boolean);

    // Remove storage objects best-effort (cover art + audio files)
    await this.removeStorageKeys([
      (release as any).cover_art_url,
      ...tracks.map((t) => t.file_url),
    ]);

    // Delete dependent rows (best-effort; keep going even if some tables don't have rows)
    if (trackIds.length > 0) {
      await this.supabase.getClient().from('contributors').delete().in('track_id', trackIds);
      // Disputes can target tracks; remove those too.
      await this.supabase.getClient().from('disputes').delete().in('target_id', trackIds);
    }
    await this.supabase.getClient().from('split_recipients').delete().eq('release_id', id);
    await this.supabase.getClient().from('assets').delete().eq('release_id', id);
    // Disputes can target the release directly.
    await this.supabase.getClient().from('disputes').delete().eq('target_id', id);
    await this.supabase.getClient().from('tracks').delete().eq('release_id', id);
    await this.supabase.getClient().from('releases').delete().eq('id', id);

    // Keep an audit breadcrumb that a purge happened (does not keep the content itself).
    await this.supabase.getClient()
      .from('audit_logs')
      .insert({
        admin_id: adminId,
        action: 'permanent_delete_release',
        entity_type: 'release',
        entity_id: id,
        changes: { comment: comment.trim(), deleted_track_ids: trackIds },
      });

    return { ok: true };
  }

  /** Admin can update any release field (partial update) */
  async updateRelease(id: string, body: Record<string, unknown>, adminId: string) {
    const allowed = [
      'title', 'primary_artist', 'label', 'type', 'primary_genre', 'primary_language', 'release_date',
      'explicit_content', 'territory', 'upc', 'catalog_number', 'rights_type', 'license_type', 'license_owner',
      'license_territory', 'license_start', 'license_end', 'license_evidence_url', 'confirm_rights', 'confirm_credits',
      'confirm_splits', 'confirm_terms', 'distribution_wave', 'distribution_external', 'cover_art_url',
      'reviewer_comment', 'description',
    ];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    const { data, error } = await this.supabase.getClient()
      .from('releases')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await this.supabase.getClient()
      .from('audit_logs')
      .insert({ admin_id: adminId, action: 'update_release', entity_type: 'release', entity_id: id, changes: patch });
    return data;
  }

  /** Admin can update any track field (partial update) */
  async updateTrack(id: string, body: Record<string, unknown>, adminId: string) {
    const allowed = [
      'title', 'subtitle', 'artists', 'position', 'primary_artist', 'featured_artists', 'producers', 'composers',
      'lyricists', 'publishers', 'duration_seconds', 'duration_text', 'explicit', 'isrc', 'track_language',
      'instrumental', 'clean_version_exists', 'p_line', 'c_line', 'year_of_recording', 'year_of_release',
      'primary_genre', 'sub_genre', 'mood_tags', 'tempo', 'musical_key', 'theme_tags', 'cultural_tag',
      'lyrics', 'lyrics_translation', 'track_rights_type', 'license_type', 'rights_owner', 'territory',
      'rights_doc_uploaded', 'original_artist', 'original_publisher', 'sample_owner', 'clearance_doc_uploaded',
      'preview_start_time',
    ];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    const { data, error } = await this.supabase.getClient()
      .from('tracks')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await this.supabase.getClient()
      .from('audit_logs')
      .insert({ admin_id: adminId, action: 'update_track', entity_type: 'track', entity_id: id, changes: patch });
    return data;
  }
}
