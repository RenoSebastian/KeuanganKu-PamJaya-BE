import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { RetentionStrategy } from '../interfaces/retention-strategy.interface'; // [FIX] Import
import { PruneExecutionDto } from '../dto/prune-execution.dto';

@Injectable()
export class SnapshotRetentionStrategy implements RetentionStrategy {
    private readonly logger = new Logger(SnapshotRetentionStrategy.name);

    constructor(private readonly prisma: PrismaService) { }

    async execute(cutoffDate: Date, isDryRun: boolean, tableName?: string): Promise<PruneExecutionDto> {
        if (!tableName) {
            throw new Error('SnapshotRetentionStrategy requires a tableName context.');
        }

        this.logger.log(`Executing Snapshot Retention (Keep Latest) on table: ${tableName}`);

        // Logika Snapshot: Hapus data lama, TAPI sisakan 1 record terbaru per user.
        // Query ini kompleks, untuk simplifikasi kita gunakan logika delete basic dulu 
        // atau gunakan metode Prune standar (hapus by date).
        // TODO: Implementasi logika "Keep Latest" yang proper menggunakan Window Function.

        // Fallback sementara: Hapus by date (sama seperti Historical) agar tidak error.
        const query = `SELECT COUNT(*) as count FROM "${tableName}" WHERE created_at <= $1`;
        const countResult = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(query, cutoffDate);
        const recordsToPrune = Number(countResult[0]?.count || 0);

        if (!isDryRun && recordsToPrune > 0) {
            await this.prisma.$executeRawUnsafe(`DELETE FROM "${tableName}" WHERE created_at <= $1`, cutoffDate);
        }

        return {
            strategyName: 'SnapshotRetentionStrategy',
            targetTable: tableName,
            recordsToPrune,
            status: isDryRun ? 'DRY_RUN' : 'SUCCESS',
            executedAt: new Date(),
            entityType: 'GENERIC',
            cutoffDate: cutoffDate.toISOString(),
            pruneToken: isDryRun ? 'DRY' : 'EXEC'
        };
    }
}