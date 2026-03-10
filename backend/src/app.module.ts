import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CreatorsModule } from './modules/creators/creators.module';
import { StorageModule } from './modules/storage/storage.module';
import { PipelinesModule } from './modules/pipelines/pipelines.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { SystemModule } from './modules/system/system.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    CreatorsModule,
    StorageModule,
    PipelinesModule,
    DisputesModule,
    WalletsModule,
    SystemModule,
    AuditModule,
  ],
})
export class AppModule {}
