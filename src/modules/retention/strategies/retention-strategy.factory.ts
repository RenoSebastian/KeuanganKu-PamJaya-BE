import { Injectable, BadRequestException } from '@nestjs/common';
import { HistoricalRetentionStrategy } from './historical-retention.strategy';
import { SnapshotRetentionStrategy } from './snapshot-retention.strategy';
import { RetentionStrategy } from '../interfaces/retention-strategy.interface'; // [FIX] Updated Import Name
import { EducationCleanupStrategy } from './education-cleanup.strategy';

@Injectable()
export class RetentionStrategyFactory {
    constructor(
        private readonly historicalStrategy: HistoricalRetentionStrategy,
        private readonly snapshotStrategy: SnapshotRetentionStrategy,
        private readonly educationStrategy: EducationCleanupStrategy,
    ) { }

    // [FIX] Return type changed to RetentionStrategy interface directly
    getStrategy(entityType: string): RetentionStrategy {
        switch (entityType) {
            // Kategori A: Historical Critical
            case 'FINANCIAL_CHECKUP':
                // Note: Pastikan HistoricalRetentionStrategy juga mengimplementasikan interface RetentionStrategy baru
                return this.historicalStrategy as unknown as RetentionStrategy;
            case 'PENSION':
                return this.historicalStrategy as unknown as RetentionStrategy;

            // Kategori B: Snapshot Only
            case 'GOAL':
                return this.snapshotStrategy as unknown as RetentionStrategy;
            case 'BUDGET':
                return this.snapshotStrategy as unknown as RetentionStrategy;
            case 'INSURANCE':
                return this.snapshotStrategy as unknown as RetentionStrategy;

            // Kategori C: Education Cleanup (NEW)
            case 'EDUCATION_CLEANUP':
                return this.educationStrategy;

            default:
                throw new BadRequestException(`Entity type '${entityType}' not supported for retention.`);
        }
    }
}