import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

/**
 * Data Transfer Object untuk pembaruan (Update) Kategori Edukasi.
 * * Menggunakan PartialType untuk:
 * 1. Mewarisi semua properti dari CreateCategoryDto (name, description).
 * 2. Mengubah semua properti tersebut menjadi Optional (?).
 * 3. Tetap mempertahankan aturan validasi (misal: MinLength, IsString) jika properti tersebut dikirim.
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) { }