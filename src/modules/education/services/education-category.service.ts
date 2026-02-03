import {
    Injectable,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { Prisma } from '@prisma/client';
import slugify from 'slugify';

@Injectable()
export class EducationCategoryService {
    private readonly logger = new Logger(EducationCategoryService.name);

    constructor(private readonly prisma: PrismaService) { }

    // --- CREATE ---

    async create(dto: CreateCategoryDto) {
        // 1. Generate Slug dari Nama
        const slug = await this.generateUniqueSlug(dto.name);

        try {
            // 2. Masukkan slug dan iconUrl ke payload Prisma
            const category = await this.prisma.educationCategory.create({
                data: {
                    name: dto.name,
                    description: dto.description,
                    slug: slug,
                    iconUrl: dto.iconUrl,
                    isActive: true,
                },
            });

            this.logger.log(`Category created: ${category.name} (${category.id})`);
            return category;
        } catch (error) {
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
        return this.prisma.educationCategory.findMany({
            include: {
                _count: {
                    select: { modules: true },
                },
            },
            orderBy: {
                displayOrder: 'asc',
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
        await this.findOne(id);

        // [FIX] Explicitly type slug as string OR undefined to fix TS2322
        let slug: string | undefined;

        if (dto.name) {
            slug = await this.generateUniqueSlug(dto.name, id);
        }

        try {
            const updatedCategory = await this.prisma.educationCategory.update({
                where: { id },
                data: {
                    name: dto.name,
                    description: dto.description,
                    iconUrl: dto.iconUrl,
                    slug: slug, // Prisma will ignore if undefined
                },
            });

            this.logger.log(`Category updated: ${updatedCategory.id}`);
            return updatedCategory;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    throw new ConflictException(`Category name "${dto.name}" is already taken.`);
                }
            }
            this.logger.error(`Failed to update category ${id}: ${error.message}`);
            throw new InternalServerErrorException('Failed to update category.');
        }
    }

    // --- DELETE ---

    async remove(id: string) {
        await this.findOne(id);

        try {
            await this.prisma.educationCategory.delete({
                where: { id },
            });

            this.logger.log(`Category deleted successfully: ${id}`);
            return { message: 'Category deleted successfully.' };

        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2003') {
                    this.logger.warn(`Integrity Violation: Attempt to delete used category ${id}`);
                    throw new ConflictException(
                        'Cannot delete this category because it is currently assigned to one or more Education Modules.'
                    );
                }
            }
            this.logger.error(`Failed to delete category ${id}: ${error.message}`);
            throw new InternalServerErrorException('An unexpected error occurred while deleting the category.');
        }
    }

    // --- HELPER: Slug Generator ---

    private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
        const baseSlug = slugify(name, { lower: true, strict: true });
        let slug = baseSlug;
        let counter = 1;
        let isUnique = false;

        while (!isUnique) {
            // Cek apakah slug sudah ada
            const existing = await this.prisma.educationCategory.findUnique({
                where: { slug },
                select: { id: true }
            });

            // Jika tidak ada, atau ada tapi itu adalah diri sendiri (kasus update), maka aman
            if (!existing || (excludeId && existing.id === excludeId)) {
                isUnique = true;
            } else {
                counter++;
                slug = `${baseSlug}-${counter}`;
            }
        }
        return slug;
    }
}