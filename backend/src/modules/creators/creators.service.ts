import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

type CreatorVerificationStatus =
  | 'none'
  | 'created'
  | 'submitted'
  | 'maker_approved'
  | 'verified'
  | 'changes_requested'
  | 'rejected'
  | 'suspended';

@Injectable()
export class CreatorsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listArtists(opts: { search?: string; limit?: number; offset?: number }) {
    const { search, limit = 50, offset = 0 } = opts;
    let q = this.supabase
      .getClient()
      .from('artists')
      .select('id, profile_id, name, handle, location, followers, verified, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) q = q.or(`name.ilike.%${search}%,handle.ilike.%${search}%`);

    const { data: artists, count, error } = await q;
    if (error) throw error;

    const profileIds = (artists ?? [])
      .map((a: any) => a.profile_id)
      .filter(Boolean) as string[];

    const verificationByProfileId = await this.getLatestVerificationByProfileIds(profileIds);

    const enriched = (artists ?? []).map((a: any) => ({
      ...a,
      verification_status: a.profile_id
        ? (verificationByProfileId[a.profile_id] ?? 'none')
        : 'none',
    }));

    return { data: enriched, total: count ?? 0 };
  }

  async listLabels(opts: { search?: string; limit?: number; offset?: number }) {
    const { search, limit = 50, offset = 0 } = opts;
    let q = this.supabase
      .getClient()
      .from('label_profiles')
      .select(
        'id, profile_id, label_name, legal_entity_name, registered_country, created_at, profiles(email)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) q = q.or(`label_name.ilike.%${search}%,legal_entity_name.ilike.%${search}%`);

    const { data: labels, count, error } = await q;
    if (error) throw error;

    const profileIds = (labels ?? [])
      .map((l: any) => l.profile_id)
      .filter(Boolean) as string[];

    const verificationByProfileId = await this.getLatestVerificationByProfileIds(profileIds);

    const enriched = (labels ?? []).map((l: any) => ({
      ...l,
      verification_status: l.profile_id
        ? (verificationByProfileId[l.profile_id] ?? 'none')
        : 'none',
    }));

    return { data: enriched, total: count ?? 0 };
  }

  async verifyCreator(profileId: string, adminId: string) {
    if (!profileId) throw new BadRequestException('Missing profileId');

    const { data: profile, error: profileErr } = await this.supabase
      .getClient()
      .from('profiles')
      .select('id, email, account_type, org_name, username')
      .eq('id', profileId)
      .single();

    if (profileErr || !profile) throw new BadRequestException('Profile not found');

    // Update the most recent account_verifications row if present; otherwise insert a new one.
    const { data: existing } = await this.supabase
      .getClient()
      .from('account_verifications')
      .select('id')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      const id = (existing[0] as any).id as string;
      const { error } = await this.supabase
        .getClient()
        .from('account_verifications')
        .update({ status: 'verified', assigned_to: adminId, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } else {
      const accountName =
        (profile.org_name as string | null) ??
        (profile.username as string | null) ??
        profile.email;

      const { error } = await this.supabase
        .getClient()
        .from('account_verifications')
        .insert({
          profile_id: profileId,
          account_name: accountName,
          account_type: profile.account_type ?? 'artist',
          email: profile.email,
          status: 'verified',
          assigned_to: adminId,
          submitted_by: profileId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    }

    // Also mark artists rows as verified
    await this.supabase.getClient()
      .from('artists')
      .update({ verified: true })
      .eq('profile_id', profileId);

    await this.supabase.getClient().from('audit_logs').insert({
      admin_id: adminId,
      action: 'verify_creator',
      entity_type: 'profile',
      entity_id: profileId,
    });

    return { ok: true };
  }

  async unverifyCreator(profileId: string, adminId: string) {
    if (!profileId) throw new BadRequestException('Missing profileId');

    // Mark latest row as submitted again (keeps history intact).
    const { data: existing, error: exErr } = await this.supabase
      .getClient()
      .from('account_verifications')
      .select('id')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (exErr) throw exErr;

    if (!existing || existing.length === 0) {
      return { ok: true };
    }

    const id = (existing[0] as any).id as string;
    const { error } = await this.supabase
      .getClient()
      .from('account_verifications')
      .update({ status: 'submitted', assigned_to: adminId, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    // Also mark artists rows as unverified
    await this.supabase.getClient()
      .from('artists')
      .update({ verified: false })
      .eq('profile_id', profileId);

    await this.supabase.getClient().from('audit_logs').insert({
      admin_id: adminId,
      action: 'unverify_creator',
      entity_type: 'profile',
      entity_id: profileId,
    });

    return { ok: true };
  }

  async deleteArtist(artistId: string, adminId: string) {
    if (!artistId) throw new BadRequestException('Missing artistId');

    const { data: artist, error: fetchErr } = await this.supabase
      .getClient()
      .from('artists')
      .select('id, name, profile_id')
      .eq('id', artistId)
      .single();
    if (fetchErr || !artist) throw new BadRequestException('Artist not found');

    const { error } = await this.supabase
      .getClient()
      .from('artists')
      .delete()
      .eq('id', artistId);
    if (error) throw error;

    await this.supabase.getClient().from('audit_logs').insert({
      admin_id: adminId,
      action: 'delete_artist',
      entity_type: 'artist',
      entity_id: artistId,
    });

    return { ok: true };
  }

  async deleteLabel(labelId: string, adminId: string) {
    if (!labelId) throw new BadRequestException('Missing labelId');

    const { data: label, error: fetchErr } = await this.supabase
      .getClient()
      .from('label_profiles')
      .select('id, label_name, profile_id')
      .eq('id', labelId)
      .single();
    if (fetchErr || !label) throw new BadRequestException('Label not found');

    const { error } = await this.supabase
      .getClient()
      .from('label_profiles')
      .delete()
      .eq('id', labelId);
    if (error) throw error;

    await this.supabase.getClient().from('audit_logs').insert({
      admin_id: adminId,
      action: 'delete_label',
      entity_type: 'label_profile',
      entity_id: labelId,
    });

    return { ok: true };
  }

  async disableArtist(artistId: string, adminId: string, reason: string) {
    if (!artistId) throw new BadRequestException('Missing artistId');

    const { data: artist, error: fetchErr } = await this.supabase
      .getClient()
      .from('artists')
      .select('id, profile_id')
      .eq('id', artistId)
      .single();
    if (fetchErr || !artist) throw new BadRequestException('Artist not found');

    if (!artist.profile_id) throw new BadRequestException('Artist has no linked profile');

    const { error } = await this.supabase
      .getClient()
      .from('profiles')
      .update({ suspended_at: new Date().toISOString(), suspended_reason: reason })
      .eq('id', artist.profile_id);
    if (error) throw error;

    await this.supabase.getClient().from('audit_logs').insert({
      admin_id: adminId,
      action: 'disable_artist',
      entity_type: 'artist',
      entity_id: artistId,
    });

    return { ok: true };
  }

  async disableLabel(labelId: string, adminId: string, reason: string) {
    if (!labelId) throw new BadRequestException('Missing labelId');

    const { data: label, error: fetchErr } = await this.supabase
      .getClient()
      .from('label_profiles')
      .select('id, profile_id')
      .eq('id', labelId)
      .single();
    if (fetchErr || !label) throw new BadRequestException('Label not found');

    if (!label.profile_id) throw new BadRequestException('Label has no linked profile');

    const { error } = await this.supabase
      .getClient()
      .from('profiles')
      .update({ suspended_at: new Date().toISOString(), suspended_reason: reason })
      .eq('id', label.profile_id);
    if (error) throw error;

    await this.supabase.getClient().from('audit_logs').insert({
      admin_id: adminId,
      action: 'disable_label',
      entity_type: 'label_profile',
      entity_id: labelId,
    });

    return { ok: true };
  }

  private async getLatestVerificationByProfileIds(profileIds: string[]) {
    const map: Record<string, CreatorVerificationStatus> = {};
    if (profileIds.length === 0) return map;

    // Fetch recent verifications for the set. We'll take the first seen per profile_id (newest).
    const { data, error } = await this.supabase
      .getClient()
      .from('account_verifications')
      .select('profile_id, status, created_at')
      .in('profile_id', profileIds)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return map;

    for (const row of data ?? []) {
      const pid = (row as any).profile_id as string;
      if (!pid || map[pid]) continue;
      map[pid] = ((row as any).status as CreatorVerificationStatus) ?? 'none';
    }
    return map;
  }
}

