import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());

  // The chat widget and public forms are embedded/shared on arbitrary third-party
  // sites, so their routes need to accept any origin — handled here, ahead of the
  // app-wide CORS policy below.
  app.use((req: any, res: any, next: any) => {
    if (req.path.startsWith('/api/v1/widget') || req.path.startsWith('/api/v1/forms/public')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    next();
  });

  app.enableCors({
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix (health endpoint excluded so Render health check works at /health)
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  // Swagger docs (disable in production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('WhatsLark API')
      .setDescription('WhatsApp CRM for Sales, Support & Automation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || process.env.API_PORT || 3001;
  await app.listen(port);
  console.log(`WhatsLark API running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
