import { Type } from 'class-transformer';
import {
    IsArray,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
    MaxLength,
    Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO untuk Detail Section (Atomic Content)
 * Digunakan di dalam array sections pada CreateModuleDto
 */
export class CreateSectionDto {
    @ApiProperty({ description: 'Urutan section/halaman', example: 1 })
    @IsInt()
    @Min(1)
    sectionOrder: number;

    @ApiPropertyOptional({ description: 'Judul sub-bab/halaman', example: 'Pengenalan Budgeting' })
    @IsString()
    @IsOptional()
    @MaxLength(150)
    title?: string;

    @ApiProperty({ description: 'Konten materi dalam format Markdown', example: '# Judul \n Isi materi...' })
    @IsString()
    @IsNotEmpty()
    contentMarkdown: string;

    /**
     * [LOGIC CHANGE]
     * Sebelumnya: @IsUrl() -> Gagal jika input path lokal atau string kosong.
     * Sekarang: @IsString() + Regex Path Validation.
     * Menerima format: 'uploads/uuid-filename.ext'.
     * Field ini optional, jika tidak ada gambar, FE tidak perlu mengirim field ini.
     */
    @ApiPropertyOptional({ description: 'Path gambar ilustrasi (Relative Path)', example: 'uploads/f47ac10b-58cc.jpg' })
    @IsString()
    @IsOptional()
    @Matches(/^uploads\//, {
        message: 'Illustration URL must be a valid relative path starting with "uploads/"'
    })
    illustrationUrl?: string;
}

/**
 * DTO Utama untuk Pembuatan Modul
 */
export class CreateModuleDto {
    @ApiProperty({ description: 'Judul Modul Pembelajaran', example: 'Dasar Perencanaan Keuangan' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    title: string;

    @ApiProperty({ description: 'ID Kategori (UUID)', example: '123e4567-e89b-12d3-a456-426614174000' })
    @IsUUID()
    @IsNotEmpty()
    categoryId: string;

    /**
     * [LOGIC CHANGE]
     * Validation Gatekeeper yang diperbaiki.
     * Memastikan data yang masuk adalah referensi file yang valid di server kita.
     */
    @ApiProperty({ description: 'Cover Image Path (Relative)', example: 'uploads/cover-image.jpg' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^uploads\//, {
        message: 'Thumbnail URL must be a valid relative path starting with "uploads/"'
    })
    thumbnailUrl: string;

    @ApiProperty({ description: 'Ringkasan singkat modul', example: 'Belajar cara mengatur gaji...' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(300, { message: 'Excerpt is too long (max 300 chars)' })
    excerpt: string;

    @ApiProperty({ description: 'Estimasi waktu baca dalam menit', example: 5 })
    @IsInt()
    @Min(1)
    readingTime: number;

    @ApiProperty({ type: [CreateSectionDto], description: 'Daftar halaman/section materi' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSectionDto)
    sections: CreateSectionDto[];
}