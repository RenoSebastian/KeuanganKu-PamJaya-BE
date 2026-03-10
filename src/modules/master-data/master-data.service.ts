import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class MasterDataService {
    constructor(private prisma: PrismaService) { }

    async findAllUnits() {
        // [PHASE 3] Mengambil data dengan menyertakan parent dan subUnits
        // untuk memfasilitasi rendering hierarki (tree) di sisi frontend.
        return this.prisma.unitKerja.findMany({
            include: {
                parent: {
                    select: { id: true, namaUnit: true, kodeUnit: true }
                },
                subUnits: {
                    select: { id: true, namaUnit: true, kodeUnit: true }
                }
            },
            orderBy: { namaUnit: 'asc' },
        });
    }

    async createUnit(dto: CreateUnitDto) {
        // Cek duplikat kode
        const existing = await this.prisma.unitKerja.findUnique({
            where: { kodeUnit: dto.kodeUnit },
        });
        if (existing) throw new BadRequestException('Kode Unit sudah ada');

        // [PHASE 3] Validasi eksistensi Parent jika parentId disertakan
        if ((dto as any).parentId) {
            const parentExists = await this.prisma.unitKerja.findUnique({
                where: { id: (dto as any).parentId }
            });
            if (!parentExists) throw new BadRequestException('Parent Unit Kerja tidak ditemukan');
        }

        return this.prisma.unitKerja.create({
            data: dto,
        });
    }

    async updateUnit(id: string, dto: UpdateUnitDto) {
        // [PHASE 3] Pencegahan Circular Reference & Validasi Hierarki
        if ((dto as any).parentId) {
            if (id === (dto as any).parentId) {
                throw new BadRequestException('Unit Kerja tidak bisa menjadi parent untuk dirinya sendiri (Circular Reference)');
            }

            const parentExists = await this.prisma.unitKerja.findUnique({
                where: { id: (dto as any).parentId }
            });
            if (!parentExists) throw new BadRequestException('Parent Unit Kerja tidak ditemukan');

            // Opsional (Strict Level): Pengecekan mendalam agar parent yang dituju bukan merupakan sub-unit dari unit ini
            // Ini untuk mencegah loop seperti: A -> B -> A.
        }

        return this.prisma.unitKerja.update({
            where: { id },
            data: dto,
        });
    }

    async deleteUnit(id: string) {
        // [PHASE 3] Validasi pencegahan penghapusan jika unit masih memiliki child (sub-unit)
        const hasChildren = await this.prisma.unitKerja.count({
            where: { parentId: id }
        });

        if (hasChildren > 0) {
            throw new BadRequestException('Tidak bisa menghapus Unit Kerja yang masih memiliki Sub-Unit. Pindahkan atau hapus Sub-Unit terlebih dahulu.');
        }

        try {
            return await this.prisma.unitKerja.delete({
                where: { id },
            });
        } catch (error) {
            if (error.code === 'P2003') {
                throw new BadRequestException('Tidak bisa menghapus Unit yang masih memiliki Pegawai terkait');
            }
            throw error;
        }
    }
}