import { PartialType } from '@nestjs/swagger';
import { CreateModuleDto } from './create-module.dto';

/**
 * DTO untuk Update Modul
 * Menggunakan PartialType agar semua field menjadi opsional,
 * namun tetap membawa aturan validasi (Regex uploads/) dari parent-nya.
 */
export class UpdateModuleDto extends PartialType(CreateModuleDto) { }