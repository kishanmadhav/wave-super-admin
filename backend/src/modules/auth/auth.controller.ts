import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AdminAuthGuard } from './guards';

@ApiTags('auth')
@Controller('auth')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * GET /auth/me
   * Returns the authenticated admin's identity: id, email, role, permissions.
   * AdminAuthGuard already verified the JWT and the admin_users row — this
   * just enriches and returns the data.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get identity of the authenticated admin' })
  @ApiResponse({ status: 200, description: 'Returns admin identity' })
  @ApiResponse({ status: 401, description: 'No / invalid token' })
  @ApiResponse({ status: 403, description: 'Not a Wave admin' })
  async getMe(@Request() req: any) {
    return this.authService.getAdminIdentity(req.admin.id);
  }
}
