import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(opts: { search?: string; type?: string; status?: string; limit?: number; offset?: number }) {
    const { search, type, status, limit = 50, offset = 0 } = opts;
    let q = this.supabase.getClient()
      .from('profiles')
      .select('id,email,username,account_type,country,created_at,deletion_pending,fraud_flagged,suspended_at,banned_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) q = q.or(`email.ilike.%${search}%,username.ilike.%${search}%`);
    if (type) q = q.eq('account_type', type);
    if (status === 'suspended') q = q.not('suspended_at', 'is', null);
    if (status === 'banned') q = q.not('banned_at', 'is', null);
    if (status === 'flagged') q = q.eq('fraud_flagged', true);

    const { data, count, error } = await q;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase.getClient()
      .from('profiles')
      .select('*, artist_profiles(*), label_profiles(*)')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) throw new NotFoundException(`User ${id} not found`);
    return data;
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

  private async logAction(adminId: string, action: string, entityType: string, entityId: string) {
    await this.supabase.getClient()
      .from('audit_logs')
      .insert({ admin_id: adminId, action, entity_type: entityType, entity_id: entityId })
      .then(() => {});
  }
}
