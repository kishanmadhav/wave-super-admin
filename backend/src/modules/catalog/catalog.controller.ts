import { Controller, Get, Patch, Post, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { AdminAuthGuard } from '../auth/guards';

@ApiTags('catalog')
@Controller('catalog')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('releases')
  @ApiOperation({ summary: 'List all releases' })
  findReleases(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('limit')  limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.catalogService.findReleases({ search, status, limit, offset });
  }

  @Get('releases/:id')
  @ApiOperation({ summary: 'Get release detail with tracks' })
  findRelease(@Param('id') id: string) {
    return this.catalogService.findRelease(id);
  }

  @Patch('releases/:id')
  @ApiOperation({ summary: 'Update release fields (admin edit)' })
  updateRelease(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Request() req: any,
  ) {
    return this.catalogService.updateRelease(id, body, req.admin.id);
  }

  @Patch('releases/:releaseId/tracks/:trackId')
  @ApiOperation({ summary: 'Update track fields (admin edit)' })
  updateTrack(
    @Param('releaseId') _releaseId: string,
    @Param('trackId') trackId: string,
    @Body() body: Record<string, unknown>,
    @Request() req: any,
  ) {
    return this.catalogService.updateTrack(trackId, body, req.admin.id);
  }

  @Patch('releases/:id/status')
  @ApiOperation({ summary: 'Update release status' })
  updateReleaseStatus(
    @Param('id') id: string,
    @Body() body: { status: string; comment?: string },
    @Request() req: any,
  ) {
    return this.catalogService.updateReleaseStatus(id, body.status, req.admin.id, body.comment);
  }

  @Post('releases/:id/takedown')
  @ApiOperation({ summary: 'Emergency takedown a release' })
  takedown(@Param('id') id: string, @Body() body: { comment?: string }, @Request() req: any) {
    return this.catalogService.takedownRelease(id, req.admin.id, body?.comment);
  }

  @Post('releases/:id/force-publish')
  @ApiOperation({ summary: 'Force publish a release' })
  forcePublish(@Param('id') id: string, @Body() body: { comment?: string }, @Request() req: any) {
    return this.catalogService.forcePublishRelease(id, req.admin.id, body?.comment);
  }

  @Post('releases/:id/permanent-delete')
  @ApiOperation({ summary: 'Permanently delete a release and all related data' })
  permanentDelete(@Param('id') id: string, @Body() body: { comment?: string }, @Request() req: any) {
    return this.catalogService.permanentDeleteRelease(id, req.admin.id, body?.comment);
  }

  @Get('tracks')
  @ApiOperation({ summary: 'List all tracks' })
  findTracks(
    @Query('search') search?: string,
    @Query('limit')  limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.catalogService.findTracks({ search, limit, offset });
  }
}
