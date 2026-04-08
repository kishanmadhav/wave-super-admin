import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class PipelinesService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Returns all artists from the artists table with verification status for the queue */
  async getAccountVerifications(opts: { status?: string } = {}) {
    const { data: artists, error } = await this.supabase.getClient()
      .from('artists')
      .select('id, profile_id, name, handle, bio, location, followers, verified, created_at, profiles(email, country, account_type)')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const profileIds = (artists ?? []).map((a: any) => a.profile_id).filter(Boolean) as string[];
    const latestByProfile: Record<string, { id: string; status: string; risk_score: number }> = {};

    if (profileIds.length > 0) {
      const { data: verifications } = await this.supabase.getClient()
        .from('account_verifications')
        .select('id,profile_id,status,risk_score,created_at')
        .in('profile_id', profileIds)
        .order('created_at', { ascending: false });

      (verifications ?? []).forEach((v: any) => {
        if (!latestByProfile[v.profile_id]) {
          latestByProfile[v.profile_id] = { id: v.id, status: v.status, risk_score: v.risk_score ?? 0 };
        }
      });
    }

    const data = (artists ?? []).map((row: any) => {
      const profile = row.profiles;
      const ver = row.profile_id ? latestByProfile[row.profile_id] : undefined;
      // Derive status: if artists.verified is true, treat as verified regardless of account_verifications
      const status = row.verified ? 'verified' : (ver?.status ?? 'none');
      return {
        profile_id: row.profile_id,
        artist_id: row.id,
        account_verification_id: ver?.id ?? null,
        display_name: row.name,
        account_name: row.name,
        account_type: profile?.account_type ?? 'artist',
        email: profile?.email ?? '',
        country: profile?.country ?? null,
        risk_score: ver?.risk_score ?? 0,
        status,
        verified: row.verified ?? false,
        created_at: row.created_at,
      };
    });

    const pendingStatuses = ['none', 'created', 'submitted', 'maker_approved'];
    let filtered = data;
    if (opts.status && opts.status !== 'all') {
      if (opts.status === 'pending') {
        filtered = data.filter((d: any) => pendingStatuses.includes(d.status));
      } else {
        filtered = data.filter((d: any) => d.status === opts.status);
      }
    }
    return { data: filtered, total: filtered.length };
  }

  /** Full creator detail for review (by profile_id) — all info shown on Creators page + verification */
  async getCreatorDetailForReview(profileId: string) {
    const { data: profile, error: profileErr } = await this.supabase.getClient()
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();
    if (profileErr || !profile) throw new NotFoundException('Creator not found');

    const [{ data: artistProfile }, { data: labelProfile }, { data: artists }, { data: verifications }, { data: releases }] = await Promise.all([
      this.supabase.getClient().from('artist_profiles').select('*').eq('profile_id', profileId).maybeSingle(),
      this.supabase.getClient().from('label_profiles').select('*').eq('profile_id', profileId).maybeSingle(),
      this.supabase.getClient().from('artists').select('id,name,handle,bio,genres,location,profile_photo_url,verified').eq('profile_id', profileId).limit(10),
      this.supabase.getClient().from('account_verifications').select('id,status,risk_score,created_at,updated_at').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(1),
      this.supabase.getClient().from('releases').select('id,title,type,status,primary_artist,release_date,created_at,tracks(id,position,title,duration_seconds,duration_text,isrc)').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(100),
    ]);

    const latestVerification = Array.isArray(verifications) && verifications.length > 0 ? verifications[0] : null;
    const display_name =
      (artists ?? [])[0]?.name ??
      (artistProfile as any)?.stage_name ??
      (labelProfile as any)?.label_name ??
      profile.username ??
      profile.org_name ??
      profile.email;

    return {
      profile_id: profileId,
      account_verification_id: (latestVerification as any)?.id ?? null,
      display_name,
      account_name: display_name,
      email: profile.email,
      username: profile.username,
      org_name: profile.org_name,
      account_type: profile.account_type,
      country: profile.country,
      timezone: profile.timezone,
      created_at: profile.created_at,
      verification_status: (latestVerification as any)?.status ?? 'none',
      risk_score: (latestVerification as any)?.risk_score ?? 0,
      profile: profile,
      artist_profile: artistProfile ?? null,
      label_profile: labelProfile ?? null,
      artists: artists ?? [],
      releases: (releases ?? []).map((r: any) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        status: r.status,
        primary_artist: r.primary_artist,
        release_date: r.release_date,
        created_at: r.created_at,
        tracks: (r.tracks ?? []).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)),
      })),
    };
  }

  /** Approve = set verified (callers use POST /creators/profiles/:id/verify) */
  async updateAccountVerificationStatus(id: string, status: string, adminId: string, _notes?: string) {
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString(), assigned_to: adminId };
    const { data, error } = await this.supabase.getClient()
      .from('account_verifications')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await this.supabase.getClient()
      .from('audit_logs')
      .insert({ admin_id: adminId, action: status, entity_type: 'account_verification', entity_id: id });
    return data;
  }

  /** Reject creator by profile_id: create or update account_verifications to rejected */
  async rejectCreator(profileId: string, adminId: string) {
    const { data: existing } = await this.supabase.getClient()
      .from('account_verifications')
      .select('id')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(1);

    const client = this.supabase.getClient();
    if (existing && existing.length > 0) {
      const id = (existing[0] as any).id;
      await client.from('account_verifications').update({
        status: 'rejected',
        assigned_to: adminId,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    } else {
      const { data: profile } = await client.from('profiles').select('email,username,org_name,account_type').eq('id', profileId).single();
      const accountName = (profile as any)?.org_name ?? (profile as any)?.username ?? (profile as any)?.email ?? 'Unknown';
      await client.from('account_verifications').insert({
        profile_id: profileId,
        account_name: accountName,
        account_type: (profile as any)?.account_type ?? 'artist',
        email: (profile as any)?.email ?? '',
        status: 'rejected',
        assigned_to: adminId,
        submitted_by: profileId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    // Also mark artists rows as not verified
    await client.from('artists').update({ verified: false }).eq('profile_id', profileId);

    await client.from('audit_logs').insert({
      admin_id: adminId,
      action: 'reject_creator',
      entity_type: 'profile',
      entity_id: profileId,
    });
    return { ok: true };
  }
}
