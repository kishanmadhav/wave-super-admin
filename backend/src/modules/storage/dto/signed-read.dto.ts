import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignedReadDto {
  @ApiProperty({
    example: 'audio/tracks/my-release-id/song.wav',
    description: 'Full storage key: "{bucket}/{path}"',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?!.*\.\.[/\\])(?!\/)[^\x00]+$/, {
    message: 'key must not contain traversal sequences or null bytes',
  })
  key: string;

  @ApiPropertyOptional({
    example: 3600,
    description: 'URL lifetime in seconds. Min 60 (1 min), max 43200 (12 h). Default 3600.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(43_200)
  expiresIn?: number;
}

