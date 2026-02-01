import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
    ArrayMinSize,
    Max,
} from 'class-validator';
import { QuizQuestionType } from '@prisma/client';

// 1. DTO untuk Opsi Jawaban
export class UpsertQuizOptionDto {
    @IsString()
    @IsNotEmpty()
    optionText: string;

    @IsBoolean()
    isCorrect: boolean;
}

// 2. DTO untuk Pertanyaan
export class UpsertQuizQuestionDto {
    @IsString()
    @IsNotEmpty()
    questionText: string;

    @IsEnum(QuizQuestionType)
    type: QuizQuestionType;

    @IsInt()
    @Min(1)
    orderIndex: number;

    @IsString()
    @IsOptional()
    explanation?: string; // Pembahasan soal (opsional)

    @IsArray()
    @ArrayMinSize(2, { message: 'A question must have at least 2 options.' })
    @ValidateNested({ each: true })
    @Type(() => UpsertQuizOptionDto)
    options: UpsertQuizOptionDto[];
}

// 3. DTO Utama (Quiz Header)
export class UpsertQuizDto {
    @IsInt()
    @Min(0)
    @Max(100)
    passingScore: number;

    @IsInt()
    @Min(0)
    timeLimit: number; // 0 = No Limit

    @IsInt()
    @Min(1)
    maxAttempts: number;

    @IsString()
    @IsOptional()
    description?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpsertQuizQuestionDto)
    questions: UpsertQuizQuestionDto[];
}