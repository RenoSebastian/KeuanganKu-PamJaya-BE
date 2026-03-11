import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2'; // [FIX FASE 1] Import Argon2
import { PrismaService } from '../../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { CreateUserDto } from './dto/create-user.dto';
import { EditUserDto } from './dto/edit-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
  ) { }

  // =================================================================
  // SELF-SERVICE (User Biasa)
  // =================================================================

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { unitKerja: true },
    });

    if (!user) throw new NotFoundException(`User not found`);

    const { passwordHash, ...result } = user;
    return result;
  }

  async editUser(userId: string, dto: EditUserDto) {
    this.logger.log(
      `User ${userId} editing self. Fields: ${Object.keys(dto).join(', ')}`,
    );
    return this.processUpdate(userId, dto);
  }

  // =================================================================
  // ADMIN FEATURES (Manajemen Pegawai)
  // =================================================================

  // 1. List Users (Search & Filter)
  async findAll(params: { search?: string; role?: Role }) {
    const { search, role } = params;
    const where: any = {};

    // Filter by Role
    if (role) {
      where.role = role;
    }

    // Filter by Search (Name / Email)
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        gender: true,
        address: true,
        agencyName: true,
        agentLevel: true,
        unitKerja: {
          select: {
            namaUnit: true
          }
        },
        createdAt: true,
      },
    });
  }

  // 2. Create User (Admin)
  async createUser(dto: CreateUserDto) {
    // Cek duplikat (Pre-condition logic)
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { nip: dto.nip }],
      },
    });

    if (existing) throw new BadRequestException('Email atau NIP sudah terdaftar');

    // [FIX FASE 1] Gunakan Argon2 untuk standarisasi kriptografi
    const hashedPassword = await argon2.hash(dto.password);

    // Destrukturisasi properti spesifik, sisanya masuk ke rest
    const { password, dateOfBirth, ...rest } = dto;

    const data: any = {
      ...rest,
      passwordHash: hashedPassword,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date('1990-01-01'),
      // [NEW FASE 1] Force Change Password Flag
      isFirstLogin: true,
    };

    try {
      const newUser = await this.prisma.user.create({ data });
      this.syncToSearch(newUser);

      const { passwordHash, ...result } = newUser;
      return result;
    } catch (error) {
      if (error.code === 'P2003') {
        throw new BadRequestException('Unit Kerja ID tidak valid');
      }
      this.logger.error(`Create user failed: ${error.message}`);
      throw error;
    }
  }

  // 3. Get Detail
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { unitKerja: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const { passwordHash, ...result } = user;
    return result;
  }

  // 4. Update User
  async updateUser(id: string, dto: UpdateUserDto) {
    return this.processUpdate(id, dto);
  }

  // 5. Delete User
  async deleteUser(id: string) {
    await this.findOne(id); // Memastikan eksistensi sebelum menghapus
    const deleted = await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully', id: deleted.id };
  }

  // =================================================================
  // HELPERS (Shared Logic)
  // =================================================================

  private async processUpdate(userId: string, dto: any) {
    try {
      const { password, dateOfBirth, dependentCount, ...restData } = dto;
      const updatePayload: any = {};

      // Iterasi dinamis ini akan secara otomatis memproses NIP, Position, 
      // UnitKerjaId, dan NoWa dari DTO baru yang telah kita siapkan.
      for (const [key, value] of Object.entries(restData)) {
        if (value !== undefined && value !== '') {
          updatePayload[key] = value;
        }
      }

      if (dependentCount !== undefined && dependentCount !== '') {
        updatePayload.dependentCount = Number(dependentCount);
      }

      if (dateOfBirth) {
        updatePayload.dateOfBirth = new Date(dateOfBirth);
      }

      if (password) {
        // [FIX FASE 1] Update password dengan Argon2
        updatePayload.passwordHash = await argon2.hash(password);
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updatePayload,
      });

      this.syncToSearch(updatedUser);

      const { passwordHash, ...result } = updatedUser;
      return result;
    } catch (error) {
      this.logger.error(`Failed update user ${userId}: ${error.message}`);
      if (error.code === 'P2025') throw new NotFoundException('User not found');
      if (error.code === 'P2003') throw new BadRequestException('Unit Kerja ID tidak valid');
      throw error;
    }
  }

  private async syncToSearch(user: any) {
    try {
      const searchPayload = {
        id: user.id,
        redirectId: user.id,
        type: 'PERSON',
        title: user.fullName,
        subtitle: user.email,
        role: user.role,
        unitKerjaId: user.unitKerjaId,

        agentLevel: user.agentLevel,
        agencyName: user.agencyName,
        address: user.address,
        gender: user.gender,
        companyName: user.companyName,
        goals: user.goals,

        // [NEW FASE 1] Memastikan pembaruan struktural terekam ke mesin pencari
        nip: user.nip,
        position: user.position,
      };

      this.searchService
        .addDocuments('global_search', [searchPayload])
        .catch((e) => this.logger.warn(`Search sync error: ${e.message}`));
    } catch (error) {
      this.logger.error(`Sync search failed: ${error.message}`);
    }
  }
}