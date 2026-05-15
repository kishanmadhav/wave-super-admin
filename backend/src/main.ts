import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust the first hop (load balancer / reverse proxy) so req.ip reflects
  // the real client. Override TRUST_PROXY_HOPS to match your topology.
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? '1');
  app.set('trust proxy', trustProxyHops);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3002',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  const enableSwagger =
    process.env.ENABLE_SWAGGER === '1' || process.env.NODE_ENV !== 'production';

  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Wave Super Admin API')
      .setDescription('Platform operator API — Wave Super Admin console')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase-issued JWT — obtained via supabase.auth.signInWithPassword on the frontend',
        },
        'JWT-auth',
      )
      .addTag('auth',      'Admin identity')
      .addTag('users',     'Platform user management')
      .addTag('catalog',   'Releases & tracks')
      .addTag('creators',  'Creator entities (artists & labels)')
      .addTag('pipelines', 'Verification & review queues')
      .addTag('disputes',  'Dispute case management')
      .addTag('wallets',   'Ledger & wallets')
      .addTag('system',    'Platform parameters, feature flags & taxonomies')
      .addTag('audit',     'Audit trail')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  console.log(`Wave Super Admin API running on http://localhost:${port}`);
  if (enableSwagger) {
    console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}
bootstrap();
