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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { MediaStorageService } from '../services/media-storage.service';

@ApiTags('Media Management')
@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.DIRECTOR)
@ApiBearerAuth()
export class MediaController {
    constructor(private readonly mediaService: MediaStorageService) { }

    @Post('upload')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Upload image asset (Max 2MB, JPG/PNG/WEBP)' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    // 1. Size Validation: Max 2MB
                    new MaxFileSizeValidator({
                        maxSize: 2 * 1024 * 1024,
                        message: 'File terlalu besar. Maksimal 2MB.'
                    }),

                    /**
                     * [LOGICAL FIX - V2] 
                     * Menggunakan string pattern 'image/*' untuk fleksibilitas maksimal 
                     * atau daftar eksplisit tanpa escape character yang membingungkan validator.
                     * NestJS FileTypeValidator akan mencocokkan substring ini pada MIME Type.
                     */
                    new FileTypeValidator({
                        fileType: '.(png|jpeg|jpg|webp)'
                    }),
                ],
                // Mengatur agar error yang muncul lebih informatif jika validasi gagal
                errorHttpStatusCode: HttpStatus.BAD_REQUEST
            }),
        )
        file: Express.Multer.File,
    ) {
        // [CHECKPOINT] Pastikan file terdeteksi sebelum masuk ke service
        const result = await this.mediaService.uploadFile(file);

        return {
            message: 'File uploaded successfully',
            ...result
        };
    }
}