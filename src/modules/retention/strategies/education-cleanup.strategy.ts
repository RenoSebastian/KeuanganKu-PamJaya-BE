import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PruneExecutionDto } from '../dto/prune-execution.dto';
import { EducationModuleStatus } from '@prisma/client';
import { RetentionStrategy } from '../interfaces/retention-strategy.interface'; // [FIX] Import Interface

@Injectable()
export class EducationCleanupStrategy implements RetentionStrategy {
    private readonly logger = new Logger(EducationCleanupStrategy.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Strategi Retensi Khusus Edukasi:
     * 1. PROTECT: UserEducationProgress (KPI Data) tidak boleh dihapus.
     * 2. PRUNE: EducationModule yang statusnya ARCHIVED dan sudah > 2 tahun (sesuai cutoffDate).
     */
    async execute(cutoffDate: Date, isDryRun: boolean): Promise<PruneExecutionDto> {
        this.logger.log('Executing Education Retention Strategy...');

        // 1. Whitelist Log (Data KPI Pegawai tidak disentuh)
        this.logger.log('[SAFEGUARD] UserEducationProgress table is WHITELISTED. Skipping user progress data pruning.');

        // 2. Identify Stale Archived Modules
        // Mencari modul yang statusnya ARCHIVED dan terakhir diupdate sebelum tanggal cutoff.
        const staleModules = await this.prisma.educationModule.count({
            where: {
                status: EducationModuleStatus.ARCHIVED,
                updatedAt: { lte: cutoffDate },
            },
        });

        // --- Mode DRY RUN (Hanya Estimasi) ---
        if (isDryRun) {
            return {
                strategyName: 'EducationCleanupStrategy',
                targetTable: 'education_modules (ARCHIVED ONLY)',
                recordsToPrune: staleModules,
                status: 'DRY_RUN',
                executedAt: new Date(),
                // Field validasi input dikosongkan karena ini output process
                entityType: 'EDUCATION_CLEANUP',
                cutoffDate: cutoffDate.toISOString(),
                pruneToken: 'INTERNAL_PROCESS'
            };
        }

        // --- Mode EXECUTE (Penghapusan Fisik) ---
        // Karena Cascade Delete aktif di Schema Prisma, menghapus EducationModule
        // akan otomatis menghapus Quiz, Questions, dan Options terkait.

        let deletedCount = 0;
        if (staleModules > 0) {
            const result = await this.prisma.educationModule.deleteMany({
                where: {
                    status: EducationModuleStatus.ARCHIVED,
                    updatedAt: { lte: cutoffDate },
                },
            });
            deletedCount = result.count;
        }

        return {
            strategyName: 'EducationCleanupStrategy',
            targetTable: 'education_modules',
            recordsToPrune: deletedCount,
            status: 'SUCCESS',
            executedAt: new Date(),
            // Isi field wajib DTO dengan nilai default/konteks saat ini
            entityType: 'EDUCATION_CLEANUP',
            cutoffDate: cutoffDate.toISOString(),
            pruneToken: 'EXECUTED'
        };
    }
}