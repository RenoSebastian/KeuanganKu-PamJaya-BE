import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { RetentionStrategyFactory } from '../strategies/retention-strategy.factory';
import { ExportQueryDto, RetentionEntityType } from '../dto/export-query.dto';
import { Response } from 'express'; // [FIX] Import Response type
import { createHmac } from 'crypto';

@Injectable()
export class ExportManagerService {
    private readonly logger = new Logger(ExportManagerService.name);

    // [SECURE] Harus sama persis dengan yang ada di RetentionService agar validasi token sukses
    private readonly HMAC_SECRET = process.env.RETENTION_SECRET || 'DO_NOT_USE_THIS_IN_PROD_SUPER_SECRET_KEY_99';

    constructor(
        private readonly prisma: PrismaService,
        private readonly strategyFactory: RetentionStrategyFactory,
    ) { }

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

    // [FIX] Method renamed to match Controller call & Updated signature to accept Response
    async exportDataStream(query: ExportQueryDto, res: Response): Promise<void> {
        const tableName = this.getTableName(query.entityType);

        if (!tableName) {
            throw new BadRequestException(`Table mapping not found for entity ${query.entityType}`);
        }

        this.logger.log(`Stream export initiated for ${query.entityType} (Table: ${tableName})...`);

        // 1. Fetch Data
        // Note: Untuk dataset sangat besar, idealnya menggunakan cursor-based streaming.
        // Namun untuk stabilitas queryRaw, kita fetch dulu lalu stream write.
        const data = await this.prisma.$queryRawUnsafe(
            `SELECT * FROM "${tableName}" WHERE created_at <= $1`,
            new Date(query.cutoffDate),
        );

        if (!Array.isArray(data) || data.length === 0) {
            // Throw sebelum header dikirim aman
            throw new BadRequestException('No data found to export for the given criteria.');
        }

        // 2. Prepare Response Headers (Trigger Download di Browser)
        const filename = `${query.entityType}_${query.cutoffDate}_${Date.now()}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // 3. Generate Security Token (Sync with RetentionService Logic)
        const pruneToken = this.generatePruneToken(query.entityType, query.cutoffDate);

        // 4. Construct & Stream Payload
        // Kita membungkus data dalam struktur JSON yang valid
        const exportStructure = {
            metadata: {
                entity: query.entityType,
                table: tableName,
                cutoffDate: query.cutoffDate,
                recordCount: data.length,
                exportedAt: new Date(),
            },
            security: {
                note: "Use this token to confirm permanent deletion (Prune)",
                pruneToken: pruneToken,
            },
            data: data,
        };

        // Write directly to HTTP Response stream
        res.write(JSON.stringify(exportStructure, null, 2));
        res.end();
    }

    // [SECURE] Token Generation Logic (Must Match RetentionService)
    private generatePruneToken(entityType: string, cutoffDate: string): string {
        const payload = JSON.stringify({ entityType, cutoffDate });
        const signature = createHmac('sha256', this.HMAC_SECRET)
            .update(payload)
            .digest('hex');
        // Return format: Base64Payload.Signature
        return `${Buffer.from(payload).toString('base64')}.${signature}`;
    }
}