import { Controller, Get, Patch, Post, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Get full dispute detail (evidence, timeline, messages, notes, parties)' })
  findById(@Param('id') id: string) {
    return this.disputesService.findById(id);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add internal admin note' })
  addNote(
    @Param('id') id: string,
    @Body() body: { note: string },
    @Request() req: any,
  ) {
    return this.disputesService.addInternalNote(id, req.admin.id, body.note ?? '');
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update dispute status and optionally record ruling (in_favor_claimant, in_favor_content_owner, take_down, close)' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; resolution?: string; internalNote?: string; ruling?: string },
    @Request() req: any,
  ) {
    return this.disputesService.updateStatus(id, body.status, req.admin.id, {
      resolution: body.resolution,
      internalNote: body.internalNote,
      ruling: body.ruling,
    });
  }
}
