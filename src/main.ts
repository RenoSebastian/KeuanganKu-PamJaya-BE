import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express'; // [REQUIRED] Untuk akses asset statis
import * as express from 'express';
import { join } from 'path';

// --- Logging & Monitoring Imports ---
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/configs/winston.config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  /**
   * 1. Inisialisasi App dengan NestExpressApplication
   * Diperlukan agar kita bisa menggunakan method .useStaticAssets()
   */
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  const logger = new Logger('Bootstrap');

  /**
   * 2. STATIC ASSETS CONFIGURATION [NEW]
   * Menjadikan folder 'uploads' dapat diakses secara publik lewat browser.
   * Contoh: http://localhost:4000/uploads/filename.jpg
   */
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  /**
   * 3. GLOBAL PREFIX
   * Sinkron dengan konfigurasi Nginx dan Router di Frontend
   */
  app.setGlobalPrefix('api');

  // 4. Konfigurasi Limit Payload
  // Kapasitas 50mb memadai untuk upload gambar berkualitas tinggi dari device
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  /**
   * 5. Konfigurasi CORS
   * Menambahkan akses dari domain geocitra dan localhost dev
   */
  app.enableCors({
    origin: [
      'http://localhost:3000',           // Frontend Next.js Local
      'https://keuanganku.geocitra.com', // Production Domain
      'http://localhost:8080',           // Docker/Nginx Proxy Local
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // 6. Global Registration (Interceptors, Filters, Pipes)
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
  }));

  // 7. Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Keuanganku API')
    .setDescription('API Dokumentasi Portal Belajar & Perencanaan Keuangan PAM Jaya')
    .setVersion('1.0')
    .addBearerAuth()
    .addServer('http://localhost:4000', 'Local Development')
    .addServer('https://keuanganku.geocitra.com', 'Production Server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 8. Port & Listener
  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`🚀 Backend Server running on internal port: ${port}`);
  logger.log(`📂 Static Assets (Uploads) path: ${join(__dirname, '..', 'uploads')}`);
  logger.log(`📄 Swagger Docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();