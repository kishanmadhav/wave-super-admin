import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body, Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdsService, Placement } from './ads.service';
import { AdminAuthGuard } from '../auth/guards';

@ApiTags('ads')
@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  // Mobile-facing endpoint. Returns currently-active ads with short-lived
  // signed URLs. No admin check — any caller (including anon) can fetch.
  // Kept outside the AdminAuthGuard scope deliberately.
  @Get('active')
  @ApiOperation({ summary: 'Active ads for a placement (mobile)' })
  listActive(@Query('placement') placement?: Placement) {
    if (!placement) return [];
    return this.ads.listActive(placement);
  }

  // ───── Admin-only routes below ─────
  @Get()
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List ads, optionally filtered by placement' })
  list(@Query('placement') placement?: Placement) {
    return this.ads.list(placement);
  }

  @Post('uploads')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mint a signed upload URL for an ad asset' })
  @ApiResponse({ status: 201, description: 'Signed URL minted' })
  createSignedUpload(@Body() body: { placement: Placement; kind: 'image' | 'audio'; filename: string }) {
    return this.ads.createSignedUpload(body.placement, body.kind, body.filename);
  }

  @Post()
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create an ad' })
  create(
    @Body() body: {
      placement: Placement;
      title: string;
      subtitle?: string | null;
      cta_label?: string | null;
      cta_url?: string | null;
      image_path: string;
      audio_path?: string | null;
      nano_reward?: number;
      duration_sec?: number;
      display_order?: number;
      active?: boolean;
      starts_at?: string | null;
      ends_at?: string | null;
    },
    @Request() req: any,
  ) {
    return this.ads.create(body, req.admin?.id ?? null);
  }

  @Patch(':id')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update an ad' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.ads.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete an ad and its media' })
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.ads.remove(id);
  }
}
