import {
    Controller,
    Post,
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
                    // Menggunakan regex literal /.../ untuk memastikan matching akurat pada stream binary.
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
            message: 'File uploaded successfully',
            data: result, // { url: 'uploads/uuid.jpg', filename: ... }
        };
    }
}