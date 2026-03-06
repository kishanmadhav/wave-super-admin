import {
  Injectable,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

export interface AdminIdentity {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  last_active_at: string | null;
  permissions: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Returns the full admin identity for the authenticated user.
   * Called by GET /auth/me — req.admin is already validated by AdminAuthGuard.
   */
  async getAdminIdentity(userId: string): Promise<AdminIdentity> {
    const { data, error } = await this.supabase
      .getClient()
      .from('admin_users')
      .select('id, role, status, created_at, last_active_at, permissions')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new ForbiddenException('Admin record not found');
    }

    // Fetch email from profiles table (admin_users shares the same UUID)
    const { data: profile } = await this.supabase
      .getClient()
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    // Bump last_active_at in the background (fire-and-forget)
    this.supabase
      .getClient()
      .from('admin_users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId)
      .then(() => {});

    return {
      id: data.id,
      email: profile?.email ?? '',
      role: data.role,
      status: data.status,
      created_at: data.created_at,
      last_active_at: data.last_active_at,
      permissions: data.permissions ?? [],
    };
  }
}
