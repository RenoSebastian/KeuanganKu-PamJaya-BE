import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SearchModule } from '../search/search.module';
import { BulkImportService } from './services/bulk-import.service'; // [NEW] Import service baru

@Module({
  imports: [SearchModule],
  controllers: [UsersController],
  // [UPDATE] Daftarkan BulkImportService ke dalam ekosistem Providers
  providers: [UsersService, BulkImportService],
  // [UPDATE] Ekspor jika module lain (seperti Auth/Audit) butuh menggunakannya di masa depan
  exports: [UsersService, BulkImportService]
})
export class UsersModule { }