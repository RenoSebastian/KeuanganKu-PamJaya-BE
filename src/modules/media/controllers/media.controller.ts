import {
    Controller,
    Post,
    Delete,
    Body,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    ParseFilePipe,
    MaxFileSizeValidator,
    FileTypeValidator,
    HttpStatus,
    HttpCode,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { MediaStorageService } from '../services/media-storage.service';

@ApiTags('Media Management')
@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MediaController {
    constructor(private readonly mediaService: MediaStorageService) { }

    // --- UPLOAD ENDPOINT ---

    @Post('upload')
    @Roles(Role.ADMIN, Role.DIRECTOR) // Security: Hanya Admin/Director yang boleh upload
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Upload single image asset (Max 2MB, JPG/PNG/WEBP)' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'File gambar binary. Maksimal 2MB.',
                },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'File berhasil diunggah.' })
    @ApiResponse({ status: 400, description: 'Validasi file gagal (Ukuran/Tipe).' })
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    // 1. Size Validation: Hard Limit 2MB
                    // Mencegah serangan DoS melalui exhaustion storage
                    new MaxFileSizeValidator({
                        maxSize: 2 * 1024 * 1024,
                        message: 'File terlalu besar. Maksimal ukuran yang diizinkan adalah 2MB.'
                    }),

                    // 2. MIME Type Validation: Regex Literal
                    // Menangkap: image/jpeg, image/jpg, image/png, image/webp
                    new FileTypeValidator({
                        fileType: /image\/(jpeg|jpg|png|webp)/
                    }),
                ],
                // Mengembalikan 400 Bad Request jika validasi gagal
                errorHttpStatusCode: HttpStatus.BAD_REQUEST,
            }),
        )
        file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('File tidak ditemukan dalam request.');
        }

        // Delegasi ke Service (Separation of Concerns)
        const result = await this.mediaService.uploadFile(file);

        return {
            status: 'success',
            message: 'File uploaded successfully',
            data: result, // { url: 'uploads/uuid.jpg', filename: ... }
        };
    }

    // --- DELETE ENDPOINT (Untuk Cleanup/Undo) ---

    @Delete()
    @Roles(Role.ADMIN, Role.DIRECTOR)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete media file by path (Garbage Collection)' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    example: 'uploads/550e8400-e29b-41d4-a716-446655440000.jpg',
                    description: 'Relative path file yang akan dihapus.'
                }
            }
        }
    })
    @ApiResponse({ status: 200, description: 'File berhasil dihapus.' })
    @ApiResponse({ status: 400, description: 'Path tidak valid.' })
    async deleteFile(@Body('path') path: string) {
        if (!path) {
            throw new BadRequestException('Path file wajib diisi.');
        }

        // Validasi path traversal sederhana
        if (path.includes('..')) {
            throw new BadRequestException('Invalid path format.');
        }

        await this.mediaService.deleteFile(path);

        return {
            status: 'success',
            message: 'File deleted successfully',
        };
    }
}