import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../database/supabase.service';
import * as jwt from 'jsonwebtoken';
import type { JwksClient } from 'jwks-rsa';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jwksRsaLib = require('jwks-rsa');

export const REQUIRE_SUPER_ADMIN = 'require_super_admin';

/**
 * AdminAuthGuard — two-layer check:
 *  1. Validates the Supabase JWT (same as JwtAuthGuard).
 *  2. Queries admin_users to confirm the caller is an active admin,
 *     and optionally that they hold the super_admin role.
 *
 * Attaches req.admin = { id, email, role } for downstream use.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly logger = new Logger(AdminAuthGuard.name);
  private readonly jwksClient: JwksClient;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly reflector: Reflector,
    configService: ConfigService,
  ) {
    const supabaseUrl = configService.getOrThrow<string>('SUPABASE_URL');
    this.jwksClient = jwksRsaLib({
      jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 600_000,
      rateLimit: true,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // ── Step 1: JWT verification ──────────────────────────────────────────────
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('No token provided');

    let userId: string;
    let email: string;

    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || !decoded.header.kid) throw new Error('Token missing kid header');

      const key = await this.jwksClient.getSigningKey(decoded.header.kid);
      const publicKey = key.getPublicKey();

      const payload = jwt.verify(token, publicKey, {
        algorithms: ['ES256'],
      }) as { sub: string; email: string };

      userId = payload.sub;
      email  = payload.email;
    } catch (err: unknown) {
      this.logger.warn(`JWT verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    // ── Step 2: admin_users lookup ────────────────────────────────────────────
    const { data: adminRow, error } = await this.supabase
      .getClient()
      .from('admin_users')
      .select('id, role, status')
      .eq('id', userId)
      .single();

    if (error || !adminRow) {
      this.logger.warn(`Admin lookup failed for user ${userId}: ${error?.message ?? 'not found'}`);
      throw new ForbiddenException('Access denied — not a Wave admin');
    }

    if (adminRow.status !== 'active') {
      throw new ForbiddenException(`Admin account is ${adminRow.status}`);
    }

    // ── Step 3: (optional) super_admin role requirement ───────────────────────
    const requireSuperAdmin = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_SUPER_ADMIN,
      [context.getHandler(), context.getClass()],
    );

    if (requireSuperAdmin && adminRow.role !== 'super_admin') {
      throw new ForbiddenException('This action requires the super_admin role');
    }

    // Attach to request for downstream use
    request.user  = { id: userId, email };
    request.admin = { id: userId, email, role: adminRow.role };

    return true;
  }

  private extractToken(request: any): string | undefined {
    const auth = request.headers?.authorization as string | undefined;
    if (!auth) return undefined;
    const [type, token] = auth.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
