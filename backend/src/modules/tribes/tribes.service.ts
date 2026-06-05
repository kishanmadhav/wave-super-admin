import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { randomUUID } from 'crypto';

// Fixed UUID seeded by dj-wave-tribe-bootstrap.sql. The super-admin
// addresses DJ Wave directly via this constant — no name lookup needed.
const DJ_WAVE_ARTIST_ID = '00000000-0000-0000-0000-00000d3aaaaa';
const DJ_WAVE_TRIBE_ID = '00000000-0000-0000-0000-00000d3bbbbb';
const POSTS_BUCKET = 'posts';
// DJ Wave's avatar lives in the public `posts` bucket so every mobile
// user can render it without minting signed URLs. We can't use the
// private mobile-avatars bucket because storage RLS only lets the
// owning auth.uid() sign a URL for it, and there is no owning auth
// account for a system entity like DJ Wave.
const AVATAR_BUCKET = 'posts';
const AVATAR_PATH_PREFIX = 'dj-wave/avatar';

type PostType = 'announcement' | 'update' | 'social' | 'press' | 'track_drop' | 'ownership_drop';

@Injectable()
export class TribesService {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() { return this.supabase.getClient(); }

  // ── DJ Wave snapshot ────────────────────────────────────────────────

  async getDjWave() {
    const { data: artist, error: aErr } = await this.db
      .from('artists')
      .select('id, name, handle, bio, profile_photo_url')
      .eq('id', DJ_WAVE_ARTIST_ID)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!artist) throw new NotFoundException('DJ Wave not seeded yet — run dj-wave-tribe-bootstrap.sql');

    const { data: tribe, error: tErr } = await this.db
      .from('tribes')
      .select('id, name, member_count, visibility')
      .eq('id', DJ_WAVE_TRIBE_ID)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);

    // DJ Wave's avatar is now stored as a plain https URL in the public
    // posts bucket — no signing needed. Older rows that still hold a
    // mobile-avatars:// reference are returned as null so the dashboard
    // prompts the admin to re-upload (which writes a public URL).
    const stored = artist.profile_photo_url ? String(artist.profile_photo_url) : null;
    const avatarUrl =
      stored && !stored.startsWith('mobile-avatars://') ? stored : null;

    return {
      artistId: artist.id,
      tribeId: tribe?.id ?? DJ_WAVE_TRIBE_ID,
      name: artist.name,
      handle: artist.handle,
      bio: artist.bio,
      memberCount: tribe?.member_count ?? 0,
      visibility: tribe?.visibility ?? 'public',
      avatarRef: stored,
      avatarUrl,
    };
  }

  // ── Profile photo ───────────────────────────────────────────────────

  /** Mint a signed upload URL for a new avatar. Frontend PUTs the file
   *  directly to Supabase, then calls setAvatar with the returned path.
   *  Avatar lives in the public `posts` bucket so mobile can render it
   *  without owning the file (the private mobile-avatars bucket gates
   *  signed URLs to the owning auth.uid()). */
  async createAvatarUpload(filename: string) {
    const safe = filename.replace(/[^\w.-]/g, '_').slice(0, 80);
    const path = `${AVATAR_PATH_PREFIX}/${randomUUID()}-${safe}`;
    const { data, error } = await this.db.storage
      .from(AVATAR_BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    const { data: pub } = this.db.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    return { path, signedUrl: data.signedUrl, token: data.token, publicUrl: pub.publicUrl };
  }

  async setAvatar(path: string) {
    if (!path) throw new BadRequestException('path is required');
    // Persist the public URL directly (no `mobile-avatars://` prefix) —
    // every render site in the mobile app accepts a plain https URL,
    // so no client-side resolution is needed for DJ Wave's avatar.
    const { data: pub } = this.db.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const url = pub.publicUrl;
    const { error } = await this.db
      .from('artists')
      .update({ profile_photo_url: url, updated_at: new Date().toISOString() })
      .eq('id', DJ_WAVE_ARTIST_ID);
    if (error) throw new Error(error.message);
    return this.getDjWave();
  }

  // ── Posts ───────────────────────────────────────────────────────────

  async listPosts(limit = 50, offset = 0) {
    const { data, error } = await this.db
      .from('posts')
      .select('*')
      .eq('tribe_id', DJ_WAVE_TRIBE_ID)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);

    // Posts media is stored in the public `posts` bucket — media_urls are
    // already full https URLs. Return as-is.
    return data ?? [];
  }

  /** Signed upload URL for post media (image/video). Path: posts/<tribe>/<uuid>-<filename> */
  async createPostMediaUpload(filename: string) {
    const safe = filename.replace(/[^\w.-]/g, '_').slice(0, 80);
    const path = `${DJ_WAVE_TRIBE_ID}/${randomUUID()}-${safe}`;
    const { data, error } = await this.db.storage
      .from(POSTS_BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    // The posts bucket is public — return the publicly accessible URL so
    // the caller can pass it straight into create() as media_urls[].
    const { data: pub } = this.db.storage.from(POSTS_BUCKET).getPublicUrl(path);
    return { path, signedUrl: data.signedUrl, token: data.token, publicUrl: pub.publicUrl };
  }

  async createPost(input: {
    type?: PostType;
    title?: string | null;
    body?: string | null;
    media_urls?: string[] | null;
    source_url?: string | null;
  }) {
    const ALLOWED_TYPES: PostType[] = [
      'announcement', 'update', 'social', 'press', 'track_drop', 'ownership_drop',
    ];
    const type: PostType = ALLOWED_TYPES.includes(input.type as PostType)
      ? (input.type as PostType)
      : 'announcement';

    const trimmedBody = typeof input.body === 'string' ? input.body.trim() : '';
    const trimmedTitle = typeof input.title === 'string' ? input.title.trim() : '';
    const trimmedSrc = typeof input.source_url === 'string' ? input.source_url.trim() : '';
    const mediaUrls = Array.isArray(input.media_urls)
      ? input.media_urls.filter((u) => typeof u === 'string' && u.length > 0)
      : [];

    if (!trimmedBody && mediaUrls.length === 0) {
      throw new BadRequestException('Post needs a body or at least one media item');
    }

    // Build the row explicitly — only the columns we want, with no
    // empty-string slipping into any enum-typed column.
    const row: Record<string, unknown> = {
      tribe_id: DJ_WAVE_TRIBE_ID,
      author_id: null,
      type,
      status: 'published' as const,
      title: trimmedTitle.length > 0 ? trimmedTitle : null,
      body: trimmedBody.length > 0 ? trimmedBody : null,
      media_urls: mediaUrls.length > 0 ? mediaUrls : null,
      source_url: trimmedSrc.length > 0 ? trimmedSrc : null,
    };

    const { data, error } = await this.db.from('posts').insert(row).select('*').single();
    if (error) {
      // Surface the *actual* Supabase error so the network panel shows it.
      // Bare `throw new Error(error.message)` strips code/details/hint.
      throw new BadRequestException({
        message: `Insert posts failed: ${error.message}`,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
        row,
      });
    }
    return data;
  }

  async deletePost(postId: string) {
    if (!postId) throw new BadRequestException('postId is required');
    // Best-effort: load row first so we can clean up any media files.
    const { data: row } = await this.db
      .from('posts')
      .select('media_urls, tribe_id')
      .eq('id', postId)
      .maybeSingle();
    if (row?.tribe_id && row.tribe_id !== DJ_WAVE_TRIBE_ID) {
      throw new BadRequestException('Post is not in the DJ Wave tribe');
    }
    const { error } = await this.db.from('posts').delete().eq('id', postId);
    if (error) throw new Error(error.message);

    // Remove orphaned media. publicUrl format: .../storage/v1/object/public/posts/<path>
    const urls: string[] = Array.isArray(row?.media_urls) ? row!.media_urls : [];
    const paths = urls
      .map((u) => {
        const m = u.match(/\/posts\/(.+)$/);
        return m ? m[1] : null;
      })
      .filter((p): p is string => !!p);
    if (paths.length > 0) {
      await this.db.storage.from(POSTS_BUCKET).remove(paths).catch(() => {});
    }
    return { ok: true };
  }
}
