import { PruneExecutionDto } from '../dto/prune-execution.dto';

export interface RetentionStrategy {
    /**
     * Eksekusi strategi retensi.
     * @param context (Optional) Nama tabel atau konteks tambahan untuk strategi generik.
     */
    execute(cutoffDate: Date, isDryRun: boolean, context?: string): Promise<PruneExecutionDto>;
}

export const RETENTION_STRATEGIES = {
    HISTORICAL: 'HISTORICAL_STRATEGY',
    SNAPSHOT: 'SNAPSHOT_STRATEGY',
    EDUCATION: 'EDUCATION_CLEANUP_STRATEGY',
};