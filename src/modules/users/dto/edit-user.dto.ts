import { IsOptional, IsString, IsNumber, IsDateString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
  // @IsDateString() // Opsional: Bisa diaktifkan jika format strict ISO
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
}