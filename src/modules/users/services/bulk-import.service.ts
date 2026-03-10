import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SearchService } from '../../search/search.service';
import { parseExcelToJson } from '../../../common/utils/excel-parser.util';
import { generateDefaultPassword } from '../../../common/utils/password-generator.util';
import { BulkImportResponseDto, ImportErrorDetail, RawExcelRow } from '../dto/bulk-import.dto';
import * as argon2 from 'argon2';

@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  async processImport(file: Express.Multer.File): Promise<BulkImportResponseDto> {
    if (!file) {
      throw new BadRequestException('File Excel tidak ditemukan');
    }

    try {
      const parsedData = parseExcelToJson<RawExcelRow>(file.buffer);
      if (parsedData.length === 0) {
        throw new BadRequestException('File Excel kosong atau format tidak sesuai');
      }

      const units = await this.prisma.unitKerja.findMany({
        select: { id: true, namaUnit: true },
      });
      
      const unitMap = new Map<string, string>();
      units.forEach((u) => {
        unitMap.set(u.namaUnit.trim().toLowerCase(), u.id);
      });

      const validRows: any[] = [];
      const errors: ImportErrorDetail[] = [];

      for (const [index, row] of parsedData.entries()) {
        const rowNumber = index + 2; 

        if (!row.NPP || !row.NAMA || !row.EMAIL) {
          errors.push({
            row: rowNumber,
            npp: String(row.NPP || '-'),
            name: row.NAMA || '-',
            reason: 'Data wajib (NPP, NAMA, EMAIL) ada yang kosong',
          });
          continue;
        }

        const targetUnitName = row['SUB DIVISI'] || row.DIVISI || row.DIREKTORAT;

        if (!targetUnitName) {
          errors.push({
            row: rowNumber,
            npp: String(row.NPP),
            name: row.NAMA,
            reason: 'Data Organisasi (Direktorat/Divisi) kosong',
          });
          continue;
        }

        const unitId = unitMap.get(targetUnitName.trim().toLowerCase());

        if (!unitId) {
          errors.push({
            row: rowNumber,
            npp: String(row.NPP),
            name: row.NAMA,
            reason: `Unit Kerja '${targetUnitName}' tidak terdaftar di Master Data sistem.`,
          });
          continue;
        }

        const dob = new Date(row['TANGGAL LAHIR']);
        if (isNaN(dob.getTime())) {
          errors.push({
            row: rowNumber,
            npp: String(row.NPP),
            name: row.NAMA,
            reason: 'Format TANGGAL LAHIR tidak valid',
          });
          continue;
        }

        validRows.push({ ...row, unitId, dob, rowNumber });
      }

      let insertedCount = 0;
      let updatedCount = 0;
      const searchSyncPayloads: any[] = [];

      if (validRows.length > 0) {
        
        const nppList = validRows.map(r => String(r.NPP).trim());
        const existingUsers = await this.prisma.user.findMany({
          where: { nip: { in: nppList } },
          select: { id: true, nip: true }
        });
        
        const existingUserMap = new Map<string, string>();
        existingUsers.forEach(u => existingUserMap.set(u.nip, u.id));

        const preparedData = await Promise.all(
          validRows.map(async (item) => {
            const nppStr = String(item.NPP).trim();
            const existingId = existingUserMap.get(nppStr);
            
            // [FIX LOGIC] Deklarasi eksplisit agar TS mengizinkan pengisian string dari argon2
            let passwordHash: string | undefined = undefined;

            if (!existingId) {
              const rawPassword = generateDefaultPassword(item.NAMA, item.dob);
              passwordHash = await argon2.hash(rawPassword);
            }

            return { ...item, nppStr, existingId, passwordHash };
          })
        );

        await this.prisma.$transaction(async (tx) => {
          for (const item of preparedData) {
            
            if (item.existingId) {
              const updated = await tx.user.update({
                where: { id: item.existingId },
                data: {
                  fullName: item.NAMA,
                  email: item.EMAIL,
                  unitKerjaId: item.unitId,
                  position: item.POSISI,
                  dateOfBirth: item.dob,
                },
              });
              updatedCount++;
              searchSyncPayloads.push(this.buildSearchPayload(updated));
            } else {
              // Pengaman tambahan (Defensive Programming) jika passwordHash lolos sebagai undefined
              if (!item.passwordHash) {
                throw new Error(`Password hash gagal di-generate untuk user ${item.nppStr}`);
              }

              const inserted = await tx.user.create({
                data: {
                  nip: item.nppStr,
                  fullName: item.NAMA,
                  email: item.EMAIL,
                  passwordHash: item.passwordHash,
                  unitKerjaId: item.unitId,
                  position: item.POSISI,
                  dateOfBirth: item.dob,
                  role: 'USER',
                  isFirstLogin: true, 
                },
              });
              insertedCount++;
              searchSyncPayloads.push(this.buildSearchPayload(inserted));
            }
          }
        }, {
          maxWait: 10000, 
          timeout: 30000, 
        });

        if (searchSyncPayloads.length > 0) {
          this.searchService
            .addDocuments('global_search', searchSyncPayloads)
            .catch((e) => this.logger.warn(`Search sync error post-import: ${e.message}`));
        }
      }

      return {
        totalProcessed: parsedData.length,
        insertedCount,
        updatedCount,
        failedCount: errors.length,
        errors,
      };
    } catch (error) {
      this.logger.error(`Bulk import failed: ${error.message}`);
      throw new BadRequestException(`Gagal memproses file import: ${error.message}`);
    }
  }

  private buildSearchPayload(user: any) {
    return {
      id: user.id,
      redirectId: user.id,
      type: 'PERSON',
      title: user.fullName,
      subtitle: user.email,
      role: user.role,
      unitKerjaId: user.unitKerjaId,
      position: user.position,
    };
  }
}
