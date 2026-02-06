import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsObject, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Enum Kategori Profil Risiko.
 */
export enum RiskProfileCategory {
    KONSERVATIF = 'Konservatif',
    MODERAT = 'Moderat',
    AGRESIF = 'Agresif',
}

/**
 * Struktur Data Alokasi Aset.
 */
export class RiskAllocationDto {
    @ApiProperty({ description: 'Persentase alokasi Low Risk (Pasar Uang/Deposito)', example: 20 })
    @IsNumber()
    lowRisk: number;

    @ApiProperty({ description: 'Persentase alokasi Medium Risk (Obligasi/Campuran)', example: 30 })
    @IsNumber()
    mediumRisk: number;

    @ApiProperty({ description: 'Persentase alokasi High Risk (Saham/Equity)', example: 50 })
    @IsNumber()
    highRisk: number;
}

/**
 * DTO Utama untuk Response & Export PDF.
 * [IMPORTANT] Validator decorators wajib ada agar data tidak di-strip oleh GlobalValidationPipe.
 */
export class RiskProfileResponseDto {
    // --- METADATA ---

    @ApiProperty({ description: 'Timestamp waktu simulasi dilakukan (ISO String)', example: '2025-11-20T10:00:00Z' })
    @IsString()
    // Bisa gunakan @IsDateString() jika formatnya strict ISO, tapi IsString lebih aman untuk payload general
    calculatedAt: string;

    @ApiProperty({ description: 'Nama klien', example: 'Budi Santoso' })
    @IsString()
    clientName: string;

    // --- HASIL KALKULASI ---

    @ApiProperty({ description: 'Total skor hasil penjumlahan bobot jawaban (10-30)', example: 24 })
    @IsNumber()
    totalScore: number;

    @ApiProperty({
        description: 'Kategori profil risiko hasil klasifikasi',
        enum: RiskProfileCategory,
        example: RiskProfileCategory.AGRESIF,
    })
    @IsEnum(RiskProfileCategory)
    riskProfile: RiskProfileCategory;

    @ApiProperty({
        description: 'Narasi penjelasan profil risiko untuk ditampilkan ke user',
        example: 'Anda siap menghadapi fluktuasi nilai investasi...',
    })
    @IsString()
    riskDescription: string;

    // --- REKOMENDASI ALOKASI ---

    @ApiProperty({
        description: 'Objek rekomendasi alokasi aset untuk visualisasi Pie Chart',
        type: RiskAllocationDto,
    })
    @IsObject()
    @ValidateNested()
    @Type(() => RiskAllocationDto) // Transformasi nested object agar tervalidasi
    allocation: RiskAllocationDto;
}