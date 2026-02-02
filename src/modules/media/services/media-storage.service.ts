import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MediaStorageService implements OnModuleInit {
    private readonly logger = new Logger(MediaStorageService.name);

    // [CONFIGURATION]
    // Menggunakan strategi Local Storage di root folder './uploads'
    // Ini memisahkan file fisik dari source code (/src) dan build folder (/dist)
    private readonly UPLOAD_DIR = './uploads';

    // URL Prefix yang akan disimpan di database.
    // Frontend akan mengakses via: {BASE_URL}/uploads/{filename}
    private readonly URL_PREFIX = 'uploads';

    /**
     * Lifecycle Hook: Dijalankan otomatis saat modul diinisialisasi.
     * Memastikan folder upload tersedia sebelum ada request masuk.
     */
    onModuleInit() {
        this.ensureUploadDirectoryExists();
    }

    /**
     * Core Method: Upload File
     * Mengubah Binary Buffer dari Request menjadi File Fisik di Server.
     */
    async uploadFile(file: Express.Multer.File): Promise<{ url: string; filename: string; mimeType: string; size: number }> {
        try {
            // 1. Validasi Keberadaan File (Defensive Programming)
            if (!file) {
                throw new InternalServerErrorException('File object is empty.');
            }

            // 2. Generate Safe Filename
            // Format: {UUID-V4}{OriginalExtension}
            // Mencegah overwrite file dengan nama sama dan sanitasi karakter aneh dari user.
            const fileExt = path.extname(file.originalname).toLowerCase();
            const filename = `${uuidv4()}${fileExt}`;

            // Resolve absolute path untuk keamanan penulisan
            const filePath = path.join(this.getUploadPath(), filename);

            // 3. Write File to Disk (Asynchronous I/O)
            // Menggunakan fs.promises agar tidak memblokir Event Loop Node.js
            await fs.promises.writeFile(filePath, file.buffer);

            this.logger.log(`File persisted successfully: ${filename} (${file.size} bytes)`);

            // 4. Return Metadata
            // Mengembalikan path relatif agar database tidak terikat pada domain/host tertentu.
            // Format: "uploads/uuid-file.jpg"
            return {
                url: `${this.URL_PREFIX}/${filename}`,
                filename: filename,
                mimeType: file.mimetype,
                size: file.size,
            };

        } catch (error) {
            this.logger.error(`Failed to save file: ${error.message}`, error.stack);
            // Bungkus error internal agar tidak bocor detail sistem ke client
            throw new InternalServerErrorException('Gagal menyimpan file ke media storage server.');
        }
    }

    /**
     * Utility: Delete File
     * Menghapus file fisik. Penting untuk proses Cleanup/Retention agar server tidak penuh sampah.
     * Digunakan oleh EducationService saat Update (ganti gambar) atau Delete modul.
     */
    async deleteFile(relativePath: string): Promise<void> {
        if (!relativePath) return;

        try {
            // [SECURITY] Sanitasi input path untuk mencegah Path Traversal Attack (misal: ../../etc/passwd)
            // Kita memaksa hanya mengambil nama file terakhir dan menempelkannya ke folder upload resmi.
            const filename = path.basename(relativePath);
            const absolutePath = path.join(this.getUploadPath(), filename);

            // Cek eksistensi file sebelum menghapus untuk menghindari error ENOENT
            try {
                await fs.promises.access(absolutePath, fs.constants.F_OK);
                await fs.promises.unlink(absolutePath);
                this.logger.log(`File deleted successfully: ${filename}`);
            } catch (err) {
                // Jika file tidak ditemukan, kita log sebagai warning tapi tidak throw error.
                // Ini penting agar transaksi DB utama (misal: Delete Module) tidak rollback 
                // hanya karena file gambarnya sudah hilang duluan.
                this.logger.warn(`File not found for deletion or access denied: ${absolutePath}`);
            }
        } catch (error) {
            this.logger.error(`Cleanup failed for ${relativePath}: ${error.message}`);
            // Kita suppress error delete agar tidak mengganggu flow bisnis utama (Silent Fail)
        }
    }

    // --- INTERNAL HELPERS ---

    /**
     * Mengembalikan Absolute Path ke folder uploads.
     * Menggunakan process.cwd() untuk memastikan path benar dimanapun node dijalankan.
     */
    private getUploadPath(): string {
        return path.join(process.cwd(), this.UPLOAD_DIR);
    }

    private ensureUploadDirectoryExists() {
        const fullPath = this.getUploadPath();
        if (!fs.existsSync(fullPath)) {
            try {
                fs.mkdirSync(fullPath, { recursive: true });
                this.logger.log(`Infrastructure Ready. Upload directory created at: ${fullPath}`);
            } catch (error) {
                this.logger.error(`CRITICAL: Failed to create upload directory at ${fullPath}. ${error.message}`);
                throw new Error('Storage infrastructure initialization failed.');
            }
        }
    }
}