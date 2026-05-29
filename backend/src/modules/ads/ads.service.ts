import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { randomUUID } from 'crypto';

export type Placement = 'banner' | 'interstitial';

export interface AdRow {
  id: string;
  placement: Placement;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_path: string;
  audio_path: string | null;
  nano_reward: number;
  duration_sec: number;
  display_order: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

const BUCKET = 'ads';
// Signed URL TTL for the admin list view. Used only inside the dashboard
// preview — mobile clients get their own shorter URLs via list_active_ads.
const PREVIEW_URL_TTL = 60 * 60; // 1h

@Injectable()
export class AdsService {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.getClient();
  }

  /**
   * Mobile-facing: list ACTIVE ads for a placement with short-lived signed
   * URLs. Filtered by schedule window. No admin check — any caller can read.
   * (Mobile gates this behind its own auth at the HTTP layer.)
   */
  async listActive(placement: Placement) {
    if (placement !== 'banner' && placement !== 'interstitial') return [];
    const nowIso = new Date().toISOString();
    const { data, error } = await this.db
      .from('ads')
      .select('*')
      .eq('placement', placement)
      .eq('active', true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as AdRow[];
    // Mint shorter URLs (10 min) for the mobile client — they only need to
    // render and play within the next few minutes.
    const SHORT_TTL = 600;
    return Promise.all(rows.map(async (ad) => {
      const image = ad.image_path
        ? (await this.db.storage.from(BUCKET).createSignedUrl(ad.image_path, SHORT_TTL)).data?.signedUrl ?? ''
        : '';
      const audio = ad.audio_path
        ? (await this.db.storage.from(BUCKET).createSignedUrl(ad.audio_path, SHORT_TTL)).data?.signedUrl ?? null
        : null;
      return {
        id: ad.id,
        placement: ad.placement,
        title: ad.title,
        subtitle: ad.subtitle,
        cta_label: ad.cta_label,
        cta_url: ad.cta_url,
        image_url: image,
        audio_url: audio,
        nano_reward: ad.nano_reward,
        duration_sec: ad.duration_sec,
        display_order: ad.display_order,
      };
    }));
  }

  /** List all ads, optionally filtered by placement. Includes signed preview URLs. */
  async list(placement?: Placement) {
    let query = this.db
      .from('ads')
      .select('*')
      .order('placement', { ascending: true })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (placement) query = query.eq('placement', placement);
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Mint preview URLs in parallel.
    const rows = (data ?? []) as AdRow[];
    const withUrls = await Promise.all(rows.map(async (ad) => {
      const imageUrl = ad.image_path
        ? (await this.db.storage.from(BUCKET).createSignedUrl(ad.image_path, PREVIEW_URL_TTL)).data?.signedUrl ?? null
        : null;
      const audioUrl = ad.audio_path
        ? (await this.db.storage.from(BUCKET).createSignedUrl(ad.audio_path, PREVIEW_URL_TTL)).data?.signedUrl ?? null
        : null;
      return { ...ad, image_url: imageUrl, audio_url: audioUrl };
    }));
    return withUrls;
  }

  /**
   * Generate a signed upload URL the frontend uses to PUT the file directly
   * to Supabase Storage. Path layout: `<placement>/<uuid>-<filename>`.
   */
  async createSignedUpload(placement: Placement, kind: 'image' | 'audio', filename: string) {
    const safeName = filename.replace(/[^\w.-]/g, '_').slice(0, 80);
    const path = `${placement}/${randomUUID()}-${kind}-${safeName}`;
    const { data, error } = await this.db.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, signedUrl: data.signedUrl, token: data.token };
  }

  async create(body: {
    placement: Placement;
    title: string;
    subtitle?: string | null;
    cta_label?: string | null;
    cta_url?: string | null;
    image_path: string;
    audio_path?: string | null;
    nano_reward?: number;
    duration_sec?: number;
    display_order?: number;
    active?: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
  }, createdBy: string) {
    const { data, error } = await this.db
      .from('ads')
      .insert({
        placement: body.placement,
        title: body.title,
        subtitle: body.subtitle ?? null,
        cta_label: body.cta_label ?? null,
        cta_url: body.cta_url ?? null,
        image_path: body.image_path,
        audio_path: body.audio_path ?? null,
        nano_reward: body.nano_reward ?? 1,
        duration_sec: body.duration_sec ?? 10,
        display_order: body.display_order ?? 0,
        active: body.active ?? true,
        starts_at: body.starts_at ?? null,
        ends_at: body.ends_at ?? null,
        created_by: createdBy,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: string, body: Partial<{
    title: string;
    subtitle: string | null;
    cta_label: string | null;
    cta_url: string | null;
    nano_reward: number;
    duration_sec: number;
    display_order: number;
    active: boolean;
    starts_at: string | null;
    ends_at: string | null;
  }>) {
    const { data, error } = await this.db
      .from('ads')
      .update(body)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Ad not found');
    return data;
  }

  async remove(id: string) {
    // Fetch paths first so we can delete the blobs after the row goes.
    const { data: ad } = await this.db
      .from('ads')
      .select('image_path, audio_path')
      .eq('id', id)
      .maybeSingle();

    const { error } = await this.db.from('ads').delete().eq('id', id);
    if (error) throw new Error(error.message);

    if (ad) {
      const paths = [ad.image_path, ad.audio_path].filter(Boolean) as string[];
      if (paths.length > 0) {
        // Best-effort cleanup. Orphans are harmless if this fails.
        await this.db.storage.from(BUCKET).remove(paths).catch(() => {});
      }
    }
    return { ok: true };
  }
}
