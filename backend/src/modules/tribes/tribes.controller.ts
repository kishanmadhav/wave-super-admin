import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TribesService } from './tribes.service';
import { AdminAuthGuard } from '../auth/guards';

@ApiTags('tribes')
@Controller('tribes/dj-wave')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TribesController {
  constructor(private readonly tribes: TribesService) {}

  @Get()
  @ApiOperation({ summary: 'DJ Wave snapshot (artist + tribe + signed avatar URL)' })
  getDjWave() {
    return this.tribes.getDjWave();
  }

  // ── Avatar ────────────────────────────────────────────────────────
  @Post('avatar/upload')
  @ApiOperation({ summary: 'Mint a signed upload URL for DJ Wave\'s avatar' })
  createAvatarUpload(@Body() body: { filename: string }) {
    return this.tribes.createAvatarUpload(body.filename);
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Persist a freshly-uploaded avatar path' })
  setAvatar(@Body() body: { path: string }) {
    return this.tribes.setAvatar(body.path);
  }

  // ── Posts ─────────────────────────────────────────────────────────
  @Get('posts')
  @ApiOperation({ summary: 'List DJ Wave posts' })
  listPosts(@Query('limit') limit?: number, @Query('offset') offset?: number) {
    return this.tribes.listPosts(limit, offset);
  }

  @Post('posts/media/upload')
  @ApiOperation({ summary: 'Signed upload URL for post media (image/video)' })
  createPostMediaUpload(@Body() body: { filename: string }) {
    return this.tribes.createPostMediaUpload(body.filename);
  }

  @Post('posts')
  @ApiOperation({ summary: 'Publish a DJ Wave post' })
  createPost(@Body() body: { type?: any; title?: string; body?: string; media_urls?: string[]; source_url?: string }) {
    return this.tribes.createPost(body);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Delete a DJ Wave post (also removes its media)' })
  deletePost(@Param('id') id: string) {
    return this.tribes.deletePost(id);
  }
}
