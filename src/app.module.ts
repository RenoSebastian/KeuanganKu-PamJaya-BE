import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';

// --- Logging & Config ---
import { winstonConfig } from './common/configs/winston.config';

// --- Modules ---
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FinancialModule } from './modules/financial/financial.module';
import { AuditModule } from './modules/audit/audit.module';
import { MarketModule } from './modules/market/market.module';
import { DirectorModule } from './modules/director/director.module';
import { SearchModule } from './modules/search/search.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { RetentionModule } from './modules/retention/retention.module';
import { EducationModule } from './modules/education/education.module';
import { MediaModule } from './modules/media/media.module';

// --- Interceptors ---
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    // 1. Global Configurations
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    WinstonModule.forRoot(winstonConfig),

    /**
     * 2. SERVE STATIC FILES configuration
     * [LOGICAL FIX]: Kita arahkan ke folder './uploads' agar sinkron dengan 
     * MediaStorageService. Dengan 'serveRoot: /uploads', file di 
     * folder './uploads/abc.jpg' akan diakses via 'http://domain.com/uploads/abc.jpg'
     */
    ServeStaticModule.forRoot({
      rootPath: path.join(__dirname, '..', 'uploads'),
      // Serve static uploads under /api/uploads to match global API prefix
      serveRoot: '/api/uploads',
    }),

    // 3. Core Database Module
    PrismaModule,

    // 4. Feature Modules
    AuthModule,
    UsersModule,
    FinancialModule,
    AuditModule,
    MarketModule,
    DirectorModule,
    SearchModule,
    MasterDataModule,
    RetentionModule,
    EducationModule,
    MediaModule, // Handled POST /api/media/upload
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule { }