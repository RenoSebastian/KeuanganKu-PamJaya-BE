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
    ) { }

    async processImport(file: Express.Multer.File): Promise<BulkImportResponseDto> {
        if (!file) {
            throw new BadRequestException('File Excel tidak ditemukan');
        }

        try {
            // LAKAH 1: Ekstrak Buffer ke Array JSON
            const parsedData = parseExcelToJson<RawExcelRow>(file.buffer);
            if (parsedData.length === 0) {
                throw new BadRequestException('File Excel kosong atau format tidak sesuai');
            }

            // LANGKAH 2: Memory Map (O(1) Lookup untuk Unit Kerja)
            // Menarik seluruh Unit Kerja agar tidak membebani DB dengan query berulang di dalam loop
            const units = await this.prisma.unitKerja.findMany({
                select: { id: true, namaUnit: true },
            });

            const unitMap = new Map<string, string>();
            units.forEach((u) => {
                // Normalisasi key (huruf kecil & tanpa spasi lebih) agar pencocokan Excel lebih toleran
                unitMap.set(u.namaUnit.trim().toLowerCase(), u.id);
            });

            // Validasi dan Pemisahan Data
            const validRows: any[] = [];
            const errors: ImportErrorDetail[] = [];

            // LANGKAH 3: Pre-flight Validation
            for (const [index, row] of parsedData.entries()) {
                const rowNumber = index + 2; // +2 karena baris 1 adalah header Excel

                // Validasi field wajib
                if (!row.NPP || !row.NAMA || !row.EMAIL) {
                    errors.push({
                        row: rowNumber,
                        npp: String(row.NPP || '-'),
                        name: row.NAMA || '-',
                        reason: 'Data wajib (NPP, NAMA, EMAIL) ada yang kosong',
                    });
                    continue;
                }

                // Resolusi Hierarki (Ambil level paling dalam/spesifik)
                // Pegawai ditempatkan di Sub Divisi. Jika tidak ada, di Divisi. Jika tidak ada, di Direktorat.
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

                // Parsing Tanggal Lahir yang aman
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

            // LANGKAH 4 & 5: Hydration, Hashing, dan Database Transaction
            let insertedCount = 0;
            let updatedCount = 0;
            const searchSyncPayloads: any[] = [];

            if (validRows.length > 0) {
                await this.prisma.$transaction(async (tx) => {
                    for (const item of validRows) {
                        const nppStr = String(item.NPP).trim();

                        // Cek apakah pegawai sudah ada untuk menentukan Insert atau Update
                        const existingUser = await tx.user.findUnique({
                            where: { nip: nppStr },
                        });

                        if (existingUser) {
                            // UPDATE SCENARIO: Hanya update data struktural (Posisi & Unit)
                            // Password dan isFirstLogin tidak diubah agar tidak merusak akun yang sudah aktif
                            const updated = await tx.user.update({
                                where: { id: existingUser.id },
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
                            // INSERT SCENARIO (Pengguna Baru)
                            const rawPassword = generateDefaultPassword(item.NAMA, item.dob);
                            const passwordHash = await argon2.hash(rawPassword);

                            const inserted = await tx.user.create({
                                data: {
                                    nip: nppStr,
                                    fullName: item.NAMA,
                                    email: item.EMAIL,
                                    passwordHash: passwordHash,
                                    unitKerjaId: item.unitId,
                                    position: item.POSISI,
                                    dateOfBirth: item.dob,
                                    role: 'USER',
                                    isFirstLogin: true, // WAJIB ganti sandi saat login pertama
                                },
                            });
                            insertedCount++;

                            searchSyncPayloads.push(this.buildSearchPayload(inserted));
                        }
                    }
                });

                // Sinkronisasi data ke Engine Pencarian (Fire and Forget)
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

    // Helper murni untuk standarisasi format pencarian
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