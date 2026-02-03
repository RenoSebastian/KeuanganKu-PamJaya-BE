import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';

// Controllers
import { AdminEducationController } from './controllers/admin-education.controller';
import { PublicEducationController } from './controllers/public-education.controller';

// Services
import { EducationManagementService } from './services/education-management.service';
import { EducationReadService } from './services/education-read.service';
import { QuizEngineService } from './services/quiz-engine.service'; // [NEW]

import { MediaModule } from '../media/media.module';

@Module({
    imports: [PrismaModule, MediaModule,],
    controllers: [
        AdminEducationController,
        PublicEducationController,
    ],
    providers: [
        EducationManagementService,
        EducationReadService,
        QuizEngineService, // [NEW] Register Provider
    ],
    exports: [
        EducationManagementService,
        EducationReadService,
        QuizEngineService, // Export jika modul lain butuh
    ],
})
export class EducationModule { }