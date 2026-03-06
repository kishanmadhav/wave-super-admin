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

  @Get('ledger')
  @ApiOperation({ summary: 'Get ledger entries' })
  getLedger(
    @Query('search') search?: string,
    @Query('source') source?: string,
    @Query('limit')  limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.walletsService.getLedger({ search, source, limit, offset });
  }

  @Get('fan')
  @ApiOperation({ summary: 'Get fan wallets ordered by balance' })
  getFanWallets(@Query('limit') limit?: number, @Query('offset') offset?: number) {
    return this.walletsService.getFanWallets({ limit, offset });
  }

  @Get('earnings')
  @ApiOperation({ summary: 'Get creator earnings wallets' })
  getEarningsWallets(@Query('limit') limit?: number, @Query('offset') offset?: number) {
    return this.walletsService.getEarningsWallets({ limit, offset });
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
