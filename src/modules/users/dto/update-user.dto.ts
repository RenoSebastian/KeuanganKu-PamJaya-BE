import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    // Override untuk menangani kasus string kosong "" dari frontend
    // Jika frontend mengirim "", ubah jadi undefined agar tidak diproses oleh Prisma
    @IsOptional()
    @IsUUID()
    @Transform(({ value }) => (value === '' ? undefined : value))
    unitKerjaId?: string;
}