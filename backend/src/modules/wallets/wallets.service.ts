import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

@Injectable()
export class WalletsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getSummary() {
    const client = this.supabase.getClient();

    // Aggregate stats from mobile_wallets
    const { data: mobileAgg } = await client
      .from('mobile_wallets')
      .select('nano_earned_total,mini_balance');

    let totalNanoIssued = 0;
    let totalMiniBalance = 0;
    let usersWithBalances = 0;
    for (const row of mobileAgg ?? []) {
      const nano = Number(row.nano_earned_total ?? 0);
      const mini = Number(row.mini_balance ?? 0);
      totalNanoIssued += nano;
      totalMiniBalance += mini;
      if (nano > 0 || mini > 0) usersWithBalances++;
    }

    // Aggregate stats from artist_wallets
    const { data: artistAgg } = await client
      .from('artist_wallets')
      .select('nano_earned');

    let totalArtistNano = 0;
    for (const row of artistAgg ?? []) {
      totalArtistNano += Number(row.nano_earned ?? 0);
    }

    // Count honor-related ledger entries
    const { count: honorsCount } = await client
      .from('mobile_wallet_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('entry_type', 'honor_sent');

    return {
      totalNanoWaveIssued: totalNanoIssued,
      totalMiniWaveSpendable: totalMiniBalance,
      totalArtistNanoEarned: totalArtistNano,
      totalHonorsVolume: honorsCount ?? 0,
      totalUsersWithBalances: usersWithBalances,
    };
  }

  async getMobileWallets(opts: { search?: string; limit?: number; offset?: number }) {
    const { search, limit = 50, offset = 0 } = opts;
    const client = this.supabase.getClient();

    let q = client
      .from('mobile_wallets')
      .select(
        'mobile_user_id,nano_earned_total,mini_balance,updated_at,mobile_users(username,email)',
        { count: 'exact' },
      )
      .order('nano_earned_total', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await q;
    if (error) throw error;

    let rows = (data ?? []).map((r: any) => ({
      userId: r.mobile_user_id,
      userName: r.mobile_users?.username || r.mobile_users?.email || r.mobile_user_id,
      email: r.mobile_users?.email || null,
      nanoEarnedTotal: Number(r.nano_earned_total ?? 0),
      miniBalance: Number(r.mini_balance ?? 0),
      updatedAt: r.updated_at,
    }));

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.userName.toLowerCase().includes(q) ||
          r.userId.toLowerCase().includes(q) ||
          (r.email && r.email.toLowerCase().includes(q)),
      );
    }

    return { data: rows, total: count ?? 0 };
  }

  async getArtistWallets(opts: { search?: string; limit?: number; offset?: number }) {
    const { search, limit = 50, offset = 0 } = opts;
    const client = this.supabase.getClient();

    let q = client
      .from('artist_wallets')
      .select(
        'artist_id,nano_earned,updated_at,artists(name,handle)',
        { count: 'exact' },
      )
      .order('nano_earned', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await q;
    if (error) throw error;

    let rows = (data ?? []).map((r: any) => ({
      artistId: r.artist_id,
      artistName: r.artists?.name || r.artists?.handle || r.artist_id,
      handle: r.artists?.handle || null,
      nanoEarned: Number(r.nano_earned ?? 0),
      updatedAt: r.updated_at,
    }));

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.artistName.toLowerCase().includes(q) ||
          r.artistId.toLowerCase().includes(q) ||
          (r.handle && r.handle.toLowerCase().includes(q)),
      );
    }

    return { data: rows, total: count ?? 0 };
  }

  async getMobileWalletLedger(userId: string, opts: { limit?: number; offset?: number }) {
    const { limit = 50, offset = 0 } = opts;
    const { data, count, error } = await this.supabase.getClient()
      .from('mobile_wallet_ledger')
      .select('id,mobile_user_id,entry_type,source_type,source_reference_id,description,nano_delta,mini_delta,created_at', { count: 'exact' })
      .eq('mobile_user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async getArtistWalletLedger(artistId: string, opts: { limit?: number; offset?: number }) {
    const { limit = 50, offset = 0 } = opts;
    const { data, count, error } = await this.supabase.getClient()
      .from('artist_wallet_ledger')
      .select('id,artist_id,entry_type,source_type,source_reference_id,listener_user_id,description,nano_delta,created_at', { count: 'exact' })
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false })
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
      .from('mobile_wallet_ledger')
      .insert({
        mobile_user_id: profileId,
        entry_type: opts.type,
        source_type: opts.source,
        description: `[Manual adjustment] ${opts.context}`,
        nano_delta: opts.nanoDelta,
        mini_delta: opts.miniDelta,
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
