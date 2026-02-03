import {
    Injectable,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { Prisma } from '@prisma/client';

/**
 * Service untuk mengelola Business Logic Kategori Edukasi.
 * Mengimplementasikan pemisahan tanggung jawab (Separation of Concerns) dari Controller.
 */
@Injectable()
export class EducationCategoryService {
    private readonly logger = new Logger(EducationCategoryService.name);

    constructor(private readonly prisma: PrismaService) { }

    // --- CREATE ---

    async create(dto: CreateCategoryDto) {
        try {
            const category = await this.prisma.educationCategory.create({
                data: {
                    name: dto.name,
                    description: dto.description,
                },
            });

            this.logger.log(`Category created: ${category.name} (${category.id})`);
            return category;
        } catch (error) {
            // Menangani Error Unik (P2002) - Nama Kategori Duplikat
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    throw new ConflictException(`Category with name "${dto.name}" already exists.`);
                }
            }
            this.logger.error(`Failed to create category: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Failed to create education category.');
        }
    }

    // --- READ (LIST) ---

    async findAll() {
        // [OPTIMIZATION] Mengambil count modules untuk indikator di Dashboard Admin
        // Admin bisa melihat kategori mana yang "gemuk" (banyak konten) atau "kosong".
        return this.prisma.educationCategory.findMany({
            include: {
                _count: {
                    select: { modules: true },
                },
            },
            orderBy: {
                name: 'asc',
            },
        });
    }

    // --- READ (DETAIL) ---

    async findOne(id: string) {
        const category = await this.prisma.educationCategory.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { modules: true },
                },
            },
        });

        if (!category) {
            throw new NotFoundException(`Education Category with ID ${id} not found.`);
        }

        return category;
    }

    // --- UPDATE ---

    async update(id: string, dto: UpdateCategoryDto) {
        // Cek eksistensi sebelum update untuk pesan error yang lebih jelas (404 vs 500)
        await this.findOne(id);

        try {
            const updatedCategory = await this.prisma.educationCategory.update({
                where: { id },
                data: {
                    name: dto.name,
                    description: dto.description,
                },
            });

            this.logger.log(`Category updated: ${updatedCategory.id}`);
            return updatedCategory;
        } catch (error) {
            // Handle Unique Constraint saat Update nama
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    throw new ConflictException(`Category name "${dto.name}" is already taken.`);
                }
            }
            this.logger.error(`Failed to update category ${id}: ${error.message}`);
            throw new InternalServerErrorException('Failed to update category.');
        }
    }

    // --- DELETE (CRITICAL INTEGRITY LOGIC) ---

    /**
     * Menghapus kategori dengan pemeriksaan Integritas Referensial yang ketat.
     * Mencegah penghapusan jika kategori sedang digunakan oleh Modul Ajar (RESTRICT).
     */
    async remove(id: string) {
        // 1. Pre-Check Eksistensi
        await this.findOne(id);

        try {
            // 2. Attempt Delete
            await this.prisma.educationCategory.delete({
                where: { id },
            });

            this.logger.log(`Category deleted successfully: ${id}`);
            return { message: 'Category deleted successfully.' };

        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                // [CRITICAL CHECK] P2003: Foreign Key Constraint Failed
                // Ini terjadi karena di Schema Prisma relasi EducationModule -> Category
                // diset (atau default) sebagai RESTRICT/NO ACTION, bukan CASCADE.
                // Ini perilaku yang DIINGINKAN untuk Master Data.
                if (error.code === 'P2003') {
                    this.logger.warn(`Integrity Violation: Attempt to delete used category ${id}`);
                    throw new ConflictException(
                        'Cannot delete this category because it is currently assigned to one or more Education Modules. Please reassign or delete the modules first.'
                    );
                }
            }

            this.logger.error(`Failed to delete category ${id}: ${error.message}`);
            throw new InternalServerErrorException('An unexpected error occurred while deleting the category.');
        }
    }
}