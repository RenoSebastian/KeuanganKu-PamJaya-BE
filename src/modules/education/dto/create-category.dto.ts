import { IsNotEmpty, IsString, MaxLength, IsOptional, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
    @ApiProperty({
        description: 'Nama kategori yang unik.',
        example: 'Investasi Saham',
        minLength: 3,
        maxLength: 50,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(50)
    @Transform(({ value }) => value?.trim())
    name: string;

    @ApiProperty({
        description: 'Deskripsi singkat kategori.',
        example: 'Panduan lengkap mengenai analisis saham.',
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(255)
    @Transform(({ value }) => value?.trim())
    description?: string;

    // [FIX] Menambahkan field iconUrl yang wajib ada di Schema
    @ApiProperty({
        description: 'URL/Path icon kategori (dari Media Upload).',
        example: 'uploads/icon-saham.png',
    })
    @IsString({ message: 'Icon URL harus berupa string path.' })
    @IsNotEmpty({ message: 'Icon URL wajib diisi.' })
    @Matches(/^\/?uploads\/[\w-]+\.(jpg|jpeg|png|svg|webp)$/i, {
        message: 'Icon URL harus valid (e.g. uploads/file.png) dan berupa gambar.',
    })
    iconUrl: string;
}