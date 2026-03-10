import * as xlsx from 'xlsx';

/**
 * Membaca file Excel (XLSX/CSV) dari Buffer dan mengubahnya menjadi Array of JSON Objects.
 * Dilengkapi dengan "Smart Header Detection" untuk mentolerir file korporat yang memiliki 
 * baris judul (Title Rows) kosong di bagian atas dokumen.
 */
export function parseExcelToJson<T>(buffer: Buffer): T[] {
    try {
        // 1. Baca workbook
        const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // 2. Konversi awal ke bentuk Matriks (Array of Arrays) untuk memindai isi
        // { header: 1 } memaksa pembacaan sebagai array 2D terlepas dari apa isinya
        const aoa: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        // 3. Dynamic Header Detection (Mencari letak baris Header yang sebenarnya)
        let headerRowIndex = 0;

        for (let i = 0; i < aoa.length; i++) {
            const row = aoa[i];
            // Jika baris ini memiliki sel bertuliskan "NPP" atau "NAMA", ini adalah Headernya!
            const isHeaderRow = row.some(
                (cell) => typeof cell === 'string' && (cell.toUpperCase() === 'NPP' || cell.toUpperCase() === 'NAMA')
            );

            if (isHeaderRow) {
                headerRowIndex = i;
                break; // Berhenti mencari setelah ketemu
            }
        }

        // 4. Parse ulang data menjadi JSON Object yang rapi
        // range: headerRowIndex -> Menginstruksikan parser untuk melompati baris-baris judul di atasnya
        const jsonData = xlsx.utils.sheet_to_json<T>(worksheet, {
            defval: null,
            range: headerRowIndex
        });

        return jsonData;
    } catch (error) {
        throw new Error(`Gagal membaca atau mem-parsing file Excel: ${error.message}`);
    }
}