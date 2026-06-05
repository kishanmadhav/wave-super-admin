import { Controller, Get, Post, Query, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { AdminAuthGuard } from '../auth/guards';

@ApiTags('wallets')
@Controller('wallets')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth('JWT-auth')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Platform-wide wallet summary stats' })
  getSummary() {
    return this.walletsService.getSummary();
  }

  @Get('mobile')
  @ApiOperation({ summary: 'Get mobile user wallets' })
  getMobileWallets(
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.walletsService.getMobileWallets({ search, limit, offset });
  }

  @Get('artist')
  @ApiOperation({ summary: 'Get artist wallets' })
  getArtistWallets(
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.walletsService.getArtistWallets({ search, limit, offset });
  }

  @Get('mobile/:userId/ledger')
  @ApiOperation({ summary: 'Get ledger entries for a mobile user' })
  getMobileWalletLedger(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.walletsService.getMobileWalletLedger(userId, { limit, offset });
  }

  @Get('artist/:artistId/ledger')
  @ApiOperation({ summary: 'Get ledger entries for an artist' })
  getArtistWalletLedger(
    @Param('artistId') artistId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.walletsService.getArtistWalletLedger(artistId, { limit, offset });
  }

  @Get('labels')
  @ApiOperation({ summary: 'Get label wallets (honors routed to labels)' })
  getLabelWallets(
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.walletsService.getLabelWallets({ search, limit, offset });
  }

  @Get('labels/:labelProfileId/ledger')
  @ApiOperation({ summary: 'Get ledger entries for a label wallet' })
  getLabelWalletLedger(
    @Param('labelProfileId') labelProfileId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.walletsService.getLabelWalletLedger(labelProfileId, { limit, offset });
  }

  @Get('emission-rate')
  @ApiOperation({ summary: 'Get the listening-credit emission rate' })
  getEmissionRate() {
    return this.walletsService.getEmissionRate();
  }

  @Post('emission-rate')
  @ApiOperation({ summary: 'Update the listening-credit emission rate' })
  setEmissionRate(
    @Body() body: { nano_per_window: number; window_seconds: number },
    @Request() req: any,
  ) {
    return this.walletsService.setEmissionRate(body, req.admin?.id ?? null);
  }

  @Post('adjust/:profileId')
  @ApiOperation({ summary: 'Create a manual ledger adjustment for a user' })
  createAdjustment(
    @Param('profileId') profileId: string,
    @Body() body: {
      type: string; source: string; context: string;
      nanoDelta: number; miniDelta: number; reason: string;
    },
    @Request() req: any,
  ) {
    return this.walletsService.createManualAdjustment(profileId, body, req.admin.id);
  }
}
