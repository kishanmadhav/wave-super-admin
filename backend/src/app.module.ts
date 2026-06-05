import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { AdsModule } from './modules/ads/ads.module';
import { TribesModule } from './modules/tribes/tribes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Admin endpoints — tighter than the CMS. 60 req/min default.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 60 },
      { name: 'strict',  ttl: 60_000, limit: 20 },
    ]),
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
    AdsModule,
    TribesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
