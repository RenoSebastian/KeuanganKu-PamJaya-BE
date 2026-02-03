import { IsNotEmpty, IsString, MaxLength, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Data Transfer Object untuk pembuatan Kategori Edukasi baru.
 * Berfungsi sebagai kontrak input dan lapisan validasi pertama.
 */
export class CreateCategoryDto {
    @ApiProperty({
        description: 'Nama kategori yang unik. Digunakan sebagai pengelompokan utama modul ajar.',
        example: 'Investasi Saham',
        minLength: 3,
        maxLength: 50,
    })
    @IsString({ message: 'Nama kategori harus berupa string.' })
    @IsNotEmpty({ message: 'Nama kategori tidak boleh kosong.' })
    @MinLength(3, { message: 'Nama kategori minimal 3 karakter.' })
    @MaxLength(50, { message: 'Nama kategori maksimal 50 karakter.' })
    @Transform(({ value }) => value?.trim()) // [Sanitasi] Hapus spasi di awal/akhir untuk mencegah duplikasi "Semu" (e.g. " A" vs "A")
    name: string;

    @ApiProperty({
        description: 'Deskripsi singkat mengenai cakupan materi dalam kategori ini.',
        example: 'Panduan lengkap mengenai analisis fundamental dan teknikal saham.',
        required: false,
        maxLength: 255,
    })
    @IsString({ message: 'Deskripsi harus berupa string.' })
    @IsOptional() // Field ini opsional
    @MaxLength(255, { message: 'Deskripsi maksimal 255 karakter.' })
    @Transform(({ value }) => value?.trim())
    description?: string;
}