import {
    Controller,
    Get,
    Param,
    Post,
    Body,
    Query,
    UseGuards,
    UseInterceptors,
    ClassSerializerInterceptor,
    NotFoundException,
    HttpStatus
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery, ApiResponse, ApiParam } from '@nestjs/swagger';
import { EducationReadService } from '../services/education-read.service';
import { QuizEngineService } from '../services/quiz-engine.service';
import { SubmitQuizDto } from '../dto/submit-quiz.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { PublicQuizSerializer } from '../serialization/quiz.serializer';

@ApiTags('Education - Learning Portal')
@Controller('education')
@UseGuards(JwtAuthGuard) // Gate 1: Login Required
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor) // Gate 2: Data Sanitization (Anti-Leak)
export class PublicEducationController {
    constructor(
        private readonly readService: EducationReadService,
        private readonly quizService: QuizEngineService,
    ) { }

    @Get('categories')
    @ApiOperation({ summary: 'Get list of active learning categories' })
    getCategories() {
        return this.readService.getCategories();
    }

    @Get('modules')
    @ApiOperation({ summary: 'Browse learning modules (Paginated & Filtered)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'category', required: false, type: String })
    findAll(
        @GetUser('id') userId: string,
        @Query('page') page = 1,
        @Query('limit') limit = 10,
        @Query('category') categorySlug?: string,
    ) {
        return this.readService.findAllPublished(userId, {
            page: Number(page),
            limit: Number(limit),
            categorySlug,
        });
    }

    @Get('modules/:slug')
    @ApiOperation({ summary: 'Read full module content by Slug' })
    findOne(@GetUser('id') userId: string, @Param('slug') slug: string) {
        return this.readService.findOneBySlug(userId, slug);
    }

    /**
     * [ADDED] PROGRESS TRACKING ENDPOINT
     * Menangani update status membaca (STARTED/COMPLETED) dan checkpoint section.
     * Endpoint ini dipanggil oleh ReaderPage di Frontend.
     */
    @Post('modules/:slug/progress')
    @ApiOperation({ summary: 'Update learning progress (Checkpoint/Status)' })
    @ApiParam({ name: 'slug', description: 'Module Slug' })
    async updateProgress(
        @GetUser('id') userId: string,
        @Param('slug') slug: string,
        @Body() dto: any, // Anda bisa mengganti 'any' dengan UpdateProgressDto jika sudah dibuat
    ) {
        // 1. Cari module ID berdasarkan slug terlebih dahulu
        const module = await this.readService.findOneBySlug(userId, slug);
        if (!module) {
            throw new NotFoundException('Modul tidak ditemukan.');
        }

        // 2. Delegasikan update ke ReadService menggunakan ID asli
        return this.readService.updateProgress(userId, module.id, dto);
    }

    // --- QUIZ ENDPOINTS ---

    @Get('modules/:slug/quiz')
    @ApiOperation({
        summary: 'Start Quiz: Get questions (Safe Mode - No Answers)',
        description: 'Mengembalikan soal kuis tanpa kunci jawaban (Zero Leakage) menggunakan Serializer.'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        type: PublicQuizSerializer,
        description: 'Data kuis aman tanpa field isCorrect.'
    })
    async getQuiz(
        @GetUser('id') userId: string,
        @Param('slug') slug: string
    ): Promise<PublicQuizSerializer> {
        // 1. Fetch Raw Data dari Service
        const quiz = await this.quizService.getQuizByModuleSlug(userId, slug);

        if (!quiz) {
            throw new NotFoundException('Kuis tidak ditemukan untuk modul ini.');
        }

        // 2. [CRITICAL] Transform ke Serializer Class
        // Ini memicu logic @Exclude() pada field isCorrect dan explanation
        return new PublicQuizSerializer(quiz);
    }

    @Post('modules/:slug/quiz/submit')
    @ApiOperation({ summary: 'Submit Quiz Answers & Get Score' })
    submitQuiz(
        @GetUser('id') userId: string,
        @Param('slug') slug: string,
        @Body() dto: SubmitQuizDto,
    ) {
        return this.quizService.submitQuiz(userId, slug, dto);
    }
}