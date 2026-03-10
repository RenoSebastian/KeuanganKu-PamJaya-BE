import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateUnitDto {
    @ApiProperty({ example: 'IT-DEV', description: 'Kode unik unit kerja' })
    @IsString()
    @IsNotEmpty()
    // Normalisasi implisit: memastikan format kode selalu konsisten (kapital dan tanpa spasi liar)
    @Transform(({ value }) => value?.toUpperCase().trim())
    kodeUnit: string;

    @ApiProperty({ example: 'Divisi Pengembangan TI', description: 'Nama unit kerja' })
    @IsString()
    @IsNotEmpty()
    // Sanitasi implisit: memotong spasi kosong di awal/akhir string
    @Transform(({ value }) => value?.trim())
    namaUnit: string;
}