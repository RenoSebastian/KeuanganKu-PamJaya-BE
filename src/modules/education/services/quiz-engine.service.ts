import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SubmitQuizDto } from '../dto/submit-quiz.dto';
import { EducationReadService } from './education-read.service';
import { EducationModuleStatus, EducationProgressStatus } from '@prisma/client';
import {
    PublicQuizSerializer,
    QuizSubmissionResultSerializer,
} from '../serialization/quiz.serializer';

import { EDUCATION_CONSTANTS } from '../../../common/constants/education.constant';

@Injectable()
export class QuizEngineService {
    private readonly logger = new Logger(QuizEngineService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly readService: EducationReadService,
    ) { }

    // --- 1. GET QUIZ ---

    async getQuizByModuleSlug(userId: string, moduleSlug: string) {
        const module = await this.prisma.educationModule.findUnique({
            where: { slug: moduleSlug },
            include: {
                quiz: {
                    include: {
                        questions: {
                            orderBy: { orderIndex: 'asc' },
                            include: {
                                options: { select: { id: true, optionText: true, isCorrect: false } },
                            },
                        },
                    },
                },
            },
        });

        if (!module || !module.quiz) return null;

        if (
            module.status !== EducationModuleStatus.PUBLISHED ||
            (module.publishedAt && module.publishedAt > new Date())
        ) {
            throw new ForbiddenException(EDUCATION_CONSTANTS.ERRORS.NOT_PUBLISHED);
        }

        await this.readService.markQuizStart(userId, module.id);

        return {
            ...module.quiz,
            moduleId: module.id,
        };
    }

    // --- 2. SUBMIT & GRADING ---

    async submitQuiz(userId: string, moduleSlug: string, dto: SubmitQuizDto) {
        return this.prisma.$transaction(async (tx) => {

            const module = await tx.educationModule.findUnique({
                where: { slug: moduleSlug },
                include: {
                    quiz: {
                        include: {
                            questions: {
                                include: { options: true },
                            },
                        },
                    },
                },
            });

            if (!module || !module.quiz) {
                throw new NotFoundException(EDUCATION_CONSTANTS.ERRORS.QUIZ_NOT_FOUND);
            }

            const quiz = module.quiz;

            const progress = await tx.userEducationProgress.findUnique({
                where: { userId_moduleId: { userId, moduleId: module.id } },
            });

            // Guard 1: Session Valid?
            if (!progress || !progress.startedAt) {
                throw new BadRequestException(EDUCATION_CONSTANTS.ERRORS.SESSION_INVALID);
            }

            // Guard 2: Time Window Check (Anti-Cheat)
            if (quiz.timeLimit > 0) {
                const now = new Date();
                const startedAt = new Date(progress.startedAt);
                const timeElapsedMinutes = (now.getTime() - startedAt.getTime()) / 60000;

                // [CLEANUP] Menggunakan Constant Buffer
                const bufferMinutes = EDUCATION_CONSTANTS.QUIZ.SUBMISSION_BUFFER_MINUTES;

                if (timeElapsedMinutes > (quiz.timeLimit + bufferMinutes)) {
                    this.logger.warn(`User ${userId} timeout. Time: ${timeElapsedMinutes.toFixed(2)}m`);
                    throw new ForbiddenException(EDUCATION_CONSTANTS.ERRORS.TIMEOUT);
                }
            }

            // Guard 3: Max Attempts Check
            if (progress.quizAttempts >= quiz.maxAttempts) {
                throw new ForbiddenException(EDUCATION_CONSTANTS.ERRORS.MAX_ATTEMPTS);
            }

            // 3. Grading Logic
            let correctCount = 0;
            const totalQuestions = quiz.questions.length;
            const questionMap = new Map(quiz.questions.map((q) => [q.id, q]));

            for (const answer of dto.answers) {
                const question = questionMap.get(answer.questionId);
                if (!question) continue;

                const correctOption = question.options.find((o) => o.isCorrect);
                if (correctOption && correctOption.id === answer.selectedOptionId) {
                    correctCount++;
                }
            }

            // 4. Score Calculation
            const finalScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
            const isPassed = finalScore >= quiz.passingScore;

            // 5. Update Database
            const newAttemptCount = progress.quizAttempts + 1;
            const currentBestScore = progress.quizScore ?? 0;
            const scoreToSave = Math.max(finalScore, currentBestScore);

            const newStatus = isPassed ? EducationProgressStatus.COMPLETED : progress.status;
            const newCompletedAt = (isPassed && !progress.isPassed) ? new Date() : progress.completedAt;

            await tx.userEducationProgress.update({
                where: { userId_moduleId: { userId, moduleId: module.id } },
                data: {
                    quizAttempts: newAttemptCount,
                    quizScore: scoreToSave,
                    isPassed: isPassed || progress.isPassed,
                    lastQuizDate: new Date(),
                    status: newStatus,
                    completedAt: newCompletedAt,
                },
            });

            this.logger.log(
                `Quiz Commit: User ${userId} | Module ${moduleSlug} | Score ${finalScore}`
            );

            return new QuizSubmissionResultSerializer({
                score: finalScore,
                isPassed,
                attemptsUsed: newAttemptCount,
                maxAttempts: quiz.maxAttempts,
                submittedAt: new Date(),
                // [CLEANUP] Menggunakan Message Generator dari Constant
                message: isPassed
                    ? EDUCATION_CONSTANTS.MESSAGES.PASSED
                    : EDUCATION_CONSTANTS.MESSAGES.FAILED(finalScore, quiz.passingScore),
            });
        });
    }
}