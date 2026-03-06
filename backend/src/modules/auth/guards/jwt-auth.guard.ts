import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { JwksClient } from 'jwks-rsa';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jwksRsaLib = require('jwks-rsa');

// Identical to CMS portal guard — validates ES256-signed Supabase JWTs via JWKS.

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly jwksClient: JwksClient;

  constructor(configService: ConfigService) {
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
    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException('No token provided');

    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || !decoded.header.kid) throw new Error('Token missing kid header');

      const key = await this.jwksClient.getSigningKey(decoded.header.kid);
      const publicKey = key.getPublicKey();

      const payload = jwt.verify(token, publicKey, {
        algorithms: ['ES256'],
      }) as { sub: string; email: string; role?: string };

      request.user = { id: payload.sub, email: payload.email, role: payload.role };
      return true;
    } catch (err: unknown) {
      this.logger.warn(`Token verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: any): string | undefined {
    const auth = request.headers?.authorization as string | undefined;
    if (!auth) return undefined;
    const [type, token] = auth.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
