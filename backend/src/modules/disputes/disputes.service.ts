import { Injectable } from '@nestjs/common';
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
    if (search) q = q.or(`target_name.ilike.%${search}%,claimant_name.ilike.%${search}%`);
    if (status === 'active') {
      q = q.in('status', ['open', 'under_review', 'escalated', 'awaiting_uploader_response', 'awaiting_claimant_response']);
    } else if (status) {
      q = q.eq('status', status);
    }
    if (severity) q = q.eq('severity', severity);
    const { data, count, error } = await q;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase.getClient()
      .from('disputes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async updateStatus(id: string, status: string, adminId: string, opts: { adminNotes?: string; resolution?: string } = {}) {
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      ...(opts.adminNotes ? { admin_notes: opts.adminNotes } : {}),
      ...(opts.resolution ? { resolution: opts.resolution } : {}),
    };
    const { data, error } = await this.supabase.getClient()
      .from('disputes')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await this.supabase.getClient()
      .from('audit_logs')
      .insert({ admin_id: adminId, action: status, entity_type: 'dispute', entity_id: id });
    return data;
  }
}
