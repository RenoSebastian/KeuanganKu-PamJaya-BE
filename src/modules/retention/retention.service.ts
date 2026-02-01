import {
    Injectable,
    InternalServerErrorException,
    Logger,
    BadRequestException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { DatabaseStatsResponseDto, TableStatItemDto } from './dto/database-stats.dto';
import { PruneExecutionDto } from './dto/prune-execution.dto';
import { RetentionStrategyFactory } from './strategies/retention-strategy.factory';
import { RetentionEntityType } from './dto/export-query.dto';

@Injectable()
export class RetentionService {
    private readonly logger = new Logger(RetentionService.name);

    // SECRET KEY untuk HMAC Signature
    private readonly HMAC_SECRET = process.env.RETENTION_SECRET || 'DO_NOT_USE_THIS_IN_PROD_SUPER_SECRET_KEY_99';

    constructor(
        private readonly prisma: PrismaService,
        private readonly strategyFactory: RetentionStrategyFactory,
    ) { }

    // --- FASE 1: MONITORING ---

    async getDatabaseStats(): Promise<DatabaseStatsResponseDto> {
        try {
            const rawStats = await this.prisma.$queryRaw<any[]>`
        SELECT 
          relname as "tableName", 
          n_live_tup as "rowCount", 
          pg_total_relation_size(relid) as "totalBytes",
          pg_indexes_size(relid) as "indexBytes"
        FROM pg_stat_user_tables 
        ORDER BY pg_total_relation_size(relid) DESC;
      `;

            const stats: TableStatItemDto[] = rawStats.map((row) => ({
                tableName: row.tableName,
                rowCount: Number(row.rowCount),
                totalBytes: Number(row.totalBytes),
                formattedSize: this.formatBytes(Number(row.totalBytes)),
                indexBytes: Number(row.indexBytes),
            }));

            const totalSize = stats.reduce((acc, curr) => acc + curr.totalBytes, 0);

            return {
                tables: stats,
                totalDatabaseSize: totalSize,
                formattedTotalSize: this.formatBytes(totalSize),
            };
        } catch (error) {
            this.logger.error('Failed to fetch database stats', error.stack);
            throw new InternalServerErrorException('Gagal mengambil statistik database.');
        }
    }

    // --- SECURITY: TOKEN GENERATION & VERIFICATION ---

    generatePruneToken(entityType: string, cutoffDate: string): string {
        const payload = JSON.stringify({ entityType, cutoffDate });
        const signature = crypto
            .createHmac('sha256', this.HMAC_SECRET)
            .update(payload)
            .digest('hex');
        return `${Buffer.from(payload).toString('base64')}.${signature}`;
    }

    private validatePruneToken(token: string, entityType: string, cutoffDate: string): void {
        try {
            if (!token || !token.includes('.')) throw new Error('Invalid token format');

            const [b64Payload, signature] = token.split('.');
            const payloadStr = Buffer.from(b64Payload, 'base64').toString('utf-8');

            const expectedSignature = crypto
                .createHmac('sha256', this.HMAC_SECRET)
                .update(payloadStr)
                .digest('hex');

            if (signature !== expectedSignature) {
                throw new UnauthorizedException('Security Token Invalid (Signature Mismatch).');
            }

            const payload = JSON.parse(payloadStr);
            if (payload.entityType !== entityType || payload.cutoffDate !== cutoffDate) {
                throw new UnauthorizedException(
                    'Security Token tidak cocok dengan parameter penghapusan saat ini.',
                );
            }
        } catch (error) {
            this.logger.warn(`Token validation failed: ${error.message}`);
            throw new UnauthorizedException(
                'Gagal memverifikasi Security Token. Pastikan Anda menyalin token dari file export yang benar.',
            );
        }
    }

    // --- TIMEZONE & DATE HELPER ---

    normalizeCutoffDate(dateStr: string): Date {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            throw new BadRequestException('Format tanggal harus YYYY-MM-DD');
        }
        const date = new Date(`${dateStr}T00:00:00.000Z`);
        if (isNaN(date.getTime())) {
            throw new BadRequestException('Tanggal tidak valid.');
        }
        return date;
    }

    private validateSafetyDate(cutoff: Date) {
        const now = new Date();
        const startOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

        if (cutoff >= startOfCurrentMonth) {
            throw new BadRequestException(
                'SAFETY VIOLATION: Tidak diizinkan menghapus data bulan berjalan atau masa depan.',
            );
        }
    }

    // --- INTERNAL MAPPING HELPER ---

    private getTableName(entityType: string): string {
        const map: Record<string, string> = {
            [RetentionEntityType.FINANCIAL_CHECKUP]: 'financial_checkups',
            [RetentionEntityType.PENSION]: 'pension_plans',
            [RetentionEntityType.GOAL]: 'goal_plans',
            [RetentionEntityType.BUDGET]: 'budget_plans',
            [RetentionEntityType.INSURANCE]: 'insurance_plans',
            'EDUCATION_CLEANUP': 'education_modules',
        };
        return map[entityType];
    }

    // --- FASE 4: EXECUTION (STRATEGY PATTERN ADAPTER) ---

    async executePruning(
        adminId: string,
        dto: PruneExecutionDto,
    ): Promise<{ deletedCount: number; message: string }> {
        const { entityType, cutoffDate, pruneToken } = dto;

        // 1. Validasi Keamanan
        this.validatePruneToken(pruneToken, entityType, cutoffDate);
        const cutoff = this.normalizeCutoffDate(cutoffDate);
        this.validateSafetyDate(cutoff);

        this.logger.log(`Executing SECURE PRUNE for ${entityType} < ${cutoff.toISOString()} by Admin ${adminId}`);

        // 2. Strategy Execution
        // Sekarang kita mendelegasikan seluruh logika ke Strategy masing-masing
        try {
            const strategy = this.strategyFactory.getStrategy(entityType);
            const tableName = this.getTableName(entityType); // Context untuk strategi generik

            // Execute: Strategy akan menangani dry-run, counting, dan deletion
            const result = await strategy.execute(cutoff, false, tableName); // isDryRun = false

            if (result.status === 'FAILED') {
                throw new InternalServerErrorException('Strategy execution reported failure.');
            }

            const deletedCount = result.recordsToPrune || 0;

            // 3. Audit Logging
            await this.prisma.retentionLog.create({
                data: {
                    executorId: adminId,
                    entityType: entityType,
                    action: 'PRUNE',
                    recordsDeleted: deletedCount,
                    cutoffDate: cutoff,
                    metadata: {
                        strategy: result.strategyName,
                        tableName: tableName,
                        requestedAt: new Date(),
                        secure_mode: true,
                        token_verified: true,
                    },
                },
            });

            return {
                deletedCount,
                message: `SECURE PRUNE SUCCESS: ${deletedCount} data ${entityType} berhasil dihapus permanen.`,
            };

        } catch (error) {
            this.logger.error(`Pruning Execution Failed: ${error.message}`);
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException(`Gagal mengeksekusi strategi retensi: ${error.message}`);
        }
    }

    // --- HELPER METHODS ---

    private formatBytes(bytes: number, decimals = 2): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals < 0 ? 0 : decimals)) + ' ' + sizes[i];
    }
}