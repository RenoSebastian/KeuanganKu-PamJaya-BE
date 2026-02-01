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
import slugify from 'slugify';

@Injectable()
export class EducationManagementService {
    private readonly logger = new Logger(EducationManagementService.name);

    constructor(private readonly prisma: PrismaService) { }

    // --- CORE CRUD OPERATIONS ---

    async create(dto: CreateModuleDto) {
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
                        illustrationUrl: s.illustrationUrl,
                    }));
                    await tx.moduleSection.createMany({ data: sectionPayload });
                }

                return newModule;
            });

            return result;
        } catch (error) {
            this.logger.error(`Failed to create education module: ${error.message}`);
            throw new InternalServerErrorException('Transaction failed while creating module.');
        }
    }

    async update(id: string, dto: UpdateModuleDto) {
        // 1. Cek Eksistensi
        const existing = await this.prisma.educationModule.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Module not found');

        // 2. Handle Slug Update jika Title berubah
        let newSlug: string | undefined;
        if (dto.title && dto.title !== existing.title) {
            newSlug = await this.generateUniqueSlug(dto.title);
        }

        // 3. Update DB
        return this.prisma.educationModule.update({
            where: { id },
            data: {
                ...dto,
                slug: newSlug,
            },
        });
    }

    async updateStatus(id: string, dto: UpdateModuleStatusDto) {
        const module = await this.prisma.educationModule.findUnique({
            where: { id },
            include: {
                sections: true,
                quiz: { include: { questions: true } }, // Cek keberadaan quiz
            },
        });

        if (!module) throw new NotFoundException('Module not found');

        // --- LOGIC GUARDRAILS: PUBLISH SAFETY CHECK ---
        if (dto.status === EducationModuleStatus.PUBLISHED) {
            // 1. Check Content Existence
            if (!module.sections || module.sections.length === 0) {
                throw new BadRequestException(
                    'Cannot PUBLISH a module with no sections (Empty Content). Please add content first.',
                );
            }

            // 2. Check Quiz Integrity (Jika ada Quiz, wajib ada soal)
            if (module.quiz) {
                if (!module.quiz.questions || module.quiz.questions.length === 0) {
                    throw new BadRequestException(
                        'Cannot PUBLISH. This module has a Quiz enabled but contains NO questions. Please add questions or remove the quiz.',
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

    async delete(id: string) {
        const module = await this.prisma.educationModule.findUnique({ where: { id } });
        if (!module) throw new NotFoundException('Module not found');

        // Hard Delete: Karena Cascade delete aktif di Schema, sections & quiz otomatis terhapus.
        return this.prisma.educationModule.delete({
            where: { id },
        });
    }

    async reorderSections(moduleId: string, dto: ReorderSectionsDto) {
        const module = await this.prisma.educationModule.findUnique({ where: { id: moduleId } });
        if (!module) throw new NotFoundException('Module not found');

        // Transactional Reorder
        return this.prisma.$transaction(
            dto.items.map((item) =>
                this.prisma.moduleSection.update({
                    where: { id: item.sectionId, moduleId }, // Safety Check: Pastikan section milik module ini
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

        // 2. LOGIC GUARDRAILS (Validation Before Transaction)

        // Rule A: Ghost Quiz Prevention
        if (!dto.questions || dto.questions.length === 0) {
            throw new BadRequestException('A quiz must contain at least one question.');
        }

        dto.questions.forEach((q, index) => {
            // Rule B: Min Options
            if (!q.options || q.options.length < 2) {
                throw new BadRequestException(
                    `Question #${index + 1} ("${q.questionText.substring(0, 20)}...") must have at least 2 options.`,
                );
            }

            // Rule C: Single Truth (Must have exactly one correct answer)
            const correctOptions = q.options.filter((opt) => opt.isCorrect);
            if (correctOptions.length !== 1) {
                throw new BadRequestException(
                    `Question #${index + 1} must have EXACTLY ONE correct option. Found: ${correctOptions.length}.`,
                );
            }
        });

        // 3. Transactional Replacement
        try {
            return await this.prisma.$transaction(async (tx) => {
                // A. Upsert Quiz Header (Create if not exists, Update if exists)
                // Kita gunakan upsert agar ID quiz tetap persisten jika sudah ada
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

                // B. Wipe Clean: Delete Existing Questions (Cascade deletes options)
                // Ini lebih aman daripada diffing. Kita hapus semua soal lama milik quiz ini.
                await tx.quizQuestion.deleteMany({
                    where: { quizId: quiz.id },
                });

                // C. Bulk Insert New Questions & Options
                // Kita loop karena Prisma createMany belum support nested writes (options)
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

                // Return full structure for confirmation
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
            // Re-throw validation errors directly
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

        // Loop check keberadaan slug
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