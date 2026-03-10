import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegisterDto, LoginDto, ChangeInitialPasswordDto } from './dto/auth.dto';
import * as argon from 'argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) { }

  // --- REGISTER (Self-Service) ---
  async register(dto: RegisterDto) {
    const hash = await argon.hash(dto.password);
    const targetKodeUnit = dto.unitKerjaId || 'IT-01';

    const unitKerja = await this.prisma.unitKerja.findUnique({
      where: { kodeUnit: targetKodeUnit },
    });

    if (!unitKerja) {
      throw new NotFoundException(`Unit Kerja dengan kode '${targetKodeUnit}' tidak ditemukan di sistem.`);
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          nip: dto.nip,
          email: dto.email,
          fullName: dto.fullName,
          passwordHash: hash,
          unitKerjaId: unitKerja.id,
          dateOfBirth: new Date(),
          role: 'USER',
          // [FIX] Karena ini registrasi mandiri, bukan buatan admin/sistem,
          // user sudah tahu sandinya. Kita set false agar tidak terblokir guard.
          isFirstLogin: false,
        },
      });

      return this.signToken(user.id, user.email, user.role, user.unitKerjaId);

    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('NIP atau Email sudah terdaftar');
        }
      }
      throw error;
    }
  }

  // --- LOGIN ---
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new ForbiddenException('Kredensial salah (Email tidak ditemukan)');

    const pwMatches = await argon.verify(user.passwordHash, dto.password);
    if (!pwMatches) throw new ForbiddenException('Kredensial salah (Password salah)');

    // [NEW FASE 2] First Login Guard
    // Mencegat user buatan Admin (Bulk Import) untuk mengganti sandi default-nya
    if (user.isFirstLogin) {
      return {
        requirePasswordChange: true,
        userId: user.id,
        email: user.email,
        message: 'Anda menggunakan kata sandi default. Silakan ubah kata sandi Anda untuk melanjutkan.'
      };
    }

    // Jika aman, kembalikan token normal
    return this.signToken(user.id, user.email, user.role, user.unitKerjaId);
  }

  // --- [NEW FASE 2] CHANGE INITIAL PASSWORD ---
  async changeInitialPassword(dto: ChangeInitialPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) throw new NotFoundException('Pengguna tidak ditemukan');

    // Validasi tambahan: Metode ini hanya boleh diakses oleh user yang berstatus First Login
    if (!user.isFirstLogin) {
      throw new BadRequestException('Akun ini sudah pernah mengubah kata sandi awal.');
    }

    const pwMatches = await argon.verify(user.passwordHash, dto.oldPassword);
    if (!pwMatches) throw new ForbiddenException('Kata sandi lama (default) tidak cocok');

    const newHash = await argon.hash(dto.newPassword);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        isFirstLogin: false, // Cabut status flag First Login
      },
    });

    // UX Optimization: Langsung login-kan user dan berikan token
    return this.signToken(updatedUser.id, updatedUser.email, updatedUser.role, updatedUser.unitKerjaId);
  }

  // --- HELPER: SIGN TOKEN ---
  async signToken(userId: string, email: string, role: string, unitKerjaId: string) {
    const payload = {
      sub: userId,
      email,
      role,
      unitKerjaId
    };

    const secret = this.config.get('JWT_SECRET');

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '1d',
      secret: secret,
    });

    return {
      access_token: token,
      user: {
        id: userId,
        email,
        role,
        unitKerjaId
      }
    };
  }
}