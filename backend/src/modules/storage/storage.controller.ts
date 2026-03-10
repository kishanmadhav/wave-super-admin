import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { AdminAuthGuard } from '../auth/guards';
import { SignedUploadDto } from './dto/signed-upload.dto';
import { SignedReadDto } from './dto/signed-read.dto';

@ApiTags('storage')
@Controller('storage')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth('JWT-auth')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(private readonly storageService: StorageService) {}

  @Post('sign')
  @ApiOperation({ summary: 'Get a signed upload URL for direct-to-Supabase uploads' })
  async getSignedUploadUrl(
    @Body() dto: SignedUploadDto,
  ): Promise<{ signedUrl: string; token: string; path: string }> {
    const key = `${dto.bucket}/${dto.path}`;
    return this.storageService.getSignedUploadUrl(key);
  }

  @Post('sign/read')
  @ApiOperation({ summary: 'Get a signed read URL for a private file' })
  async getSignedReadUrl(@Body() dto: SignedReadDto): Promise<{ url: string }> {
    this.logger.log(`Signed read request — key: "${dto.key}", expiresIn: ${dto.expiresIn ?? 3600}`);
    try {
      const url = await this.storageService.getSignedUrl(dto.key, dto.expiresIn ?? 3600);
      return { url };
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? String(err);
      this.logger.error(`Failed to create signed read URL for "${dto.key}": ${msg}`);
      throw new InternalServerErrorException(`Cannot create signed URL: ${msg}`);
    }
  }
}

