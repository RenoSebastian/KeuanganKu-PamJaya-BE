import { PartialType } from '@nestjs/swagger';
import { CreateUnitDto } from './create-unit.dto';

// Secara arsitektur, PartialType dari @nestjs/swagger sudah mewarisi 
// seluruh aturan validasi (IsString) dan transformasi (@Transform) dari CreateUnitDto,
// lalu menerapkan @IsOptional() secara dinamis pada semua propertinya.
// Tidak perlu ada override tambahan selama business logic update sama persis dengan create.
export class UpdateUnitDto extends PartialType(CreateUnitDto) { }