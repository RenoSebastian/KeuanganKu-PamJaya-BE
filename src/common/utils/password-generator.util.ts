/**
 * Menghasilkan kata sandi default berdasarkan nama lengkap dan tanggal lahir.
 * Pola: Pam + Kata Pertama (Max 4 Huruf, Kapital Awal) + DDMM
 * Contoh: Reno Sebastian (29-04-2004) -> PamReno2904
 * Contoh: Nurul Hikmah (05-12-1988) -> PamNuru0512
 */
export function generateDefaultPassword(fullName: string, dob: Date): string {
    if (!fullName || !dob) {
        // Fallback safety jika terjadi anomali data ekstrem (kosong)
        return 'PamJaya123!';
    }

    // 1. Ambil kata pertama, buang karakter non-alfabet (angka/simbol)
    const firstWord = fullName.trim().split(/\s+/)[0].replace(/[^a-zA-Z]/g, '');

    // Fallback tambahan jika firstWord kosong (misal user menginput nama hanya simbol)
    const safeWord = firstWord.length > 0 ? firstWord : 'User';

    // 2. Ambil maksimal 4 karakter agar panjang sandi tetap ideal
    const cleanName = safeWord.substring(0, 4);

    // 3. Pastikan Huruf Pertama Kapital, sisanya kecil
    const capitalizedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();

    // 4. Format Tanggal menjadi DD dan MM (padding dengan 0 di depan jika 1 digit)
    const day = String(dob.getDate()).padStart(2, '0');
    const month = String(dob.getMonth() + 1).padStart(2, '0'); // Ditambah 1 karena bulan di JS dimulai dari 0

    // 5. Rangkai Password
    return `Pam${capitalizedName}${day}${month}`;
}