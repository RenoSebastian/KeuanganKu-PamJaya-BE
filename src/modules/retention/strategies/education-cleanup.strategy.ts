import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MediaStorageService } from '/../../../../media/services/media-storage.service';
import { PruneExecutionDto } from '../dto/prune-execution.dto';
import { EducationModuleStatus } from '@prisma/client';
import { RetentionStrategy } from '../interfaces/retention-strategy.interface';

@Injectable()
export class EducationCleanupStrategy implements RetentionStrategy {
    private readonly logger = new Logger(EducationCleanupStrategy.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mediaService: MediaStorageService, // [DEPENDENCY] Injeksi Media Service
    ) { }

    /**
     * Strategi Retensi Cerdas (Hybrid):
     * 1. Cari kandidat modul:
     * - ARCHIVED & lebih tua dari cutoffDate (Default: 1 tahun).
     * - DRAFT & tidak diupdate > 90 hari (Stale Drafts).
     * 2. FILTER: Jangan hapus modul yang memiliki data progress user (KPI Protection).
     * 3. EKSEKUSI: Hapus DB Record -> Hapus File Fisik.
     */
    async pruneData(cutoffDate: Date): Promise<PruneExecutionDto> {
        this.logger.log(`Executing Education Retention Strategy with cutoff: ${cutoffDate.toISOString()}`);

        const result = new PruneExecutionDto();
        result.entityType = 'EDUCATION_MODULE';
        result.executedAt = new Date();
        result.cutoffDate = cutoffDate.toISOString();

        try {
            // 1. Identifikasi Semua Kandidat (Archived Old OR Stale Drafts)
            const staleDraftDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 Hari lalu

            const candidates = await this.prisma.educationModule.findMany({
                where: {
                    OR: [
                        {
                            status: EducationModuleStatus.ARCHIVED,
                            updatedAt: { lte: cutoffDate },
                        },
                        {
                            status: EducationModuleStatus.DRAFT,
                            updatedAt: { lte: staleDraftDate },
                        }
                    ]
                },
                select: {
                    id: true,
                    thumbnailUrl: true, // Ambil info file cover
                    sections: {
                        select: { illustrationUrl: true } // Ambil info file section
                    }
                },
            });

            if (candidates.length === 0) {
                result.recordsDeleted = 0;
                result.status = 'SUCCESS';
                result.message = 'No education modules met the retention criteria.';
                return result;
            }

            const candidateIds = candidates.map(c => c.id);

            // 2. SAFETY CHECK: Cari modul yang punya data UserProgress (KPI Protection)
            // Kita tidak boleh menghapus modul ini karena akan menghapus history belajar pegawai
            const modulesWithProgress = await this.prisma.userEducationProgress.findMany({
                where: {
                    moduleId: { in: candidateIds }
                },
                select: { moduleId: true },
                distinct: ['moduleId']
            });

            const protectedModuleIds = new Set(modulesWithProgress.map(m => m.moduleId));

            // Filter: Hanya hapus modul yang TIDAK ada di protected list
            const modulesToDelete = candidates.filter(c => !protectedModuleIds.has(c.id));
            const safeToDeleteIds = modulesToDelete.map(c => c.id);

            // Logging skipped items
            const skippedCount = candidateIds.length - safeToDeleteIds.length;
            if (skippedCount > 0) {
                this.logger.warn(`[SAFEGUARD] Skipped ${skippedCount} modules because they contain User KPI data.`);
            }

            if (safeToDeleteIds.length === 0) {
                result.recordsDeleted = 0;
                result.status = 'SUCCESS';
                result.message = 'Candidates found but all were protected by KPI safeguard.';
                return result;
            }

            // 3. [DB EXECUTE] Hapus Data Database
            // Lakukan delete DB dulu. Jika gagal, file fisik aman.
            const deleteOp = await this.prisma.educationModule.deleteMany({
                where: {
                    id: { in: safeToDeleteIds }
                }
            });

            result.recordsDeleted = deleteOp.count;

            // 4. [FILE CLEANUP] Hapus File Fisik (Async Post-Action)
            // Mengumpulkan semua path file dari modul yang SUDAH dihapus datanya
            const filesToDelete: string[] = [];

            for (const mod of modulesToDelete) {
                // Collect Module Thumbnail
                if (mod.thumbnailUrl) {
                    filesToDelete.push(mod.thumbnailUrl);
                }
                // Collect Section Illustrations
                if (mod.sections) {
                    mod.sections.forEach(sec => {
                        if (sec.illustrationUrl) {
                            filesToDelete.push(sec.illustrationUrl);
                        }
                    });
                }
            }

            // Eksekusi penghapusan file secara paralel & aman (Promise.allSettled)
            // Kita tidak ingin error pada satu file menghentikan proses cleanup lainnya
            if (filesToDelete.length > 0) {
                this.logger.log(`Pruning ${filesToDelete.length} physical assets associated with deleted modules...`);

                const fileResults = await Promise.allSettled(
                    filesToDelete.map(path => this.mediaService.deleteFile(path))
                );

                const successCount = fileResults.filter(r => r.status === 'fulfilled').length;
                this.logger.log(`Physical cleanup complete. Deleted: ${successCount}/${filesToDelete.length} files.`);
            }

            result.status = 'SUCCESS';
            result.message = `Deleted ${deleteOp.count} modules. Protected ${skippedCount} modules. Pruned ${filesToDelete.length} files.`;

        } catch (error) {
            this.logger.error(`Retention execution failed: ${error.message}`, error.stack);
            result.recordsDeleted = 0;
            result.status = 'FAILED';
            result.message = error.message;
        }

        return result;
    }
}