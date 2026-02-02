import { Module } from '@nestjs/common';
import { MediaController } from './controllers/media.controller';
import { MediaStorageService } from './services/media-storage.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule], // Import ConfigModule jika nanti butuh ENV (misal limit size dinamis)
    controllers: [MediaController],
    providers: [MediaStorageService],
    exports: [MediaStorageService], // Export service agar bisa dipanggil oleh EducationModule (untuk cleanup nanti)
})
export class MediaModule { }