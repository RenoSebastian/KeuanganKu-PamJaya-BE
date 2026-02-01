import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';

// --- Logging & Monitoring Imports ---
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/configs/winston.config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // 1. Inisialisasi App dengan Custom Logger (Winston)
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  const logger = new Logger('Bootstrap');

  /**
   * 2. GLOBAL PREFIX [PENTING]
   * Agar semua endpoint dimulai dengan /api (contoh: /api/auth/register)
   * Ini harus sinkron dengan konfigurasi Nginx location /api
   */
  app.setGlobalPrefix('api');

  // 3. Konfigurasi Limit Payload
  // Penting untuk upload data besar atau gambar Base64
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  /**
   * 4. Konfigurasi CORS (Cross-Origin Resource Sharing)
   * [CRITICAL FIX] Menambahkan localhost:3000 agar Frontend Dev bisa akses
   */
  app.enableCors({
    origin: [
      'http://localhost:3000',           // [ADDED] Frontend Local Dev (Next.js)
      'https://keuanganku.geocitra.com', // Production Domain
      'http://localhost:8080',           // Docker/Nginx Proxy Local
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // 5. Global Registration (Interceptors, Filters, Pipes)
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
  }));

  // 6. Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Keuanganku API')
    .setDescription('Dokumentasi API untuk Aplikasi Perencanaan Keuangan')
    .setVersion('1.0')
    .addBearerAuth()
    // Menambahkan server opsi agar mudah testing di Swagger UI
    .addServer('http://localhost:4000', 'Local Development')
    .addServer('https://keuanganku.geocitra.com', 'Production Server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Swagger Docs akan dapat diakses di: /api/docs
  SwaggerModule.setup('api/docs', app, document);

  // 7. Port & Listener
  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`🚀 Server berjalan di internal port: ${port}`);
  logger.log(`📄 Swagger Docs siap di: http://localhost:${port}/api/docs`);
}

bootstrap();