import { Injectable, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule'; // [PHASE 4] Cron Decorators
import { PrismaService } from '../../../../prisma/prisma.service';
import { MediaStorageService } from '../../media/services/media-storage.service';

/**
 * Interface untuk mapping hasil raw query dari View Database
 */
interface MediaReferenceRow {
    file_path: string;
    source_table: string;
}

/**
 * Interface hasil eksekusi Garbage Collection
 */
export interface GarbageCollectionResult {
    status: 'SUCCESS' | 'PARTIAL' | 'ABORTED' | 'DRY_RUN' | 'FAILED';
    totalScanned: number;
    zombiesFound: number;
    zombiesDeleted: number;
    sizeReclaimedBytes: number;
    message: string;
}

/**
 * Service Orkestrator untuk Scheduled Garbage Collector.
 * Bertugas membersihkan file fisik yang tidak memiliki referensi di database (Zombie Files).
 */
@Injectable()
export class RetentionCronService {
    private readonly logger = new Logger(RetentionCronService.name);

    // [SAFETY CONFIGURATION]
    private readonly ZOMBIE_THRESHOLD_PERCENTAGE = 0.10;
    private readonly TIME_BUFFER_MS = 24 * 60 * 60 * 1000;

    // [RESOURCE MANAGEMENT]
    // Yielding: Beri napas ke Event Loop setiap memproses X file.
    // Mencegah blocking CPU saat iterasi ribuan file.
    private readonly CHUNK_SIZE = 100;

    constructor(
        private readonly prisma: PrismaService,
        private readonly mediaService: MediaStorageService,
    ) { }

    // --- PHASE 4: SCHEDULING & CONCURRENCY CONTROL ---

    /**
     * CRON JOB: Weekly Garbage Collector
     * Jadwal: Setiap Hari Minggu pukul 03:00 AM (Low Traffic Window)
     */
    @Cron('0 3 * * 0') // Atau gunakan CronExpression.EVERY_WEEK_SUNDAY_AT_3AM
    async handleScheduledCleanup() {
        this.logger.log('CRON TRIGGER: Starting Weekly Media Garbage Collection...');

        // 1. Concurrency Control (Simple Locking)
        // Cek apakah ada job yang sedang berjalan (Status: STARTED)
        const activeJob = await this.prisma.retentionLog.findFirst({
            where: {
                entityType: 'MEDIA_GC',
                status: 'STARTED',
            },
        });

        if (activeJob) {
            this.logger.warn(
                `SKIPPING CRON: Found active GC job (ID: ${activeJob.id}) started at ${activeJob.startedAt}. Manual intervention required if stuck.`,
            );
            return;
        }

        // 2. Acquire Lock (Create STARTED Log)
        const startTime = new Date();
        const logEntry = await this.prisma.retentionLog.create({
            data: {
                executorId: 'SYSTEM_CRON', // Penanda eksekusi otomatis
                entityType: 'MEDIA_GC',
                status: 'STARTED',
                recordsDeleted: 0,
                cutoffDate: startTime,
                metadata: {
                    action: 'SCHEDULED_GC',
                    mode: 'LIVE', // Cron berjalan di mode LIVE (Hapus file)
                },
            },
        });

        try {
            // 3. Execute Logic (Live Mode)
            const result = await this.executeGarbageCollection('SYSTEM_CRON', false);

            // 4. Release Lock (Update to COMPLETED)
            await this.prisma.retentionLog.update({
                where: { id: logEntry.id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    recordsDeleted: result.zombiesDeleted,
                    metadata: {
                        ...(logEntry.metadata as object),
                        ...result, // Merge hasil detail
                        completion_status: 'SUCCESS',
                    },
                },
            });

            this.logger.log(`CRON FINISHED: ${result.message}`);

        } catch (error) {
            // 5. Error Handling (Update to FAILED)
            this.logger.error(`CRON FAILED: ${error.message}`, error.stack);

            await this.prisma.retentionLog.update({
                where: { id: logEntry.id },
                data: {
                    status: 'FAILED',
                    completedAt: new Date(),
                    metadata: {
                        ...(logEntry.metadata as object),
                        error_message: error.message,
                        completion_status: 'ERROR',
                    },
                },
            });
        }
    }

    // --- PHASE 2: DATABASE CROSS-REFERENCE ---

    async buildDatabaseWhitelist(): Promise<Set<string>> {
        const startTime = Date.now();
        this.logger.log('Building Database Whitelist (Aggregated Lookup)...');

        try {
            const references = await this.prisma.$queryRaw<MediaReferenceRow[]>`
                SELECT file_path FROM view_all_media_references
            `;

            const whitelist = new Set<string>();
            let skippedCount = 0;

            for (const ref of references) {
                if (ref.file_path) {
                    const normalizedPath = ref.file_path.startsWith('/')
                        ? ref.file_path.substring(1)
                        : ref.file_path;

                    whitelist.add(normalizedPath);
                } else {
                    skippedCount++;
                }
            }

            const duration = Date.now() - startTime;
            this.logger.log(
                `Whitelist Built in ${duration}ms. Total Valid References: ${whitelist.size}. (Skipped Empty: ${skippedCount})`
            );

            return whitelist;

        } catch (error) {
            this.logger.error(`Failed to build database whitelist: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Critical: Unable to retrieve media references from database.');
        }
    }

    // --- PHASE 3 & 4: EXECUTION WORKFLOW WITH YIELDING ---

    /**
     * Core Logic: Scanning & Deleting
     * Updated with CPU Yielding/Chunking for Performance.
     */
    async executeGarbageCollection(executorId: string, isDryRun: boolean = true): Promise<GarbageCollectionResult> {
        this.logger.log(`Starting Logic GC. Mode: ${isDryRun ? 'DRY RUN' : 'LIVE DELETION'}`);
        const startTime = new Date();

        // 1. Build Allowlist
        const whitelist = await this.buildDatabaseWhitelist();

        // 2. Scan Storage & Identify Zombies
        const fileIterator = this.mediaService.getFileIterator();

        const zombieCandidates: string[] = [];
        let totalScanned = 0;
        let totalZombieSize = 0;

        // Iterate Physical Files (Streaming)
        for await (const filePath of fileIterator) {
            totalScanned++;

            // [PHASE 4: RESOURCE MANAGEMENT - CPU YIELDING]
            // Setiap 100 file, pause sejenak (setImmediate) agar Event Loop 
            // bisa memproses request HTTP lain yang masuk.
            if (totalScanned % this.CHUNK_SIZE === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }

            // Check: Apakah file ada di Database?
            if (!whitelist.has(filePath)) {
                // [SAFETY CHECK] Time Buffer Rule
                const stats = await this.mediaService.getFileStats(filePath);

                if (stats) {
                    const fileAge = Date.now() - stats.mtime.getTime();

                    // Jika file "Masih Bayi" (< 24 jam), skip.
                    if (fileAge < this.TIME_BUFFER_MS) {
                        continue;
                    }

                    zombieCandidates.push(filePath);
                    totalZombieSize += stats.size;
                }
            }
        }

        // 3. Threshold Circuit Breaker
        const zombieRatio = totalScanned > 0 ? zombieCandidates.length / totalScanned : 0;

        if (zombieCandidates.length > 0 && zombieRatio > this.ZOMBIE_THRESHOLD_PERCENTAGE) {
            const errorMsg = `SAFETY ABORT: Zombie candidates (${zombieCandidates.length}) exceed ${this.ZOMBIE_THRESHOLD_PERCENTAGE * 100}% of total files (${totalScanned}). Investigation required.`;
            this.logger.error(errorMsg);

            // Log Failure (jika bukan cron, cron handle logging sendiri)
            if (executorId !== 'SYSTEM_CRON') {
                await this.logExecution(executorId, 'ABORTED', totalScanned, 0, 0, startTime, errorMsg);
            }

            throw new BadRequestException(errorMsg);
        }

        // 4. Execution Action
        let deletedCount = 0;

        if (!isDryRun) {
            this.logger.log(`Deleting ${zombieCandidates.length} zombie files...`);

            for (const [index, zombiePath] of zombieCandidates.entries()) {
                // [PHASE 4: YIELDING IN DELETION]
                // Yielding juga saat proses delete agar I/O disk tidak memonopoli server
                if (index % this.CHUNK_SIZE === 0) {
                    await new Promise(resolve => setImmediate(resolve));
                }

                const success = await this.mediaService.deleteFile(zombiePath);
                if (success) deletedCount++;
            }
        } else {
            if (zombieCandidates.length > 0) {
                this.logger.log(`[DRY RUN] Found ${zombieCandidates.length} zombies. Would delete: ${zombieCandidates.slice(0, 3).join(', ')}...`);
            }
        }

        const resultStatus = isDryRun ? 'DRY_RUN' : 'SUCCESS';
        const formattedSize = this.formatBytes(totalZombieSize);
        const resultMsg = isDryRun
            ? `Dry Run Complete. Found ${zombieCandidates.length} zombies (${formattedSize}). No files deleted.`
            : `Cleanup Complete. Deleted ${deletedCount} files. Reclaimed ${formattedSize}.`;

        // 5. Audit Logging (Hanya jika manual trigger, Cron log di handleScheduledCleanup)
        if (executorId !== 'SYSTEM_CRON') {
            await this.logExecution(
                executorId,
                resultStatus,
                totalScanned,
                zombieCandidates.length,
                deletedCount,
                startTime,
                resultMsg,
                zombieCandidates.slice(0, 10)
            );
        }

        return {
            status: resultStatus,
            totalScanned,
            zombiesFound: zombieCandidates.length,
            zombiesDeleted: deletedCount,
            sizeReclaimedBytes: totalZombieSize,
            message: resultMsg
        };
    }

    // --- HELPER ---

    private async logExecution(
        executorId: string,
        status: string,
        scanned: number,
        found: number,
        deleted: number,
        startTime: Date,
        message: string,
        samples: string[] = []
    ) {
        try {
            await this.prisma.retentionLog.create({
                data: {
                    executorId,
                    entityType: 'MEDIA_GC',
                    status: 'COMPLETED',
                    recordsDeleted: deleted,
                    cutoffDate: new Date(),
                    startedAt: startTime,
                    completedAt: new Date(),
                    metadata: {
                        action: 'GARBAGE_COLLECTION',
                        total_scanned: scanned,
                        zombies_found: found,
                        sample_zombies: samples,
                        message: message,
                        threshold_check: 'PASSED',
                        dry_run: status === 'DRY_RUN'
                    }
                }
            });
        } catch (error) {
            this.logger.error(`Failed to write retention log: ${error.message}`);
        }
    }

    private formatBytes(bytes: number, decimals = 2): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals < 0 ? 0 : decimals)) + ' ' + sizes[i];
    }
}