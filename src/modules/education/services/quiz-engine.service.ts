import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { EducationModuleStatus, EducationProgressStatus } from '@prisma/client';
import {
    PublicQuizSerializer,
    QuizSubmissionResult,
} from '../serialization/quiz.serializer';
import { SubmitQuizDto } from '../dto/submit-quiz.dto';

@Injectable()
export class QuizEngineService {
    private readonly logger = new Logger(QuizEngineService.name);

    constructor(private readonly prisma: PrismaService) { }

    // --- 1. GET QUIZ (Sanitized) ---

    async getQuizByModuleSlug(userId: string, slug: string) {
        const module = await this.prisma.educationModule.findUnique({
            where: { slug },
            include: {
                quiz: {
                    include: {
                        questions: {
                            orderBy: { orderIndex: 'asc' },
                            include: { options: true },
                        },
                    },
                },
            },
        });

        if (!module || !module.quiz) {
            throw new NotFoundException('Quiz not found or module does not exist.');
        }

        // Check Publication Status
        if (
            module.status !== EducationModuleStatus.PUBLISHED ||
            (module.publishedAt && module.publishedAt > new Date())
        ) {
            throw new ForbiddenException('This quiz is not available yet.');
        }

        // Return using Serializer (Strip answers)
        return new PublicQuizSerializer(module.quiz);
    }

    // --- 2. SUBMIT & SYNC LOGIC (Race Condition Fix) ---

    async submitQuiz(userId: string, slug: string, dto: SubmitQuizDto) {
        // A. Fetch Quiz & Master Key (Read-Only, Fast)
        const module = await this.prisma.educationModule.findUnique({
            where: { slug },
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
            throw new NotFoundException('Quiz reference not found.');
        }

        const quiz = module.quiz;

        // B. Server-Side Grading (In-Memory Calculation FIRST)
        // Kita hitung dulu nilainya sebelum menyentuh tabel UserProgress untuk mengurangi lock time
        let correctCount = 0;
        const totalQuestions = quiz.questions.length;
        const questionMap = new Map(quiz.questions.map((q) => [q.id, q]));

        for (const answer of dto.answers) {
            const question = questionMap.get(answer.questionId);
            // Validasi: Jika soal tidak ada di map (user kirim ID ngawur), skip.
            if (!question) continue;

            const correctOption = question.options.find((o) => o.isCorrect);

            // Match ID jawaban user dengan Kunci Jawaban DB
            if (correctOption && correctOption.id === answer.selectedOptionId) {
                correctCount++;
            }
        }

        const finalScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
        const isPassed = finalScore >= quiz.passingScore;

        // C. ATOMIC-LIKE UPDATE LOGIC
        // Sekarang baru kita sentuh state user.

        // 1. Get or Create Progress Record
        let progress = await this.prisma.userEducationProgress.findUnique({
            where: { userId_moduleId: { userId, moduleId: module.id } },
        });

        if (!progress) {
            progress = await this.prisma.userEducationProgress.create({
                data: { userId, moduleId: module.id, status: EducationProgressStatus.STARTED },
            });
        }

        // 2. Validate Max Attempts
        if (progress.quizAttempts >= quiz.maxAttempts) {
            throw new ForbiddenException(
                `You have reached the maximum number of attempts (${quiz.maxAttempts}).`,
            );
        }

        // 3. Prepare Update Data (High Score Logic)
        const newAttemptCount = progress.quizAttempts + 1;

        // CRITICAL FIX: Only update score if new score is higher.
        // Jika race condition terjadi dan request A (skor 90) & B (skor 60) masuk bersamaan,
        // Kita baca skor eksisting dari 'progress' yang baru di-fetch.
        const currentBestScore = progress.quizScore ?? 0;
        const scoreToSave = Math.max(finalScore, currentBestScore);

        const newStatus = isPassed ? EducationProgressStatus.COMPLETED : progress.status;
        const newCompletedAt = (isPassed && !progress.completedAt) ? new Date() : progress.completedAt;

        // 4. Update Database
        await this.prisma.userEducationProgress.update({
            where: { userId_moduleId: { userId, moduleId: module.id } },
            data: {
                quizAttempts: newAttemptCount,
                quizScore: scoreToSave, // Safe update
                isPassed: isPassed || progress.isPassed, // Once passed, always passed
                lastQuizDate: new Date(),
                status: newStatus,
                completedAt: newCompletedAt,
            },
        });

        this.logger.log(
            `User ${userId} submitted quiz for module ${slug}. Result: ${finalScore} (Best: ${scoreToSave})`,
        );

        return new QuizSubmissionResult({
            score: finalScore,
            isPassed,
            attemptsUsed: newAttemptCount,
            maxAttempts: quiz.maxAttempts,
            submittedAt: new Date(),
            message: isPassed
                ? 'Congratulations! You passed the quiz.'
                : `You scored ${finalScore}. Minimum passing score is ${quiz.passingScore}.`,
        });
    }
}