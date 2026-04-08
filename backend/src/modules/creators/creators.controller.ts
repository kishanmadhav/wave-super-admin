import { Controller, Get, Post, Delete, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/guards';
import { CreatorsService } from './creators.service';

@ApiTags('creators')
@Controller('creators')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get('artists')
  @ApiOperation({ summary: 'List all artists (creator entities)' })
  listArtists(
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.creatorsService.listArtists({ search, limit, offset });
  }

  @Get('labels')
  @ApiOperation({ summary: 'List all label profiles (creator entities)' })
  listLabels(
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.creatorsService.listLabels({ search, limit, offset });
  }

  @Post('profiles/:profileId/verify')
  @ApiOperation({ summary: 'Verify a creator account (reflected in account_verifications)' })
  verifyProfile(@Param('profileId') profileId: string, @Request() req: any) {
    return this.creatorsService.verifyCreator(profileId, req.admin.id);
  }

  @Post('profiles/:profileId/unverify')
  @ApiOperation({ summary: 'Remove verification for a creator account' })
  unverifyProfile(@Param('profileId') profileId: string, @Request() req: any) {
    return this.creatorsService.unverifyCreator(profileId, req.admin.id);
  }

  @Delete('artists/:artistId')
  @ApiOperation({ summary: 'Delete an artist record' })
  deleteArtist(@Param('artistId') artistId: string, @Request() req: any) {
    return this.creatorsService.deleteArtist(artistId, req.admin.id);
  }

  @Delete('labels/:labelId')
  @ApiOperation({ summary: 'Delete a label profile record' })
  deleteLabel(@Param('labelId') labelId: string, @Request() req: any) {
    return this.creatorsService.deleteLabel(labelId, req.admin.id);
  }

  @Post('artists/:artistId/disable')
  @ApiOperation({ summary: 'Disable (suspend) an artist account' })
  disableArtist(@Param('artistId') artistId: string, @Body() body: { reason: string }, @Request() req: any) {
    return this.creatorsService.disableArtist(artistId, req.admin.id, body.reason);
  }

  @Post('labels/:labelId/disable')
  @ApiOperation({ summary: 'Disable (suspend) a label account' })
  disableLabel(@Param('labelId') labelId: string, @Body() body: { reason: string }, @Request() req: any) {
    return this.creatorsService.disableLabel(labelId, req.admin.id, body.reason);
  }
}

