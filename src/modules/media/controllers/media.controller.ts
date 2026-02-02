import {
    Controller,
    Post,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    ParseFilePipe,
    MaxFileSizeValidator,
    BadRequestException,
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
                    description: 'File gambar untuk thumbnail atau ilustrasi modul',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    // 1. Size Validation: Max 2MB sesuai kebijakan efisiensi penyimpanan
                    new MaxFileSizeValidator({
                        maxSize: 2 * 1024 * 1024,
                        message: 'Ukuran file terlalu besar. Maksimal adalah 2MB.'
                    }),
                ],
                errorHttpStatusCode: HttpStatus.BAD_REQUEST
            }),
        )
        file: Express.Multer.File,
    ) {
        // Additional runtime validation (MIME + extension) to avoid ParseFilePipe mismatches
        const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        const allowedExt = /\.(png|jpe?g|webp)$/i;

        if (!file) {
            throw new BadRequestException('No file provided');
        }

        if (!allowedMimes.includes(file.mimetype) && !allowedExt.test(file.originalname)) {
            throw new BadRequestException(
                `Validation failed (current file type is ${file.mimetype}, expected image/png|image/jpeg|image/jpg|image/webp)`
            );
        }

        // Eksekusi penyimpanan fisik ke disk via service
        const result = await this.mediaService.uploadFile(file);

        return {
            message: 'File uploaded successfully',
            ...result // Mengembalikan data url: 'uploads/uuid.jpg', filename, dll.
        };
    }
}