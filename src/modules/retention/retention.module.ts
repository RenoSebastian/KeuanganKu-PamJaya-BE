import { Module } from '@nestjs/common';
import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { MediaModule } from '../media/media.module'; // [CRITICAL] Import MediaModule

// Strategy & Factory
import { HistoricalRetentionStrategy } from './strategies/historical-retention.strategy';
import { SnapshotRetentionStrategy } from './strategies/snapshot-retention.strategy';
import { RetentionStrategyFactory } from './strategies/retention-strategy.factory';
import { ExportManagerService } from './services/export-manager.service';
import { EducationCleanupStrategy } from './strategies/education-cleanup.strategy';

@Module({
    imports: [
        PrismaModule,

        /**
         * [DEPENDENCY WIRING]
         * MediaModule wajib di-import di sini agar 'RetentionService' 
         * dan 'EducationCleanupStrategy' bisa mengakses 'MediaStorageService'.
         * Tanpa ini, fitur penghapusan file otomatis akan gagal (NestJS Error).
         */
        MediaModule,
    ],
    controllers: [RetentionController],
    providers: [
        RetentionService,
        RetentionStrategyFactory,
        HistoricalRetentionStrategy,
        SnapshotRetentionStrategy,
        ExportManagerService,
        EducationCleanupStrategy,
    ],
    exports: [RetentionService],
})
export class RetentionModule { }