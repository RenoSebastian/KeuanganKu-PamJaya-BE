import { IsEnum, IsDateString, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RetentionEntityType } from './export-query.dto';
import { Expose } from 'class-transformer';

export class PruneExecutionDto {
    // =========================================================
    // INPUT FIELDS (Validation for Controller Request)
    // =========================================================

    @ApiProperty({
        enum: RetentionEntityType,
        description: 'Target data entitas yang akan dimusnahkan secara permanen.',
        example: 'FINANCIAL_CHECKUP',
    })
    @IsEnum(RetentionEntityType, {
        message: 'Entity Type tidak valid. Pilih entitas yang tersedia.',
    })
    @IsNotEmpty()
    entityType: string;

    @ApiProperty({
        description: 'Batas tanggal penghapusan (Format YYYY-MM-DD). Data sebelum tanggal ini akan dihapus.',
        example: '2025-12-31',
    })
    @IsDateString({}, { message: 'Format tanggal harus YYYY-MM-DD (ISO 8601).' })
    @IsNotEmpty()
    cutoffDate: string;

    @ApiProperty({
        description: 'Security Token (HMAC) yang didapat dari dalam footer file hasil export (property: security.pruneToken). Token ini membuktikan bahwa data telah sukses diamankan.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.Et9LQ9...',
    })
    @IsString()
    @IsNotEmpty({
        message: 'SECURITY BLOCKED: Token Prune wajib disertakan. Anda harus melakukan export data terlebih dahulu dan menyalin token dari file hasil export.'
    })
    pruneToken: string;

    // =========================================================
    // OUTPUT FIELDS (Result from Strategy Implementation)
    // [FIX] Menambahkan properti ini untuk mengatasi Error TypeScript 2353
    // =========================================================

    @ApiProperty({ description: 'Nama strategi yang dieksekusi', required: false })
    @Expose()
    @IsOptional()
    strategyName?: string;

    @ApiProperty({ description: 'Tabel target penghapusan', required: false })
    @Expose()
    @IsOptional()
    targetTable?: string;

    @ApiProperty({ description: 'Jumlah data yang dihapus/akan dihapus', required: false })
    @Expose()
    @IsOptional()
    recordsToPrune?: number;

    @ApiProperty({ description: 'Status eksekusi', required: false })
    @Expose()
    @IsOptional()
    status?: 'SUCCESS' | 'FAILED' | 'DRY_RUN';

    @ApiProperty({ description: 'Waktu eksekusi', required: false })
    @Expose()
    @IsOptional()
    executedAt?: Date;
}