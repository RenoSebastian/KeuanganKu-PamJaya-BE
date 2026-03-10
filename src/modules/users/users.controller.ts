import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import * as client from '@prisma/client';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EditUserDto } from './dto/edit-user.dto';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
// [NEW FASE 6] Import BulkImportService
import { BulkImportService } from './services/bulk-import.service';

@ApiTags('Users')
@UseGuards(JwtAuthGuard, RolesGuard) // Menggunakan Guard Custom + Roles
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly userService: UsersService,
    private readonly bulkImportService: BulkImportService, // [NEW FASE 6] Inject Service Import
  ) { }

  // =================================================================
  // SELF-SERVICE (Untuk User Biasa mengelola akun sendiri)
  // =================================================================

  @Get('me')
  @ApiOperation({ summary: 'Dapatkan data profil sendiri' })
  getMe(@GetUser() user: client.User) {
    return this.userService.getMe(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update data profil sendiri' })
  editUser(@GetUser('id') userId: string, @Body() dto: EditUserDto) {
    return this.userService.editUser(userId, dto);
  }

  // =================================================================
  // ADMIN ONLY (Manajemen Pegawai)
  // =================================================================

  // [NEW FASE 6] BULK IMPORT ENDPOINT
  @Post('bulk-import')
  @Roles(client.Role.ADMIN)
  @UseInterceptors(FileInterceptor('file')) // Interceptor untuk menangkap FormData field 'file'
  @ApiOperation({ summary: 'Import data pegawai massal dari file Excel/CSV' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File Excel (.xlsx atau .csv)',
        },
      },
    },
  })
  async bulkImport(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          // Batasi ukuran file max 5MB untuk keamanan memory
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    // Serahkan buffer file ke Orchestrator Service
    return this.bulkImportService.processImport(file);
  }

  @Get()
  @Roles(client.Role.ADMIN)
  @ApiOperation({ summary: 'Dapatkan semua data pegawai (Filter & Search)' })
  findAll(@Query('search') search?: string, @Query('role') role?: client.Role) {
    return this.userService.findAll({ search, role });
  }

  @Post()
  @Roles(client.Role.ADMIN)
  @ApiOperation({ summary: 'Buat satu akun pegawai baru' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Get(':id')
  @Roles(client.Role.ADMIN)
  @ApiOperation({ summary: 'Dapatkan detail spesifik satu pegawai' })
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @Roles(client.Role.ADMIN)
  @ApiOperation({ summary: 'Update data struktural satu pegawai' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateUser(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(client.Role.ADMIN)
  @ApiOperation({ summary: 'Hapus satu akun pegawai' })
  remove(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }
}