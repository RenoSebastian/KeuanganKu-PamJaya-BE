import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { EducationModuleStatus, EducationProgressStatus, Prisma } from '@prisma/client';
import {
    ModuleListResponse,
    ModuleDetailResponse,
    CategorySerializer,
    ModuleSectionSerializer,
} from '../serialization/module.serializer';

@Injectable()
export class EducationReadService {
    constructor(private readonly prisma: PrismaService) { }

    // --- 1. GET MODULES LIST (Optimized) ---
    async findAllPublished(
        userId: string,
        query: { page: number; limit: number; categorySlug?: string },
    ) {
        const { page = 1, limit = 10, categorySlug } = query;
        const skip = (page - 1) * limit;

        const whereCondition: Prisma.EducationModuleWhereInput = {
            status: EducationModuleStatus.PUBLISHED,
            publishedAt: { lte: new Date() },
        };

        if (categorySlug) {
            whereCondition.category = { slug: categorySlug };
        }

        const [total, modules] = await this.prisma.$transaction([
            this.prisma.educationModule.count({ where: whereCondition }),
            this.prisma.educationModule.findMany({
                where: whereCondition,
                skip,
                take: limit,
                orderBy: { publishedAt: 'desc' },
                include: {
                    category: true,
                    userProgress: {
                        where: { userId },
                        select: { status: true },
                    },
                },
            }),
        ]);

        const data = modules.map((m) => {
            const progress = m.userProgress[0];

            return new ModuleListResponse({
                ...m,
                userStatus: progress ? progress.status : 'NOT_STARTED',
                category: new CategorySerializer(m.category),
            });
        });

        return {
            data,
            meta: {
                total,
                page,
                lastPage: Math.ceil(total / limit),
                limit,
            },
        };
    }

    // --- 2. GET MODULE DETAIL ---
    async findOneBySlug(userId: string, slug: string) {
        const module = await this.prisma.educationModule.findUnique({
            where: { slug },
            include: {
                category: true,
                sections: { orderBy: { sectionOrder: 'asc' } },
                userProgress: { where: { userId } },
            },
        });

        if (!module) {
            throw new NotFoundException('Learning module not found.');
        }

        const isPublished =
            module.status === EducationModuleStatus.PUBLISHED &&
            module.publishedAt &&
            module.publishedAt <= new Date();

        if (!isPublished) {
            throw new NotFoundException('Learning module not found or not available yet.');
        }

        const progressRecord = module.userProgress[0];

        return new ModuleDetailResponse({
            ...module,
            category: new CategorySerializer(module.category),
            sections: module.sections.map(
                (section) => new ModuleSectionSerializer(section),
            ),
            currentProgress: progressRecord
                ? {
                    status: progressRecord.status,
                    lastReadSectionId: progressRecord.lastReadSectionId,
                    completedAt: progressRecord.completedAt,
                }
                : null,
        });
    }

    // --- 3. GET CATEGORIES ---
    async getCategories() {
        const categories = await this.prisma.educationCategory.findMany({
            where: {
                isActive: true,
                modules: {
                    some: {
                        status: EducationModuleStatus.PUBLISHED,
                        publishedAt: { lte: new Date() },
                    },
                },
            },
            orderBy: { displayOrder: 'asc' },
        });

        return categories.map((c) => new CategorySerializer(c));
    }

    /**
     * [FIXED/ADDED] UPDATE PROGRESS
     * Menangani sinkronisasi progress membaca antara Frontend & Backend.
     */
    async updateProgress(
        userId: string,
        moduleId: string,
        dto: { status?: EducationProgressStatus; lastSectionId?: string }
    ) {
        // Gunakan upsert agar record otomatis dibuat jika user baru pertama kali membuka modul
        return this.prisma.userEducationProgress.upsert({
            where: {
                userId_moduleId: {
                    userId,
                    moduleId,
                },
            },
            update: {
                ...(dto.status && { status: dto.status }),
                ...(dto.lastSectionId && { lastReadSectionId: dto.lastSectionId }),
                // Jika status diubah menjadi COMPLETED, catat waktu selesainya
                ...(dto.status === EducationProgressStatus.COMPLETED && {
                    completedAt: new Date()
                }),
            },
            create: {
                userId,
                moduleId,
                status: dto.status || EducationProgressStatus.STARTED,
                lastReadSectionId: dto.lastSectionId,
                startedAt: new Date(),
            },
        });
    }

    // --- 4. ANTI-CHEAT QUIZ TIMER ---
    async markQuizStart(userId: string, moduleId: string) {
        const existingProgress =
            await this.prisma.userEducationProgress.findUnique({
                where: { userId_moduleId: { userId, moduleId } },
            });

        if (!existingProgress) {
            await this.prisma.userEducationProgress.create({
                data: {
                    userId,
                    moduleId,
                    status: EducationProgressStatus.STARTED,
                    startedAt: new Date(),
                    lastReadSectionId: null,
                },
            });
            return;
        }

        if (existingProgress.status === EducationProgressStatus.STARTED) {
            return; // Resume, DO NOT reset timer
        }

        if (existingProgress.status === EducationProgressStatus.COMPLETED) {
            await this.prisma.userEducationProgress.update({
                where: { userId_moduleId: { userId, moduleId } },
                data: {
                    status: EducationProgressStatus.STARTED,
                    startedAt: new Date(),
                },
            });
        }
    }
}