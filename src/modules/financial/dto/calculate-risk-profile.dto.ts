import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';

/**
 * Enum untuk membatasi jawaban hanya A, B, atau C.
 * Sesuai dengan dokumen BRD: A=1, B=2, C=3.
 */
export enum RiskAnswerOption {
    A = 'A',
    B = 'B',
    C = 'C',
}

export class CalculateRiskProfileDto {
    // --- IDENTITAS KLIEN (Untuk Header Laporan PDF) ---

    @ApiProperty({
        description: 'Nama lengkap klien/nasabah yang melakukan simulasi.',
        example: 'Budi Santoso',
    })
    @IsString()
    @IsNotEmpty({ message: 'Nama klien wajib diisi.' })
    clientName: string;

    @ApiProperty({
        description: 'Usia klien saat ini. Digunakan untuk konteks laporan.',
        example: 35,
        required: false,
    })
    @IsOptional()
    @IsInt()
    @Type(() => Number) // Memastikan konversi dari string query/body ke number aman
    @Min(0)
    @Max(120)
    clientAge?: number;

    // --- DATA KUESIONER ---

    @ApiProperty({
        description:
            'Array jawaban kuesioner. Wajib berisi tepat 10 jawaban (A/B/C). Urutan array sesuai urutan pertanyaan 1-10.',
        example: ['A', 'B', 'B', 'C', 'A', 'A', 'B', 'C', 'C', 'B'],
        isArray: true,
        enum: RiskAnswerOption,
    })
    @IsArray({ message: 'Format jawaban harus berupa array.' })
    @ArrayMinSize(10, { message: 'Kuesioner harus berisi tepat 10 jawaban.' })
    @ArrayMaxSize(10, { message: 'Kuesioner harus berisi tepat 10 jawaban.' })
    @IsEnum(RiskAnswerOption, {
        each: true,
        message: 'Jawaban hanya boleh bernilai A, B, atau C.',
    })
    // [LOGIC] Transformasi input menjadi Uppercase untuk menangani case sensitivity (ux-friendly)
    // Jika frontend mengirim ['a', 'b'], otomatis diubah jadi ['A', 'B'] sebelum validasi.
    @Transform(({ value }) => {
        if (Array.isArray(value)) {
            return value.map((v) => (typeof v === 'string' ? v.toUpperCase() : v));
        }
        return value;
    })
    answers: RiskAnswerOption[];
}