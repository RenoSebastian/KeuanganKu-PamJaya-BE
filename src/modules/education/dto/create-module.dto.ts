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
} from 'class-validator';

// DTO untuk Detail Section (Atomic Content)
export class CreateSectionDto {
    @IsInt()
    @Min(1)
    sectionOrder: number;

    @IsString()
    @IsOptional()
    @MaxLength(150)
    title?: string;

    @IsString()
    @IsNotEmpty()
    contentMarkdown: string;

    /**
     * [FIXED] Diubah menjadi IsOptional dan IsString biasa.
     * IsUrl dihapus agar bisa menerima path file lokal hasil upload dari device.
     */
    @IsString()
    @IsOptional()
    illustrationUrl?: string;
}

// DTO untuk Header Module
export class CreateModuleDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    title: string;

    @IsUUID()
    @IsNotEmpty()
    categoryId: string;

    /**
     * [FIXED] Thumbnail dari device akan menghasilkan path/URL string.
     */
    @IsString()
    @IsNotEmpty()
    thumbnailUrl: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(300, { message: 'Excerpt is too long (max 300 chars)' })
    excerpt: string;

    @IsInt()
    @Min(1)
    readingTime: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSectionDto)
    sections: CreateSectionDto[];
}