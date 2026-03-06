import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AdminAuthGuard } from '../auth/guards';

@ApiTags('audit')
@Controller('audit')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Query audit log with optional filters' })
  findAll(
    @Query('action')     action?: string,
    @Query('entityType') entityType?: string,
    @Query('adminId')    adminId?: string,
    @Query('limit')      limit?: number,
    @Query('offset')     offset?: number,
  ) {
    return this.auditService.findAll({ action, entityType, adminId, limit, offset });
  }
}
