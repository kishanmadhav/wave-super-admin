import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class SystemService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Platform Parameters ───────────────────────────────────────────────────

  async getParameters() {
    const { data, error } = await this.supabase.getClient()
      .from('sa_platform_parameters')
      .select('*')
      .order('category').order('key');
    if (error) throw error;
    return data ?? [];
  }

  async updateParameter(id: string, value: string, reason: string, adminId: string) {
    const current = await this.supabase.getClient()
      .from('sa_platform_parameters').select('value').eq('id', id).single();
    const { data, error } = await this.supabase.getClient()
      .from('sa_platform_parameters')
      .update({
        value,
        previous_value: current.data?.value,
        reason,
        changed_by: adminId,
        effective_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await this.supabase.getClient()
      .from('audit_logs')
      .insert({ admin_id: adminId, action: 'update', entity_type: 'platform_param', entity_id: id, changes: { value, reason } });
    return data;
  }

  // ── Feature Flags ─────────────────────────────────────────────────────────

  async getFeatureFlags() {
    const { data, error } = await this.supabase.getClient()
      .from('sa_feature_flags')
      .select('*')
      .order('category').order('key');
    if (error) throw error;
    return data ?? [];
  }

  async toggleFeatureFlag(id: string, enabled: boolean, adminId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('sa_feature_flags')
      .update({ enabled, updated_by: adminId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await this.supabase.getClient()
      .from('audit_logs')
      .insert({ admin_id: adminId, action: enabled ? 'enable_flag' : 'disable_flag', entity_type: 'feature_flag', entity_id: id });
    return data;
  }

  // ── Taxonomies ────────────────────────────────────────────────────────────

  async getTaxonomies(type?: string) {
    let q = this.supabase.getClient()
      .from('sa_taxonomies')
      .select('*')
      .order('type').order('sort_order');
    if (type) q = q.eq('type', type);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async upsertTaxonomy(entry: {
    type: string; value: string; label: string; active: boolean; sort_order?: number;
  }) {
    const { data, error } = await this.supabase.getClient()
      .from('sa_taxonomies')
      .upsert(entry, { onConflict: 'type,value' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
