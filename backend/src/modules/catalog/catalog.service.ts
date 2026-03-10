import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class CatalogService {
  constructor(private readonly supabase: SupabaseService) {}

  async findReleases(opts: { search?: string; status?: string; limit?: number; offset?: number }) {
    const { search, status, limit = 50, offset = 0 } = opts;
    let q = this.supabase.getClient()
      .from('releases')
      .select('id,title,primary_artist,status,type,release_date,created_at,metadata_completeness_score', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (search) q = q.or(`title.ilike.%${search}%,primary_artist.ilike.%${search}%`);
    if (status) q = q.eq('status', status);
    const { data, count, error } = await q;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async findRelease(id: string) {
    const { data, error } = await this.supabase.getClient()
      .from('releases')
      .select('*, tracks(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
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
}
