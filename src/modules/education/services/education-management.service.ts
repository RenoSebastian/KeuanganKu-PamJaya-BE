import {
    BadRequestException,
    Injectable,
    NotFoundException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateModuleDto } from '../dto/create-module.dto';
import { UpdateModuleDto } from '../dto/update-module.dto';
import { UpdateModuleStatusDto } from '../dto/update-module-status.dto';
import { ReorderSectionsDto } from '../dto/reorder-sections.dto';
import { UpsertQuizDto } from '../dto/upsert-quiz.dto';
import { EducationModuleStatus } from '@prisma/client';
import { MediaStorageService } from '../../media/services/media-storage.service'; // [NEW] Import Service
import slugify from 'slugify';

@Injectable()
export class EducationManagementService {
    private readonly logger = new Logger(EducationManagementService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mediaService: MediaStorageService, // [NEW] Inject Media Service
    ) { }

    // --- CORE CRUD OPERATIONS ---

    /**
     * Membuat Modul Baru.
     * Payload gambar berupa String Path (Relative) yang sudah diupload sebelumnya.
     */
    async createModule(userId: string, dto: CreateModuleDto) {
        const { sections, ...moduleData } = dto;

        // 1. Validasi Kategori
        const categoryExists = await this.prisma.educationCategory.findUnique({
            where: { id: moduleData.categoryId },
        });
        if (!categoryExists) {
            throw new BadRequestException('Category ID invalid or not found.');
        }

        // 2. Generate Unique Slug
        const slug = await this.generateUniqueSlug(moduleData.title);

        // 3. Atomic Transaction (Header + Sections)
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                // A. Create Header
                const newModule = await tx.educationModule.create({
                    data: {
                        ...moduleData,
                        slug,
                        status: EducationModuleStatus.DRAFT, // Default selalu DRAFT
                        publishedAt: null,
                    },
                });

                // B. Create Sections
                if (sections && sections.length > 0) {
                    const sectionPayload = sections.map((s) => ({
                        moduleId: newModule.id,
                        sectionOrder: s.sectionOrder,
                        title: s.title,
                        contentMarkdown: s.contentMarkdown,
                        illustrationUrl: s.illustrationUrl, // Menyimpan path relatif
                    }));
                    await tx.moduleSection.createMany({ data: sectionPayload });
                }

                return newModule;
            });

            this.logger.log(`Module created: ${result.id} by User ${userId}`);
            return result;
        } catch (error) {
            this.logger.error(`Failed to create education module: ${error.message}`);
            throw new InternalServerErrorException('Transaction failed while creating module.');
        }
    }

    /**
     * Update Modul dengan mekanisme "Smart Garbage Collection" untuk file lama.
     */
    async updateModule(moduleId: string, dto: UpdateModuleDto) {
        // 1. Ambil data lama untuk perbandingan (Snapshot State Lama)
        const oldModule = await this.prisma.educationModule.findUnique({
            where: { id: moduleId },
            include: { sections: true },
        });

        if (!oldModule) {
            throw new NotFoundException(`Module with ID ${moduleId} not found`);
        }

        // 2. Lakukan Update Database terlebih dahulu (Optimistic)
        let updatedModule;
        try {
            updatedModule = await this.prisma.$transaction(async (tx) => {
                // Handle Slug Update jika Title berubah
                let newSlug = oldModule.slug;
                if (dto.title && dto.title !== oldModule.title) {
                    newSlug = await this.generateUniqueSlug(dto.title);
                }

                // Update Header Only
                // Note: Update Sections logic biasanya terpisah atau butuh nested upsert kompleks.
                // Di sini kita fokus update properti modul utama.
                return tx.educationModule.update({
                    where: { id: moduleId },
                    data: {
                        title: dto.title,
                        slug: newSlug,
                        categoryId: dto.categoryId,
                        thumbnailUrl: dto.thumbnailUrl,
                        excerpt: dto.excerpt,
                        readingTime: dto.readingTime,
                    },
                });
            });
        } catch (error) {
            this.logger.error(`Update failed for module ${moduleId}: ${error.message}`);
            throw new InternalServerErrorException('Database update failed.');
        }

        // 3. [GARBAGE COLLECTION] Hapus File Lama (Async Post-Action)
        // Hanya dijalankan jika transaksi DB sukses & path gambar berubah.
        if (dto.thumbnailUrl && oldModule.thumbnailUrl !== dto.thumbnailUrl) {
            this.logger.log(`Thumbnail changed for module ${moduleId}. Pruning old file...`);
            // Jangan await, biarkan berjalan di background agar respon API cepat
            this.mediaService.deleteFile(oldModule.thumbnailUrl);
        }

        return updatedModule;
    }

    async updateStatus(id: string, dto: UpdateModuleStatusDto) {
        const module = await this.prisma.educationModule.findUnique({
            where: { id },
            include: {
                sections: true,
                quiz: { include: { questions: true } },
            },
        });

        if (!module) throw new NotFoundException('Module not found');

        // --- LOGIC GUARDRAILS: PUBLISH SAFETY CHECK ---
        if (dto.status === EducationModuleStatus.PUBLISHED) {
            if (!module.sections || module.sections.length === 0) {
                throw new BadRequestException(
                    'Cannot PUBLISH a module with no sections (Empty Content). Please add content first.',
                );
            }

            if (module.quiz) {
                if (!module.quiz.questions || module.quiz.questions.length === 0) {
                    throw new BadRequestException(
                        'Cannot PUBLISH. This module has a Quiz enabled but contains NO questions.',
                    );
                }
            }
        }

        return this.prisma.educationModule.update({
            where: { id },
            data: {
                status: dto.status,
                publishedAt:
                    dto.status === EducationModuleStatus.PUBLISHED ? new Date() : module.publishedAt,
            },
        });
    }

    /**
     * Menghapus Modul dan SEMUA aset file terkait (Cascade Cleanup).
     */
    async deleteModule(moduleId: string) {
        // 1. Ambil data sebelum dihapus untuk mendapatkan daftar file
        const moduleToDelete = await this.prisma.educationModule.findUnique({
            where: { id: moduleId },
            include: { sections: true },
        });

        if (!moduleToDelete) {
            throw new NotFoundException('Modul tidak ditemukan');
        }

        // 2. Hapus Record Database (Cascade Delete akan menghapus sections & progress)
        try {
            await this.prisma.educationModule.delete({
                where: { id: moduleId },
            });
        } catch (error) {
            this.logger.error(`Delete failed DB: ${error.message}`);
            throw new InternalServerErrorException('Gagal menghapus data modul.');
        }

        // 3. [CLEANUP] Hapus Fisik File
        const filesToDelete: string[] = [];

        // Kumpulkan Cover Image
        if (moduleToDelete.thumbnailUrl) {
            filesToDelete.push(moduleToDelete.thumbnailUrl);
        }

        // Kumpulkan Ilustrasi setiap section
        if (moduleToDelete.sections) {
            moduleToDelete.sections.forEach((sec) => {
                if (sec.illustrationUrl) filesToDelete.push(sec.illustrationUrl);
            });
        }

        // Eksekusi Hapus Masal
        if (filesToDelete.length > 0) {
            this.logger.log(`Deleting ${filesToDelete.length} assets for module ${moduleId}`);
            // Gunakan Promise.all untuk paralel execution (Efisiensi I/O)
            // Error pada satu file tidak boleh menghentikan proses yang lain
            await Promise.allSettled(filesToDelete.map((path) => this.mediaService.deleteFile(path)));
        }

        return { message: 'Modul dan aset berhasil dihapus' };
    }

    async reorderSections(moduleId: string, dto: ReorderSectionsDto) {
        const module = await this.prisma.educationModule.findUnique({ where: { id: moduleId } });
        if (!module) throw new NotFoundException('Module not found');

        return this.prisma.$transaction(
            dto.items.map((item) =>
                this.prisma.moduleSection.update({
                    where: { id: item.sectionId, moduleId },
                    data: { sectionOrder: item.newOrder },
                }),
            ),
        );
    }

    // --- QUIZ MANAGEMENT LOGIC (Phase 3 Integration) ---

    async upsertQuiz(moduleId: string, dto: UpsertQuizDto) {
        // 1. Validate Parent Module
        const module = await this.prisma.educationModule.findUnique({ where: { id: moduleId } });
        if (!module) throw new NotFoundException('Module not found');

        // 2. Logic Guardrails
        if (!dto.questions || dto.questions.length === 0) {
            throw new BadRequestException('A quiz must contain at least one question.');
        }

        dto.questions.forEach((q, index) => {
            if (!q.options || q.options.length < 2) {
                throw new BadRequestException(
                    `Question #${index + 1} must have at least 2 options.`,
                );
            }
            const correctOptions = q.options.filter((opt) => opt.isCorrect);
            if (correctOptions.length !== 1) {
                throw new BadRequestException(
                    `Question #${index + 1} must have EXACTLY ONE correct option.`,
                );
            }
        });

        // 3. Transactional Replacement
        try {
            return await this.prisma.$transaction(async (tx) => {
                // A. Upsert Quiz Header
                const quiz = await tx.quiz.upsert({
                    where: { moduleId },
                    create: {
                        moduleId,
                        passingScore: dto.passingScore,
                        timeLimit: dto.timeLimit,
                        maxAttempts: dto.maxAttempts,
                        description: dto.description,
                    },
                    update: {
                        passingScore: dto.passingScore,
                        timeLimit: dto.timeLimit,
                        maxAttempts: dto.maxAttempts,
                        description: dto.description,
                    },
                });

                // B. Wipe Clean Questions
                await tx.quizQuestion.deleteMany({
                    where: { quizId: quiz.id },
                });

                // C. Bulk Insert New Questions
                for (const q of dto.questions) {
                    await tx.quizQuestion.create({
                        data: {
                            quizId: quiz.id,
                            questionText: q.questionText,
                            type: q.type,
                            orderIndex: q.orderIndex,
                            explanation: q.explanation,
                            options: {
                                createMany: {
                                    data: q.options.map((opt) => ({
                                        optionText: opt.optionText,
                                        isCorrect: opt.isCorrect,
                                    })),
                                },
                            },
                        },
                    });
                }

                return await tx.quiz.findUnique({
                    where: { id: quiz.id },
                    include: {
                        questions: {
                            include: { options: true },
                            orderBy: { orderIndex: 'asc' },
                        },
                    },
                });
            });
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            this.logger.error(`Failed to upsert quiz: ${error.message}`);
            throw new InternalServerErrorException('Transaction failed while saving quiz data.');
        }
    }

    // --- UTILITIES ---

    private async generateUniqueSlug(title: string): Promise<string> {
        const baseSlug = slugify(title, { lower: true, strict: true });
        let slug = baseSlug;
        let counter = 1;
        let isUnique = false;

        while (!isUnique) {
            const existing = await this.prisma.educationModule.findUnique({
                where: { slug },
            });

            if (!existing) {
                isUnique = true;
            } else {
                counter++;
                slug = `${baseSlug}-${counter}`;
            }
        }

        return slug;
    }
}