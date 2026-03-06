import { Controller, Get, Patch, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PipelinesService } from './pipelines.service';
import { AdminAuthGuard } from '../auth/guards';

@ApiTags('pipelines')
@Controller('pipelines')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Get('account-verifications')
  @ApiOperation({ summary: 'Get creator verification queue' })
  getAccountVerifications(@Query('status') status?: string) {
    return this.pipelinesService.getAccountVerifications({ status });
  }

  @Patch('account-verifications/:id')
  @ApiOperation({ summary: 'Update creator verification status (approve/reject/request-info)' })
  updateAccountVerif(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
    @Request() req: any,
  ) {
    return this.pipelinesService.updateAccountVerificationStatus(id, body.status, req.admin.id, body.notes);
  }

  @Get('release-verifications')
  @ApiOperation({ summary: 'Get release review queue' })
  getReleaseVerifications(@Query('status') status?: string) {
    return this.pipelinesService.getReleaseVerifications({ status });
  }

  @Patch('release-verifications/:id')
  @ApiOperation({ summary: 'Update release verification status' })
  updateReleaseVerif(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
    @Request() req: any,
  ) {
    return this.pipelinesService.updateReleaseVerificationStatus(id, body.status, req.admin.id, body.notes);
  }
}
