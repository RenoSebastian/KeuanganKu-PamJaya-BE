import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PruneExecutionDto } from '../dto/prune-execution.dto';
import { EducationModuleStatus } from '@prisma/client';
import { RetentionStrategy } from '../interfaces/retention-strategy.interface';

@Injectable()
export class EducationCleanupStrategy implements RetentionStrategy {
    private readonly logger = new Logger(EducationCleanupStrategy.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Strategi Retensi Cerdas:
     * 1. Cari kandidat modul yang statusnya ARCHIVED & usang.
     * 2. FILTER: Jangan hapus modul yang memiliki data progress user (KPI).
     * 3. EKSEKUSI: Hapus hanya modul yang aman untuk dihapus.
     */
    async execute(cutoffDate: Date, isDryRun: boolean): Promise<PruneExecutionDto> {
        this.logger.log('Executing Education Retention Strategy (Smart Mode)...');

        // 1. Identifikasi Semua Kandidat (Archived & Old)
        const candidates = await this.prisma.educationModule.findMany({
            where: {
                status: EducationModuleStatus.ARCHIVED,
                updatedAt: { lte: cutoffDate },
            },
            select: { id: true },
        });

        const candidateIds = candidates.map(c => c.id);

        if (candidateIds.length === 0) {
            return this.buildResult(0, 'SUCCESS', cutoffDate);
        }

        // 2. SAFETY CHECK: Cari modul yang punya data UserProgress
        // Kita tidak boleh menghapus modul ini karena akan menghapus KPI pegawai (Cascade)
        const modulesWithProgress = await this.prisma.userEducationProgress.findMany({
            where: {
                moduleId: { in: candidateIds }
            },
            select: { moduleId: true },
            distinct: ['moduleId']
        });

        const protectedModuleIds = new Set(modulesWithProgress.map(m => m.moduleId));

        // Filter: Hanya hapus modul yang TIDAK ada di protected list
        const safeToDeleteIds = candidateIds.filter(id => !protectedModuleIds.has(id));

        const skippedCount = candidateIds.length - safeToDeleteIds.length;
        if (skippedCount > 0) {
            this.logger.warn(`[SAFEGUARD] Skipped ${skippedCount} modules because they contain User KPI data.`);
        }

        // --- DRY RUN ---
        if (isDryRun) {
            return {
                strategyName: 'EducationCleanupStrategy',
                targetTable: 'education_modules',
                recordsToPrune: safeToDeleteIds.length,
                status: 'DRY_RUN',
                executedAt: new Date(),
                entityType: 'EDUCATION_CLEANUP',
                cutoffDate: cutoffDate.toISOString(),
                pruneToken: 'INTERNAL_PROCESS'
            };
        }

        // --- EXECUTE ---
        let deletedCount = 0;
        if (safeToDeleteIds.length > 0) {
            const result = await this.prisma.educationModule.deleteMany({
                where: {
                    id: { in: safeToDeleteIds }
                }
            });
            deletedCount = result.count;
        }

        return this.buildResult(deletedCount, 'SUCCESS', cutoffDate);
    }

    private buildResult(count: number, status: 'SUCCESS' | 'FAILED' | 'DRY_RUN', date: Date): PruneExecutionDto {
        return {
            strategyName: 'EducationCleanupStrategy',
            targetTable: 'education_modules',
            recordsToPrune: count,
            status: status,
            executedAt: new Date(),
            entityType: 'EDUCATION_CLEANUP',
            cutoffDate: date.toISOString(),
            pruneToken: 'EXECUTED'
        };
    }
}