import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

    const releaseId =
      targetType === 'release'
        ? targetId
        : targetType === 'track'
          ? await this.getReleaseIdForTrack(targetId)
          : null;

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

    // Splits and contributor credits (for edit + resolution flows)
    const trackIds = contested_tracks.map((t) => t.id).filter(Boolean);
    const [splitRes, contributorsRes] = await Promise.all([
      releaseId
        ? db
            .from('split_recipients')
            .select('id,release_id,name,identifier,role,share_percent,created_at')
            .eq('release_id', releaseId)
            .order('created_at', { ascending: true })
        : { data: [] },
      trackIds.length > 0
        ? db
            .from('contributors')
            .select('id,track_id,name,role,publisher,share_percent,created_at')
            .in('track_id', trackIds)
            .order('track_id')
            .order('created_at', { ascending: true })
        : { data: [] },
    ]);

    return {
      ...base,
      claimant,
      content_owner: contentOwner,
      contested_tracks,
      release_id: releaseId,
      split_recipients: (splitRes as any)?.data ?? [],
      contributors: (contributorsRes as any)?.data ?? [],
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
        const winnerDisplay = await this.getProfileDisplay(newOwnerId);
        const winnerName = winnerDisplay.display_name;

        // 1. Release: profile_id and all owner/artist fields to winning party
        await db
          .from('releases')
          .update({
            profile_id: newOwnerId,
            primary_artist: winnerName,
            license_owner: winnerName,
            updated_at: now,
          })
          .eq('id', releaseId);

        // 2. Assets: profile_id (ownership)
        await db.from('assets').update({ profile_id: newOwnerId, updated_at: now }).eq('release_id', releaseId);

        // 3. Tracks: every owner/artist mention to winning party
        const { data: releaseTracks } = await db.from('tracks').select('id').eq('release_id', releaseId);
        const trackIds = (releaseTracks ?? []).map((t: { id: string }) => t.id);
        if (trackIds.length > 0) {
          await db
            .from('tracks')
            .update({
              primary_artist: winnerName,
              rights_owner: winnerName,
              updated_at: now,
            })
            .in('id', trackIds);
        }

        // 4. Split recipients: assign 100% to winning party (replace existing for this release)
        await db.from('split_recipients').delete().eq('release_id', releaseId);
        await db.from('split_recipients').insert({
          release_id: releaseId,
          name: winnerName,
          role: 'artist',
          share_percent: 100,
        });

        // 5. Contributors: replace with winning party so credits transfer fully
        for (const trackId of trackIds) {
          await db.from('contributors').delete().eq('track_id', trackId);
          await db.from('contributors').insert({
            track_id: trackId,
            name: winnerName,
            role: 'writer',
            share_percent: 100,
          });
        }

        await db.from('audit_logs').insert({
          admin_id: adminId,
          action: 'dispute_transfer_ownership',
          entity_type: 'release',
          entity_id: releaseId,
          changes: { new_profile_id: newOwnerId, winner_display_name: winnerName },
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

  private normalizePercent(n: any): number {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, Math.round(v * 100) / 100));
  }

  private validatePercentTotal(rows: Array<{ share_percent: number }>, label: string) {
    const total = rows.reduce((s, r) => s + this.normalizePercent((r as any).share_percent), 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new BadRequestException(`${label} must total 100%. Current total: ${total}`);
    }
  }

  private async getReleaseIdForTrack(trackId: string): Promise<string | null> {
    const db = this.supabase.getClient();
    const { data } = await db.from('tracks').select('release_id').eq('id', trackId).maybeSingle();
    return (data as any)?.release_id ?? null;
  }

  /** Replace revenue splits for the dispute's release. */
  async replaceRevenueSplits(
    disputeId: string,
    adminId: string,
    splits: Array<{ name: string; role: string; identifier?: string | null; share_percent: number }>,
  ) {
    const releaseId = await this.getReleaseIdForDispute(disputeId);
    if (!releaseId) throw new BadRequestException('Dispute has no release context');
    if (!Array.isArray(splits) || splits.length === 0) throw new BadRequestException('splits are required');
    this.validatePercentTotal(splits as any, 'Revenue splits');

    const db = this.supabase.getClient();
    await db.from('split_recipients').delete().eq('release_id', releaseId);
    await db.from('split_recipients').insert(
      splits.map((s) => ({
        release_id: releaseId,
        name: String(s.name ?? '').trim(),
        role: String(s.role ?? '').trim(),
        identifier: s.identifier ?? null,
        share_percent: this.normalizePercent((s as any).share_percent),
      })),
    );
    await db.from('audit_logs').insert({
      admin_id: adminId,
      action: 'dispute_edit_revenue_splits',
      entity_type: 'release',
      entity_id: releaseId,
      changes: { dispute_id: disputeId, count: splits.length },
    });
    return { ok: true };
  }

  /** Replace contributor credits/splits for a track within the dispute context. */
  async replaceTrackContributors(
    disputeId: string,
    trackId: string,
    adminId: string,
    contributors: Array<{ name: string; role: string; publisher?: string | null; share_percent: number }>,
  ) {
    if (!trackId) throw new BadRequestException('trackId is required');
    const releaseId = await this.getReleaseIdForDispute(disputeId);
    if (!releaseId) throw new BadRequestException('Dispute has no release context');
    const trackReleaseId = await this.getReleaseIdForTrack(trackId);
    if (!trackReleaseId || trackReleaseId !== releaseId) throw new BadRequestException('Track is not part of the disputed release');
    if (!Array.isArray(contributors) || contributors.length === 0) throw new BadRequestException('contributors are required');
    this.validatePercentTotal(contributors as any, 'Contributor splits');

    const db = this.supabase.getClient();
    await db.from('contributors').delete().eq('track_id', trackId);
    await db.from('contributors').insert(
      contributors.map((c) => ({
        track_id: trackId,
        name: String(c.name ?? '').trim(),
        role: String(c.role ?? '').trim(),
        publisher: c.publisher ?? null,
        share_percent: this.normalizePercent((c as any).share_percent),
      })),
    );
    await db.from('audit_logs').insert({
      admin_id: adminId,
      action: 'dispute_edit_contributors',
      entity_type: 'track',
      entity_id: trackId,
      changes: { dispute_id: disputeId, count: contributors.length },
    });
    return { ok: true };
  }
}
