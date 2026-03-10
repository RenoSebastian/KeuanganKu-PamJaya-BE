import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: '10203040' })
  @IsString()
  @IsNotEmpty()
  nip: string;

  @ApiProperty({ example: 'budi@pamjaya.co.id' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'RahasiaNegara123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'IT-001' })
  @IsString()
  @IsNotEmpty()
  unitKerjaId: string; // Nanti kita seed Unit Kerja dulu
}

export class LoginDto {
  @ApiProperty({ example: 'budi@pamjaya.co.id' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'RahasiaNegara123' })
  @IsString()
  @IsNotEmpty()
  password: string;

  // Jadikan Optional.
  // Jika dikirim, FE bisa kirim kode "IT-01", "FIN-01".
  // Jika tidak dikirim, Backend akan set ke default "IT-01" di logic handler-nya.
  @ApiProperty({ example: 'IT-01', required: false })
  @IsString()
  @IsOptional()
  unitKerjaId?: string;
}

// [NEW FASE 2] DTO untuk Endpoint Ganti Sandi Awal
export class ChangeInitialPasswordDto {
  @ApiProperty({ example: 'uuid-user-123' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'PamReno2904' })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({ example: 'RahasiaKuat123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password baru minimal 6 karakter' })
  newPassword: string;
}