import { ApiProperty } from '@nestjs/swagger';

// ============================================================================
// 1. KONTRAK DATA MENTAH EXCEL (Sesuai dengan Header File Excel PAM Jaya)
// Interface ini tidak menggunakan validasi class-validator karena datanya 
// di-generate otomatis oleh library xlsx dari buffer, bukan dari body JSON.
// ============================================================================
export interface RawExcelRow {
    NO?: number;
    NPP: string | number; // Bisa terbaca sebagai angka atau string oleh xlsx parser
    NAMA: string;
    EMAIL: string;
    'TANGGAL LAHIR': Date | string; // xlsx dengan cellDates:true akan mengembalikan Date object
    USIA?: number; // Atribut ini ada di Excel, tapi akan diabaikan (tidak disimpan ke DB)
    DIREKTORAT: string;
    DIVISI: string;
    'SUB DIVISI'?: string; // Bisa kosong (null/undefined) jika pegawai berada di tingkat Divisi
    POSISI: string;
}

// ============================================================================
// 2. SUB-DTO: DETAIL ERROR PER BARIS
// Digunakan untuk melaporkan spesifik baris mana yang gagal dan apa alasannya.
// ============================================================================
export class ImportErrorDetail {
    @ApiProperty({ example: 4, description: 'Nomor baris pada file Excel yang gagal diproses' })
    row: number;

    @ApiProperty({ example: '502633', description: 'NPP pegawai pada baris tersebut' })
    npp: string;

    @ApiProperty({ example: 'Maghfira Dwi Puspita', description: 'Nama pegawai pada baris tersebut' })
    name: string;

    @ApiProperty({
        example: "Divisi 'Acounting' tidak ditemukan di Master Data Unit Kerja",
        description: 'Pesan error teknis atau fungsional'
    })
    reason: string;
}

// ============================================================================
// 3. DTO UTAMA: RESPONSE SUMMARY BULK IMPORT
// Kontrak balikan API ke frontend setelah proses selesai.
// ============================================================================
export class BulkImportResponseDto {
    @ApiProperty({ example: 120, description: 'Total baris data yang dibaca dari file Excel' })
    totalProcessed: number;

    @ApiProperty({ example: 100, description: 'Total data pegawai baru yang berhasil di-insert' })
    insertedCount: number;

    @ApiProperty({ example: 18, description: 'Total data pegawai lama yang berhasil di-update (Upsert)' })
    updatedCount: number;

    @ApiProperty({ example: 2, description: 'Total baris data yang ditolak/gagal diproses' })
    failedCount: number;

    @ApiProperty({
        type: [ImportErrorDetail],
        description: 'Array detail kegagalan untuk ditampilkan di tabel error frontend'
    })
    errors: ImportErrorDetail[];
}