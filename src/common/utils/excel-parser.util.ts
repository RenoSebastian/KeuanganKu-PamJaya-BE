import * as xlsx from 'xlsx';

/**
 * Membaca file Excel (XLSX/CSV) dari Buffer dan mengubahnya menjadi Array of JSON Objects.
 * Menggunakan Generic Type <T> agar balikan (return) type-safe dan sesuai dengan DTO.
 */
export function parseExcelToJson<T>(buffer: Buffer): T[] {
    try {
        // Membaca workbook dari buffer (Memori Node.js)
        // cellDates: true -> Sangat penting agar kolom tanggal di Excel terkonversi langsung jadi JS Date
        const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });

        // Mengambil sheet (halaman) pertama dari file Excel
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Konversi worksheet ke bentuk JSON
        // defval: null -> Sel Excel yang kosong akan dijadikan null, bukan di-skip key-nya
        const jsonData = xlsx.utils.sheet_to_json<T>(worksheet, { defval: null });

        return jsonData;
    } catch (error) {
        throw new Error(`Gagal membaca atau mem-parsing file Excel: ${error.message}`);
    }
}