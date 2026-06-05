import { Module } from '@nestjs/common';
import { TribesController } from './tribes.controller';
import { TribesService } from './tribes.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TribesController],
  providers: [TribesService],
})
export class TribesModule {}
