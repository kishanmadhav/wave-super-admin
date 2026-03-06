import { Controller, Get, Patch, Post, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { AdminAuthGuard } from '../auth/guards';

@ApiTags('system')
@Controller('system')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth('JWT-auth')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('parameters')
  @ApiOperation({ summary: 'List all platform parameters' })
  getParameters() {
    return this.systemService.getParameters();
  }

  @Patch('parameters/:id')
  @ApiOperation({ summary: 'Update a platform parameter value' })
  updateParameter(
    @Param('id') id: string,
    @Body() body: { value: string; reason: string },
    @Request() req: any,
  ) {
    return this.systemService.updateParameter(id, body.value, body.reason ?? 'Updated via admin portal', req.admin.id);
  }

  @Get('feature-flags')
  @ApiOperation({ summary: 'List all feature flags' })
  getFeatureFlags() {
    return this.systemService.getFeatureFlags();
  }

  @Patch('feature-flags/:id')
  @ApiOperation({ summary: 'Toggle a feature flag on or off' })
  toggleFlag(
    @Param('id') id: string,
    @Body() body: { enabled: boolean },
    @Request() req: any,
  ) {
    return this.systemService.toggleFeatureFlag(id, body.enabled, req.admin.id);
  }

  @Get('taxonomies')
  @ApiOperation({ summary: 'List taxonomies, optionally filtered by type' })
  getTaxonomies(@Query('type') type?: string) {
    return this.systemService.getTaxonomies(type);
  }

  @Post('taxonomies')
  @ApiOperation({ summary: 'Create or update a taxonomy entry' })
  upsertTaxonomy(@Body() body: { type: string; value: string; label: string; active: boolean; sort_order?: number }) {
    return this.systemService.upsertTaxonomy(body);
  }
}
