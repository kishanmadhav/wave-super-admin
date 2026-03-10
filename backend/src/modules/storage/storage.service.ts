import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

// Key convention: "{bucket}/{path}"
// "audio/tracks/releaseId/song.wav" → bucket "audio", path "tracks/releaseId/song.wav"
// "images/covers/releaseId/art.jpg" → bucket "images", path "covers/releaseId/art.jpg"

@Injectable()
export class StorageService {
  constructor(private readonly supabase: SupabaseService) {}

  private resolve(key: string): { bucket: string; path: string } {
    const slash = key.indexOf('/');
    if (slash === -1) throw new Error(`Invalid storage key "${key}" — expected "{bucket}/{path}"`);
    return { bucket: key.slice(0, slash), path: key.slice(slash + 1) };
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const { bucket, path } = this.resolve(key);
    const { data, error } = await this.supabase.getClient().storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  }

  async getSignedUploadUrl(key: string): Promise<{ signedUrl: string; token: string; path: string }> {
    const { bucket, path } = this.resolve(key);
    const { data, error } = await this.supabase.getClient().storage.from(bucket).createSignedUploadUrl(path);
    if (error) throw error;
    return { signedUrl: data.signedUrl, token: data.token, path: data.path };
  }
}

