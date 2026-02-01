import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { RetentionStrategy } from '../interfaces/retention-strategy.interface'; // [FIX] Import
import { PruneExecutionDto } from '../dto/prune-execution.dto';

@Injectable()
export class HistoricalRetentionStrategy implements RetentionStrategy {
    private readonly logger = new Logger(HistoricalRetentionStrategy.name);

    constructor(private readonly prisma: PrismaService) { }

    // [FIX] Implement execute sesuai interface baru
    async execute(cutoffDate: Date, isDryRun: boolean, tableName?: string): Promise<PruneExecutionDto> {
        if (!tableName) {
            throw new Error('HistoricalRetentionStrategy requires a tableName context.');
        }

        this.logger.log(`Executing Historical Retention on table: ${tableName}`);

        // 1. Count Data
        // Note: Menggunakan raw query karena nama tabel dinamis
        const countQuery = `
      SELECT COUNT(*) as count 
      FROM "${tableName}" 
      WHERE created_at <= $1
    `;
        const countResult = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
            countQuery,
            cutoffDate
        );
        const recordsToPrune = Number(countResult[0]?.count || 0);

        if (isDryRun) {
            return {
                strategyName: 'HistoricalRetentionStrategy',
                targetTable: tableName,
                recordsToPrune,
                status: 'DRY_RUN',
                executedAt: new Date(),
                entityType: 'GENERIC', // Default props for DTO
                cutoffDate: cutoffDate.toISOString(),
                pruneToken: 'DRY_RUN_TOKEN'
            };
        }

        // 2. Delete Data
        if (recordsToPrune > 0) {
            const deleteQuery = `
        DELETE FROM "${tableName}" 
        WHERE created_at <= $1
      `;
            await this.prisma.$executeRawUnsafe(deleteQuery, cutoffDate);
        }

        return {
            strategyName: 'HistoricalRetentionStrategy',
            targetTable: tableName,
            recordsToPrune,
            status: 'SUCCESS',
            executedAt: new Date(),
            entityType: 'GENERIC',
            cutoffDate: cutoffDate.toISOString(),
            pruneToken: 'EXECUTED_TOKEN'
        };
    }
}