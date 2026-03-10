import { Controller, Get, Patch, Post, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Get all creators (verification queue) with verification status' })
  getAccountVerifications(@Query('status') status?: string) {
    return this.pipelinesService.getAccountVerifications({ status });
  }

  @Get('creators/:profileId')
  @ApiOperation({ summary: 'Get full creator detail for review' })
  getCreatorDetailForReview(@Param('profileId') profileId: string) {
    return this.pipelinesService.getCreatorDetailForReview(profileId);
  }

  @Patch('account-verifications/:id')
  @ApiOperation({ summary: 'Update verification status by account_verification id' })
  updateAccountVerif(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
    @Request() req: any,
  ) {
    return this.pipelinesService.updateAccountVerificationStatus(id, body.status, req.admin.id, body.notes);
  }

  @Post('creators/:profileId/reject')
  @ApiOperation({ summary: 'Reject creator verification' })
  rejectCreator(@Param('profileId') profileId: string, @Request() req: any) {
    return this.pipelinesService.rejectCreator(profileId, req.admin.id);
  }
}
