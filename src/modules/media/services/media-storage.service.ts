import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MediaStorageService {
    private readonly logger = new Logger(MediaStorageService.name);

    /**
     * [LOGICAL FIX] Penyesuaian Jalur Folder
     * Kita gunakan './uploads' (root) agar sinkron dengan:
     * 1. main.ts -> app.useStaticAssets
     * 2. app.module.ts -> ServeStaticModule
     */
    private readonly UPLOAD_DIR = './uploads';
    private readonly URL_PREFIX = 'uploads'; // Hilangkan '/' di depan untuk konsistensi DB

    constructor(private readonly configService: ConfigService) {
        this.ensureUploadDirectoryExists();
    }

    /**
     * Core Method: Upload File
     * Mengubah Binary Buffer menjadi Path String yang tersimpan di DB.
     */
    async uploadFile(file: Express.Multer.File): Promise<{ url: string; filename: string; mimeType: string }> {
        try {
            // 1. Generate Safe Filename (UUID + Original Extension)
            // Menghindari bentrok nama file dan karakter ilegal dari user
            const fileExt = path.extname(file.originalname).toLowerCase();
            const filename = `${uuidv4()}${fileExt}`;
            const filePath = path.join(this.UPLOAD_DIR, filename);

            // 2. Write File to Disk
            // Menggunakan fs.promises agar tidak blocking event loop (Asynchronous)
            await fs.promises.writeFile(filePath, file.buffer);

            // 3. Construct URL untuk Database
            // Hasilnya: "uploads/uuid-name.jpg"
            const dbPath = `${this.URL_PREFIX}/${filename}`;

            this.logger.log(`File persisted to disk: ${filename}`);

            return {
                url: dbPath,
                filename: filename,
                mimeType: file.mimetype,
            };
        } catch (error) {
            this.logger.error(`Failed to write file to storage: ${error.message}`);
            throw new InternalServerErrorException('Gagal menyimpan file ke media storage.');
        }
    }

    /**
     * Utility: Delete File
     * Digunakan saat menghapus Modul atau mengganti gambar agar tidak jadi 'zombie file'
     */
    async deleteFile(filename: string): Promise<void> {
        try {
            // Pastikan kita hanya mengambil nama filenya saja, bukan full path
            const pureFilename = path.basename(filename);
            const filePath = path.join(this.UPLOAD_DIR, pureFilename);

            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
                this.logger.log(`File deleted: ${pureFilename}`);
            }
        } catch (error) {
            this.logger.warn(`Cleanup failed for ${filename}: ${error.message}`);
        }
    }

    // --- INTERNAL HELPERS ---

    /**
     * Memastikan folder tujuan ada saat aplikasi startup.
     * Mencegah 'Error: ENOENT: no such file or directory' saat upload pertama kali.
     */
    private ensureUploadDirectoryExists() {
        const fullPath = path.resolve(this.UPLOAD_DIR);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            this.logger.log(`Infrastructure Ready. Upload directory created at: ${fullPath}`);
        }
    }
}