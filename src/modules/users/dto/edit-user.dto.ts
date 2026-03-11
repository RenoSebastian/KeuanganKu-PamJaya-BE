import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class EditUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string; // [FIX] Field Avatar Base64

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  dependentCount?: number; // [FIX] Jumlah Tanggungan

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateOfBirth?: string; // [FIX] Tanggal Lahir (String dari input type="date")

  // =================================================================
  // [NEW] PHASE 1 & 2: ADDITIONAL PROFILE FIELDS
  // =================================================================

  @ApiPropertyOptional({ description: 'Jenis Kelamin (Laki-laki / Perempuan)' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Alamat Domisili Lengkap' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Nama Perusahaan Agen (e.g. PT Asuransi X)' })
  @IsOptional()
  @IsString()
  agencyName?: string;

  @ApiPropertyOptional({ description: 'Jabatan Agen (e.g. Senior Agent, Manager)' })
  @IsOptional()
  @IsString()
  agentLevel?: string;

  @ApiPropertyOptional({ description: 'Nama Perusahaan Induk (e.g. PT Asuransi Allianz Life)' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ description: 'Tujuan atau Goals User (Free Text)' })
  @IsOptional()
  @IsString()
  goals?: string;

  // =================================================================
  // [NEW] PATCH UPDATE STRUKTURAL & KONTAK
  // =================================================================

  @ApiPropertyOptional({ description: 'Nomor WhatsApp' })
  @IsOptional()
  @IsString()
  noWa?: string; // [FIX] Menambal kebocoran data (Data Loss) dari FE

  @ApiPropertyOptional({ description: 'Nomor Pokok Pegawai' })
  @IsOptional()
  @IsString()
  nip?: string;

  @ApiPropertyOptional({ description: 'Posisi/Jabatan (String deskriptif)' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ description: 'ID Referensi Unit Kerja' })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === '' ? undefined : value)) // [PROTECTED VARIATIONS] Mencegah Prisma Error P2003
  unitKerjaId?: string;
}