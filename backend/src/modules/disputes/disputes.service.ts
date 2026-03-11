import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class DisputesService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(opts: { status?: string; severity?: string; search?: string; limit?: number; offset?: number }) {
    const { status, severity, search, limit = 50, offset = 0 } = opts;
    let q = this.supabase.getClient()
      .from('disputes')
      .select('id,type,target_type,target_name,claimant_name,severity,status,priority,created_at,updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (search) q = q.or(`target_name.ilike.%${search}%,claimant_name.ilike.%${search}%,claim_detail.ilike.%${search}%`);
    if (status === 'active') {
      q = q.in('status', ['open', 'under_review', 'escalated', 'awaiting_uploader_response', 'awaiting_claimant_response']);
    } else if (status === 'resolved_claims') {
      q = q.in('status', ['resolved', 'closed']);
    } else if (status) {
      q = q.eq('status', status);
    }
    if (severity) q = q.eq('severity', severity);
    const { data, count, error } = await q;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async findById(id: string) {
    const db = this.supabase.getClient();
    const { data: dispute, error } = await db
      .from('disputes')
      .select(
        '*, ' +
        'dispute_evidence(id,name,file_url,type,uploader_name,note,uploaded_at), ' +
        'dispute_timeline(id,action,actor,detail,created_at), ' +
        'dispute_messages(id,sender_name,message,created_at), ' +
        'dispute_internal_notes(id,note,added_by,created_at)',
      )
      .eq('id', id)
      .single();
    if (error || !dispute) throw new NotFoundException('Dispute not found');

    const d = dispute as any;
    const submittedBy = d.submitted_by as string | null;
    const targetType = d.target_type as string;
    const targetId = d.target_id as string;

    let contentOwner: { id: string; email: string; display_name: string } | null = null;
    if (targetType === 'release' && targetId) {
      const { data: rel } = await db.from('releases').select('profile_id').eq('id', targetId).single();
      if (rel?.profile_id) contentOwner = await this.getProfileDisplay(rel.profile_id);
    } else if (targetType === 'track' && targetId) {
      const { data: track } = await db.from('tracks').select('release_id').eq('id', targetId).single();
      if (track?.release_id) {
        const { data: rel } = await db.from('releases').select('profile_id').eq('id', track.release_id).single();
        if (rel?.profile_id) contentOwner = await this.getProfileDisplay(rel.profile_id);
      }
    }

    let claimant: { id: string; email: string; display_name: string } | null = null;
    if (submittedBy) claimant = await this.getProfileDisplay(submittedBy);

    let contested_tracks: { id: string; title: string; file_url: string | null; file_name: string | null; duration_text: string | null; position: number }[] = [];
    if (targetType === 'release' && targetId) {
      const { data: tracks } = await db
        .from('tracks')
        .select('id,title,file_url,file_name,duration_text,position')
        .eq('release_id', targetId)
        .order('position', { ascending: true });
      contested_tracks = (tracks ?? []).map((t: any) => ({
        id: t.id,
        title: t.title,
        file_url: t.file_url,
        file_name: t.file_name,
        duration_text: t.duration_text,
        position: t.position ?? 0,
      }));
    } else if (targetType === 'track' && targetId) {
      const { data: track } = await db
        .from('tracks')
        .select('id,title,file_url,file_name,duration_text,position')
        .eq('id', targetId)
        .single();
      if (track) {
        contested_tracks = [{
          id: (track as any).id,
          title: (track as any).title,
          file_url: (track as any).file_url,
          file_name: (track as any).file_name,
          duration_text: (track as any).duration_text,
          position: (track as any).position ?? 0,
        }];
      }
    }

    const base = dispute as unknown as Record<string, unknown>;
    return {
      ...base,
      claimant,
      content_owner: contentOwner,
      contested_tracks,
    };
  }

  private async getProfileDisplay(profileId: string): Promise<{ id: string; email: string; display_name: string }> {
    const db = this.supabase.getClient();
    const { data: profile } = await db.from('profiles').select('id,email,username,org_name').eq('id', profileId).single();
    if (!profile) return { id: profileId, email: '', display_name: 'Unknown' };
    const { data: ap } = await db.from('artist_profiles').select('stage_name').eq('profile_id', profileId).maybeSingle();
    const { data: lp } = await db.from('label_profiles').select('label_name').eq('profile_id', profileId).maybeSingle();
    const { data: art } = await db.from('artists').select('name').eq('profile_id', profileId).limit(1);
    const display_name = (art as any)?.[0]?.name ?? (ap as any)?.stage_name ?? (lp as any)?.label_name ?? (profile as any).username ?? (profile as any).org_name ?? (profile as any).email ?? 'Unknown';
    return {
      id: profileId,
      email: (profile as any).email ?? '',
      display_name,
    };
  }

  async addInternalNote(disputeId: string, adminId: string, note: string) {
    const db = this.supabase.getClient();
    const { data, error } = await db
      .from('dispute_internal_notes')
      .insert({ dispute_id: disputeId, note: note.trim(), added_by: adminId })
      .select()
      .single();
    if (error) throw error;
    await db.from('audit_logs').insert({ admin_id: adminId, action: 'dispute_internal_note', entity_type: 'dispute', entity_id: disputeId });
    return data;
  }

  async updateStatus(
    id: string,
    status: string,
    adminId: string,
    opts: { resolution?: string; internalNote?: string; ruling?: string } = {},
  ) {
    const db = this.supabase.getClient();
    const now = new Date().toISOString();
    const ruling = opts.ruling;

    const normalizedRuling =
      ruling === 'in_favor_claimant' ? 'transfer_to_claimant'
      : ruling === 'in_favor_content_owner' ? 'transfer_to_content_owner'
      : ruling;

    let resolutionText = opts.resolution?.trim() ?? '';

    if (normalizedRuling === 'transfer_to_claimant' || normalizedRuling === 'transfer_to_content_owner') {
      const releaseId = await this.getReleaseIdForDispute(id);
      const disputeOwnerIds = await this.getOwnerProfileIdsForDispute(id);
      const newOwnerId =
        normalizedRuling === 'transfer_to_claimant'
          ? disputeOwnerIds.claimant_profile_id
          : disputeOwnerIds.content_owner_profile_id;

      if (releaseId && newOwnerId) {
        await db.from('releases').update({ profile_id: newOwnerId, updated_at: now }).eq('id', releaseId);
        await db.from('assets').update({ profile_id: newOwnerId, updated_at: now }).eq('release_id', releaseId);
        await db.from('audit_logs').insert({
          admin_id: adminId,
          action: 'dispute_transfer_ownership',
          entity_type: 'release',
          entity_id: releaseId,
          changes: { new_profile_id: newOwnerId },
        });
      }

      const who = normalizedRuling === 'transfer_to_claimant' ? 'claimant' : 'content owner';
      resolutionText = resolutionText
        ? `Ruled in favour of ${who}. Ownership transferred. ${resolutionText}`
        : `Ruled in favour of ${who}. Ownership transferred.`;
    } else if (normalizedRuling === 'take_down') {
      const releaseId = await this.getReleaseIdForDispute(id);
      if (releaseId) {
        await db.from('releases').update({ status: 'takedown', updated_at: now }).eq('id', releaseId);
        await db.from('audit_logs').insert({
          admin_id: adminId,
          action: 'dispute_takedown',
          entity_type: 'release',
          entity_id: releaseId,
        });
      }
      resolutionText = resolutionText ? `Take down permanently. ${resolutionText}` : 'Content taken down permanently.';
    } else if (normalizedRuling === 'take_down_cover_art') {
      const releaseId = await this.getReleaseIdForDispute(id);
      if (releaseId) {
        await db.from('releases').update({ cover_art_url: null, updated_at: now }).eq('id', releaseId);
        await db.from('audit_logs').insert({
          admin_id: adminId,
          action: 'dispute_takedown_cover_art',
          entity_type: 'release',
          entity_id: releaseId,
        });
      }
      resolutionText = resolutionText ? `Cover art taken down. ${resolutionText}` : 'Cover art taken down.';
    } else if (normalizedRuling === 'close') {
      resolutionText = resolutionText ? `Closed (dismissed). ${resolutionText}` : 'Closed (dismissed).';
    }

    if (opts.internalNote?.trim()) {
      await db.from('dispute_internal_notes').insert({
        dispute_id: id,
        note: opts.internalNote.trim(),
        added_by: adminId,
      });
    }
    if (resolutionText) {
      await db.from('dispute_internal_notes').insert({
        dispute_id: id,
        note: `[Ruling] ${resolutionText}`,
        added_by: adminId,
      });
      await db.from('dispute_timeline').insert({
        dispute_id: id,
        action: 'Admin ruling',
        actor: 'Wave Admin',
        detail: resolutionText,
        created_at: now,
      });
    }

    const { data, error } = await db
      .from('disputes')
      .update({ status, updated_at: now, assigned_to: adminId })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await db.from('audit_logs').insert({ admin_id: adminId, action: `dispute_${status}`, entity_type: 'dispute', entity_id: id });
    return data;
  }

  private async getReleaseIdForDispute(disputeId: string): Promise<string | null> {
    const db = this.supabase.getClient();
    const { data: dispute } = await db.from('disputes').select('target_type,target_id').eq('id', disputeId).single();
    if (!dispute) return null;
    const d = dispute as { target_type: string; target_id: string };
    if (d.target_type === 'release') return d.target_id;
    if (d.target_type === 'track') {
      const { data: track } = await db.from('tracks').select('release_id').eq('id', d.target_id).single();
      return (track as { release_id: string } | null)?.release_id ?? null;
    }
    return null;
  }

  private async getOwnerProfileIdsForDispute(disputeId: string): Promise<{ claimant_profile_id: string | null; content_owner_profile_id: string | null }> {
    const db = this.supabase.getClient();
    const { data: dispute } = await db.from('disputes').select('submitted_by,target_type,target_id').eq('id', disputeId).single();
    if (!dispute) return { claimant_profile_id: null, content_owner_profile_id: null };
    const d = dispute as { submitted_by: string | null; target_type: string; target_id: string };
    const claimant_profile_id = d.submitted_by ?? null;

    let content_owner_profile_id: string | null = null;
    if (d.target_type === 'release') {
      const { data: rel } = await db.from('releases').select('profile_id').eq('id', d.target_id).single();
      content_owner_profile_id = (rel as any)?.profile_id ?? null;
    } else if (d.target_type === 'track') {
      const { data: track } = await db.from('tracks').select('release_id').eq('id', d.target_id).single();
      const releaseId = (track as any)?.release_id as string | null;
      if (releaseId) {
        const { data: rel } = await db.from('releases').select('profile_id').eq('id', releaseId).single();
        content_owner_profile_id = (rel as any)?.profile_id ?? null;
      }
    }

    return { claimant_profile_id, content_owner_profile_id };
  }
}
