import { IsArray, IsNotEmpty, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class QuizAnswerItem {
    @IsUUID()
    @IsNotEmpty()
    questionId: string;

    @IsUUID()
    @IsNotEmpty()
    selectedOptionId: string;
}

export class SubmitQuizDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => QuizAnswerItem)
    answers: QuizAnswerItem[];
}