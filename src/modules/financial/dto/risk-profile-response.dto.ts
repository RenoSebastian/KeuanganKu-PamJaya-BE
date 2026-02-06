import { ApiProperty } from '@nestjs/swagger';

/**
 * Enum Kategori Profil Risiko.
 * Digunakan agar nilai return konsisten (tidak typo antara 'Konservatif' vs 'Conservative').
 */
export enum RiskProfileCategory {
    KONSERVATIF = 'Konservatif',
    MODERAT = 'Moderat',
    AGRESIF = 'Agresif',
}

/**
 * Struktur Data Alokasi Aset.
 * Merepresentasikan persentase (0-100) untuk Pie Chart.
 */
export class RiskAllocationDto {
    @ApiProperty({ description: 'Persentase alokasi Low Risk (Pasar Uang/Deposito)', example: 20 })
    lowRisk: number;

    @ApiProperty({ description: 'Persentase alokasi Medium Risk (Obligasi/Campuran)', example: 30 })
    mediumRisk: number;

    @ApiProperty({ description: 'Persentase alokasi High Risk (Saham/Equity)', example: 50 })
    highRisk: number;
}

/**
 * DTO Utama untuk Response Hasil Kalkulasi.
 * Struktur ini yang akan dibaca Frontend untuk ditampilkan dan disimpan ke .mgc
 */
export class RiskProfileResponseDto {
    // --- METADATA (Untuk Context) ---

    @ApiProperty({ description: 'Timestamp waktu simulasi dilakukan (ISO String)', example: '2025-11-20T10:00:00Z' })
    calculatedAt: string;

    @ApiProperty({ description: 'Nama klien (echo balik dari input)', example: 'Budi Santoso' })
    clientName: string;

    // --- HASIL KALKULASI ---

    @ApiProperty({ description: 'Total skor hasil penjumlahan bobot jawaban (10-30)', example: 24 })
    totalScore: number;

    @ApiProperty({
        description: 'Kategori profil risiko hasil klasifikasi',
        enum: RiskProfileCategory,
        example: RiskProfileCategory.AGRESIF,
    })
    riskProfile: RiskProfileCategory;

    @ApiProperty({
        description: 'Narasi penjelasan profil risiko untuk ditampilkan ke user',
        example: 'Anda siap menghadapi fluktuasi nilai investasi demi potensi hasil jangka panjang.',
    })
    riskDescription: string;

    // --- REKOMENDASI ALOKASI ---

    @ApiProperty({
        description: 'Objek rekomendasi alokasi aset untuk visualisasi Pie Chart',
        type: RiskAllocationDto,
    })
    allocation: RiskAllocationDto;
}