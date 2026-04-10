import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async createUser(
    dto: {
      email: string;
      password: string;
      account_type?: string;
      country?: string;
      timezone?: string;
    },
    adminId: string,
  ) {
    const { data, error } = await this.supabase.getClient().auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
    });

    if (error) {
      const msg = error.message?.toLowerCase?.() ?? '';
      if (msg.includes('already') || msg.includes('registered')) {
        throw new ConflictException('User already exists');
      }
      throw error;
    }

    const userId = data.user.id;

    // Ensure application profile row exists with optional fields
    const profilePatch: Record<string, unknown> = {
      id: userId,
      email: dto.email,
    };
    if (dto.account_type) profilePatch.account_type = dto.account_type;
    if (dto.country) profilePatch.country = dto.country;
    if (dto.timezone) profilePatch.timezone = dto.timezone;

    await this.supabase
      .getClient()
      .from('profiles')
      .upsert(profilePatch, { onConflict: 'id' });

    await this.supabase
      .getClient()
      .from('audit_logs')
      .insert({
        admin_id: adminId,
        action: 'create',
        entity_type: 'profile',
        entity_id: userId,
        changes: { email: dto.email, account_type: dto.account_type ?? null },
      });

    return { id: userId, email: dto.email };
  }

  async findAll(opts: { search?: string; type?: string; status?: string; limit?: number; offset?: number }) {
    const { search, type, status, limit = 50, offset = 0 } = opts;
    let q = this.supabase.getClient()
      .from('profiles')
      .select(
        'id,email,username,org_name,account_type,country,created_at,deletion_pending,fraud_flagged,suspended_at,banned_at,' +
        'artist_profiles(stage_name),label_profiles(label_name),artists(name)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      q = q.or(`email.ilike.%${search}%,username.ilike.%${search}%,org_name.ilike.%${search}%`);
    }
    if (type) q = q.eq('account_type', type);
    if (status === 'suspended') q = q.not('suspended_at', 'is', null);
    if (status === 'banned') q = q.not('banned_at', 'is', null);
    if (status === 'flagged') q = q.eq('fraud_flagged', true);

    const { data: rows, count, error } = await q;
    if (error) throw error;

    const data = (rows ?? []).map((row: any) => {
      const ap = Array.isArray(row.artist_profiles) ? row.artist_profiles[0] : row.artist_profiles;
      const lp = Array.isArray(row.label_profiles) ? row.label_profiles[0] : row.label_profiles;
      const art = Array.isArray(row.artists) ? row.artists[0] : row.artists;
      const display_name =
        art?.name ?? ap?.stage_name ?? lp?.label_name ?? row.username ?? row.org_name ?? row.email ?? row.email;
      return {
        id: row.id,
        email: row.email,
        username: row.username,
        org_name: row.org_name,
        account_type: row.account_type,
        country: row.country,
        created_at: row.created_at,
        deletion_pending: row.deletion_pending,
        fraud_flagged: row.fraud_flagged,
        suspended_at: row.suspended_at,
        banned_at: row.banned_at,
        display_name,
      };
    });

    return { data, total: count ?? 0 };
  }

  async findById(id: string) {
    const { data: row, error } = await this.supabase.getClient()
      .from('profiles')
      .select('*, artist_profiles(*), label_profiles(*), artists(name)')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    if (!row) throw new NotFoundException(`User ${id} not found`);
    const ap = Array.isArray(row.artist_profiles) ? row.artist_profiles[0] : row.artist_profiles;
    const lp = Array.isArray(row.label_profiles) ? row.label_profiles[0] : row.label_profiles;
    const art = Array.isArray(row.artists) ? row.artists[0] : row.artists;
    const display_name =
      art?.name ?? ap?.stage_name ?? lp?.label_name ?? row.username ?? row.org_name ?? row.email ?? row.email;
    return { ...row, display_name };
  }

  async suspend(id: string, reason: string, adminId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('profiles')
      .update({
        suspended_at: new Date().toISOString(),
        suspended_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await this.logAction(adminId, 'suspend', 'profile', id);
    return data;
  }

  async unsuspend(id: string, adminId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('profiles')
      .update({ suspended_at: null, suspended_reason: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await this.logAction(adminId, 'unsuspend', 'profile', id);
    return data;
  }

  async ban(id: string, reason: string, adminId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('profiles')
      .update({
        banned_at: new Date().toISOString(),
        banned_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await this.logAction(adminId, 'ban', 'profile', id);
    return data;
  }

  async flagFraud(id: string, adminId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('profiles')
      .update({ fraud_flagged: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await this.logAction(adminId, 'flag_fraud', 'profile', id);
    return data;
  }

  async getUserReleases(profileId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('releases')
      .select('id,title,status,type,release_date,created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  }

  async getUserLedger(profileId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('ledger_entries')
      .select('id,source,type,nano_delta,mini_delta,status,created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  }

  async getUserDisputes(profileId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('disputes')
      .select('id,type,status,severity,created_at')
      .eq('submitted_by', profileId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  }

  // ─── Mobile users ──────────────────────────────────────────────────────────

  async findAllMobileUsers(opts: { search?: string; limit?: number; offset?: number }) {
    const { search, limit = 50, offset = 0 } = opts;
    let q = this.supabase.getClient()
      .from('mobile_users')
      .select(
        'id,email,phone,username,profile_photo_url,taste_genres,taste_languages,onboarding_completed,onboarding_step,created_at,updated_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      q = q.or(`email.ilike.%${search}%,username.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, count, error } = await q;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async findMobileUserById(id: string) {
    const { data, error } = await this.supabase.getClient()
      .from('mobile_users')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) throw new NotFoundException(`Mobile user ${id} not found`);
    return data;
  }

  async suspendMobileUser(id: string, reason: string, adminId: string) {
    // Disable the user in Supabase Auth (prevents login)
    const { error: authErr } = await this.supabase.getClient().auth.admin.updateUserById(id, {
      ban_duration: '876000h', // ~100 years
      user_metadata: { suspended: true, suspended_reason: reason, suspended_at: new Date().toISOString() },
    });
    if (authErr) throw authErr;
    await this.logAction(adminId, 'suspend_mobile_user', 'mobile_user', id);
    return { success: true, action: 'suspended' };
  }

  async unsuspendMobileUser(id: string, adminId: string) {
    const { error: authErr } = await this.supabase.getClient().auth.admin.updateUserById(id, {
      ban_duration: 'none',
      user_metadata: { suspended: false, suspended_reason: null, suspended_at: null },
    });
    if (authErr) throw authErr;
    await this.logAction(adminId, 'unsuspend_mobile_user', 'mobile_user', id);
    return { success: true, action: 'unsuspended' };
  }

  async deleteMobileUser(id: string, adminId: string) {
    // Delete from Supabase Auth — cascades to mobile_users via FK
    const { error: authErr } = await this.supabase.getClient().auth.admin.deleteUser(id);
    if (authErr) throw authErr;
    await this.logAction(adminId, 'delete_mobile_user', 'mobile_user', id);
    return { success: true, action: 'deleted' };
  }

  private async logAction(adminId: string, action: string, entityType: string, entityId: string) {
    await this.supabase.getClient()
      .from('audit_logs')
      .insert({ admin_id: adminId, action, entity_type: entityType, entity_id: entityId })
      .then(() => {});
  }
}
