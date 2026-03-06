import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class PipelinesService {
  constructor(private readonly supabase: SupabaseService) {}

  async getAccountVerifications(opts: { status?: string } = {}) {
    let q = this.supabase.getClient()
      .from('account_verifications')
      .select('id,account_name,account_type,email,country,risk_score,status,created_at', { count: 'exact' })
      .order('created_at', { ascending: true })
      .limit(100);
    if (opts.status) {
      q = q.eq('status', opts.status);
    } else {
      q = q.in('status', ['created', 'submitted', 'maker_approved']);
    }
    const { data, count, error } = await q;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async updateAccountVerificationStatus(id: string, status: string, adminId: string, notes?: string) {
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (notes) patch.notes = notes;
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

  async getReleaseVerifications(opts: { status?: string } = {}) {
    let q = this.supabase.getClient()
      .from('release_verifications')
      .select('id,title,artist,type,track_count,status,has_active_dispute,created_at', { count: 'exact' })
      .order('created_at', { ascending: true })
      .limit(100);
    if (opts.status) {
      q = q.eq('status', opts.status);
    } else {
      q = q.in('status', ['submitted', 'maker_approved']);
    }
    const { data, count, error } = await q;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async updateReleaseVerificationStatus(id: string, status: string, adminId: string, notes?: string) {
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (notes) patch.notes = notes;
    const { data, error } = await this.supabase.getClient()
      .from('release_verifications')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await this.supabase.getClient()
      .from('audit_logs')
      .insert({ admin_id: adminId, action: status, entity_type: 'release_verification', entity_id: id });
    return data;
  }
}
