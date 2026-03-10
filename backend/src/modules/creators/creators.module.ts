import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';

@Module({
  imports: [AuthModule],
  controllers: [CreatorsController],
  providers: [CreatorsService],
})
export class CreatorsModule {}

