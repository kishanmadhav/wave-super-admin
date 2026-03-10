import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  console.log(`Wave Super Admin API running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
