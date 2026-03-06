import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class WalletsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getLedger(opts: { search?: string; source?: string; limit?: number; offset?: number }) {
    const { search, source, limit = 100, offset = 0 } = opts;
    let q = this.supabase.getClient()
      .from('ledger_entries')
      .select('id,profile_id,type,source,context,nano_delta,mini_delta,status,created_at,profiles(email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (source) q = q.eq('source', source);
    const { data, count, error } = await q;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async getFanWallets(opts: { limit?: number; offset?: number }) {
    const { limit = 50, offset = 0 } = opts;
    const { data, count, error } = await this.supabase.getClient()
      .from('fan_wallets')
      .select('id,profile_id,nano_balance,mini_balance,wave_coin_balance,updated_at,profiles(email)', { count: 'exact' })
      .order('nano_balance', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async getEarningsWallets(opts: { limit?: number; offset?: number }) {
    const { limit = 50, offset = 0 } = opts;
    const { data, count, error } = await this.supabase.getClient()
      .from('earnings_wallets')
      .select('id,profile_id,pending_nano,withdrawable_nano,total_earned_nano,updated_at,profiles(email)', { count: 'exact' })
      .order('total_earned_nano', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async createManualAdjustment(
    profileId: string,
    opts: {
      type: string;
      source: string;
      context: string;
      nanoDelta: number;
      miniDelta: number;
      reason: string;
    },
    adminId: string,
  ) {
    const { data, error } = await this.supabase.getClient()
      .from('ledger_entries')
      .insert({
        profile_id: profileId,
        type: opts.type,
        source: opts.source,
        context: `[Manual adjustment] ${opts.context}`,
        nano_delta: opts.nanoDelta,
        mini_delta: opts.miniDelta,
        status: 'settled',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    await this.supabase.getClient()
      .from('audit_logs')
      .insert({
        admin_id: adminId,
        action: 'manual_ledger_adjustment',
        entity_type: 'ledger',
        entity_id: (data as any).id,
        changes: { reason: opts.reason, nanoDelta: opts.nanoDelta, miniDelta: opts.miniDelta },
      });
    return data;
  }
}
