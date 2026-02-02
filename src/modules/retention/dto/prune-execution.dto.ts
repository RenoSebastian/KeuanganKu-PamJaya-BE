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
    // [FIX] Updated Contract: Menambahkan field message & recordsDeleted
    // =========================================================

    @ApiProperty({ description: 'Nama strategi yang dieksekusi', required: false })
    @Expose()
    @IsOptional()
    strategyName?: string;

    @ApiProperty({ description: 'Tabel target penghapusan', required: false })
    @Expose()
    @IsOptional()
    targetTable?: string;

    @ApiProperty({ description: 'Jumlah data yang sukses dihapus permanen', required: false })
    @Expose()
    @IsOptional()
    recordsDeleted?: number; // [NEW] Field standar untuk hasil eksekusi delete

    @ApiProperty({ description: 'Estimasi jumlah data yang akan dihapus (Mode Dry Run)', required: false })
    @Expose()
    @IsOptional()
    recordsToPrune?: number; // [LEGACY] Tetap disimpan untuk backward compatibility strategi lama

    @ApiProperty({ description: 'Status eksekusi', required: false })
    @Expose()
    @IsOptional()
    status?: 'SUCCESS' | 'FAILED' | 'DRY_RUN';

    @ApiProperty({ description: 'Pesan detail hasil eksekusi (Success/Error message)', required: false })
    @Expose()
    @IsOptional()
    message?: string; // [NEW] Field kritikal untuk logging pesan error/sukses dari Strategy

    @ApiProperty({ description: 'Waktu eksekusi', required: false })
    @Expose()
    @IsOptional()
    executedAt?: Date;
}