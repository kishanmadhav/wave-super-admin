import { IsEnum, IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignedUploadDto {
  @ApiProperty({ enum: ['audio', 'images'], description: 'Supabase Storage bucket name' })
  @IsEnum(['audio', 'images'])
  bucket: 'audio' | 'images';

  @ApiProperty({
    example: 'tracks/my-release-id/song.wav',
    description: 'Object path inside the bucket (no leading slash)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?!.*\.\.[/\\])(?!\/)[^\x00]+$/, {
    message: 'path must not contain traversal sequences or null bytes',
  })
  path: string;
}

