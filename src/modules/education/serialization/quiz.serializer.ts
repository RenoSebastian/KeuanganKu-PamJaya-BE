import { Exclude, Expose, Type } from 'class-transformer';
import { QuizQuestionType } from '@prisma/client';

// --- OPTION SERIALIZERS (Strictly Public) ---

export class PublicQuizOptionSerializer {
    @Expose() id: string;
    @Expose() optionText: string;

    // SECURITY NOTE: Field 'isCorrect' DIHAPUS TOTAL dari class ini.
    // Tidak ada cara bagi class-transformer untuk menyertakannya.

    constructor(partial: Partial<PublicQuizOptionSerializer>) {
        Object.assign(this, partial);
    }
}

// --- QUESTION SERIALIZERS ---

export class PublicQuizQuestionSerializer {
    @Expose() id: string;
    @Expose() questionText: string;
    @Expose() type: QuizQuestionType;
    @Expose() orderIndex: number;

    // Explanation disembunyikan saat ambil soal (Start Quiz)
    @Exclude() explanation: string | null;

    @Expose()
    @Type(() => PublicQuizOptionSerializer)
    options: PublicQuizOptionSerializer[];

    constructor(partial: Partial<PublicQuizQuestionSerializer>) {
        Object.assign(this, partial);
    }
}

// --- QUIZ HEADER SERIALIZERS ---

export class PublicQuizSerializer {
    @Expose() id: string;
    @Expose() timeLimit: number;
    @Expose() passingScore: number;
    @Expose() maxAttempts: number;
    @Expose() description: string | null;

    @Expose()
    @Type(() => PublicQuizQuestionSerializer)
    questions: PublicQuizQuestionSerializer[];

    constructor(partial: Partial<PublicQuizSerializer>) {
        Object.assign(this, partial);
    }
}

// --- SUBMISSION RESULT SERIALIZER ---

export class QuizSubmissionResult {
    @Expose() score: number;
    @Expose() isPassed: boolean;
    @Expose() attemptsUsed: number;
    @Expose() maxAttempts: number;
    @Expose() submittedAt: Date;
    @Expose() message: string;

    // [Optional] Jika Anda ingin mengirimkan kunci jawaban/pembahasan 
    // SETELAH user selesai mengerjakan, tambahkan field di sini.

    constructor(partial: Partial<QuizSubmissionResult>) {
        Object.assign(this, partial);
    }
}