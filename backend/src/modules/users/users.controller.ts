import {
  Controller, Get, Patch, Post, Delete, Param, Query, Body, Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AdminAuthGuard } from '../auth/guards';

@ApiTags('users')
@Controller('users')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new platform user (auth + profile)' })
  @ApiResponse({ status: 201, description: 'User created' })
  createUser(
    @Body()
    body: {
      email: string;
      password: string;
      account_type?: string;
      country?: string;
      timezone?: string;
    },
    @Request() req: any,
  ) {
    return this.usersService.createUser(body, req.admin.id);
  }

  // ─── Mobile users (must come before :id routes) ────────────────────────────

  @Get('mobile')
  @ApiOperation({ summary: 'List all mobile app users' })
  findAllMobileUsers(
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.usersService.findAllMobileUsers({ search, limit, offset });
  }

  @Get('mobile/:id')
  @ApiOperation({ summary: 'Get a mobile user by ID' })
  findMobileUserById(@Param('id') id: string) {
    return this.usersService.findMobileUserById(id);
  }

  @Post('mobile/:id/suspend')
  @ApiOperation({ summary: 'Suspend a mobile user (disables login)' })
  suspendMobileUser(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req: any,
  ) {
    return this.usersService.suspendMobileUser(id, body.reason ?? 'Suspended by admin', req.admin.id);
  }

  @Post('mobile/:id/unsuspend')
  @ApiOperation({ summary: 'Unsuspend a mobile user' })
  unsuspendMobileUser(@Param('id') id: string, @Request() req: any) {
    return this.usersService.unsuspendMobileUser(id, req.admin.id);
  }

  @Delete('mobile/:id')
  @ApiOperation({ summary: 'Permanently delete a mobile user' })
  deleteMobileUser(@Param('id') id: string, @Request() req: any) {
    return this.usersService.deleteMobileUser(id, req.admin.id);
  }

  // ─── Creator / profile users ──────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all platform users with optional filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'type',   required: false, enum: ['artist','band','label'] })
  @ApiQuery({ name: 'status', required: false, enum: ['active','suspended','banned','flagged'] })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('type')   type?: string,
    @Query('status') status?: string,
    @Query('limit')  limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.usersService.findAll({ search, type, status, limit, offset });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full profile for a user' })
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Get(':id/releases')
  @ApiOperation({ summary: 'Get releases for a user' })
  getUserReleases(@Param('id') id: string) {
    return this.usersService.getUserReleases(id);
  }

  @Get(':id/ledger')
  @ApiOperation({ summary: 'Get ledger entries for a user' })
  getUserLedger(@Param('id') id: string) {
    return this.usersService.getUserLedger(id);
  }

  @Get(':id/disputes')
  @ApiOperation({ summary: 'Get disputes submitted by a user' })
  getUserDisputes(@Param('id') id: string) {
    return this.usersService.getUserDisputes(id);
  }

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend a user account' })
  @ApiResponse({ status: 200, description: 'User suspended' })
  suspend(@Param('id') id: string, @Body() body: { reason: string }, @Request() req: any) {
    return this.usersService.suspend(id, body.reason ?? 'Suspended by admin', req.admin.id);
  }

  @Post(':id/unsuspend')
  @ApiOperation({ summary: 'Remove suspension from a user account' })
  unsuspend(@Param('id') id: string, @Request() req: any) {
    return this.usersService.unsuspend(id, req.admin.id);
  }

  @Post(':id/ban')
  @ApiOperation({ summary: 'Permanently ban a user account' })
  ban(@Param('id') id: string, @Body() body: { reason: string }, @Request() req: any) {
    return this.usersService.ban(id, body.reason ?? 'Banned by admin', req.admin.id);
  }

  @Post(':id/flag-fraud')
  @ApiOperation({ summary: 'Flag a user account for fraud' })
  flagFraud(@Param('id') id: string, @Request() req: any) {
    return this.usersService.flagFraud(id, req.admin.id);
  }
}
