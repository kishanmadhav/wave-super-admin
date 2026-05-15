/**
 * Standalone OpenAPI spec exporter.
 *
 *   npm run openapi
 *
 * Boots the Nest app WITHOUT listening on a port, serialises the Swagger
 * document to ./openapi.json, and exits. Used to hand a static API spec
 * to external reviewers / pentesters without exposing a running server.
 */
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

// The spec only needs route/DTO metadata — no live Supabase. Provide
// placeholder env so module construction (ConfigService.getOrThrow,
// SupabaseService) doesn't fail when run without a real .env. We also
// skip the startup connectivity check via SKIP_DB_CHECK (honoured in
// SupabaseService.onModuleInit).
process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-for-openapi-export';
process.env.SKIP_DB_CHECK = '1';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Wave Super Admin API')
    .setDescription('Platform operator API — Wave Super Admin console')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Supabase-issued JWT — obtained via supabase.auth.signInWithPassword on the frontend',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Admin identity')
    .addTag('users', 'Platform user management')
    .addTag('catalog', 'Releases & tracks')
    .addTag('creators', 'Creator entities (artists & labels)')
    .addTag('pipelines', 'Verification & review queues')
    .addTag('disputes', 'Dispute case management')
    .addTag('wallets', 'Ledger & wallets')
    .addTag('system', 'Platform parameters, feature flags & taxonomies')
    .addTag('audit', 'Audit trail')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outPath = join(process.cwd(), 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec written to ${outPath}`);

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to export OpenAPI spec:', err);
  process.exit(1);
});
