import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

/**
 * DTO untuk Update Kategori
 * -----------------------------------------------------------
 * Mewarisi validasi dari CreateCategoryDto:
 * - name: Min 3 chars
 * - iconUrl: Validasi Regex path uploads/
 *
 * Semua field bersifat optional untuk keperluan PATCH request.
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) { }