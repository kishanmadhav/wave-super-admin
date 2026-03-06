import { Controller, Get, Patch, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { AdminAuthGuard } from '../auth/guards';

@ApiTags('disputes')
@Controller('disputes')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth('JWT-auth')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  @ApiOperation({ summary: 'List disputes with filters' })
  findAll(
    @Query('status')   status?: string,
    @Query('severity') severity?: string,
    @Query('search')   search?: string,
    @Query('limit')    limit?: number,
    @Query('offset')   offset?: number,
  ) {
    return this.disputesService.findAll({ status, severity, search, limit, offset });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full dispute detail' })
  findById(@Param('id') id: string) {
    return this.disputesService.findById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update dispute status (resolve / escalate / close)' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; adminNotes?: string; resolution?: string },
    @Request() req: any,
  ) {
    return this.disputesService.updateStatus(id, body.status, req.admin.id, {
      adminNotes: body.adminNotes,
      resolution: body.resolution,
    });
  }
}
