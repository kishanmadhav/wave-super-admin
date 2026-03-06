import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class AuditService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(opts: { action?: string; entityType?: string; adminId?: string; limit?: number; offset?: number }) {
    const { action, entityType, adminId, limit = 100, offset = 0 } = opts;
    let q = this.supabase.getClient()
      .from('audit_logs')
      .select(
        'id,admin_id,action,entity_type,entity_id,impersonated_as,origin_screen,ip_address,device_info,changes,created_at,admin_users(profiles(email))',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (action)     q = q.eq('action', action);
    if (entityType) q = q.eq('entity_type', entityType);
    if (adminId)    q = q.eq('admin_id', adminId);
    const { data, count, error } = await q;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }
}
