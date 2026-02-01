// src/common/constants/education.constant.ts

export const EDUCATION_CONSTANTS = {
    // Aturan Kuis
    QUIZ: {
        DEFAULT_PASSING_SCORE: 70,
        DEFAULT_TIME_LIMIT_MINUTES: 60,
        MAX_ATTEMPTS_DEFAULT: 3,
        // Buffer toleransi latensi jaringan saat submit (Server-Side Anti-Cheat)
        SUBMISSION_BUFFER_MINUTES: 2,
    },

    // Aturan Retensi Data (Archiving)
    RETENTION: {
        // Hapus modul 'ARCHIVED' yang lebih tua dari X hari
        DEFAULT_PRUNE_DAYS: 365,
        // Strategi Identifier
        STRATEGY_NAME: 'EducationCleanupStrategy',
        TARGET_ENTITY: 'EducationModule',
    },

    // Pesan Error Standar (Untuk konsistensi respon API)
    ERRORS: {
        QUIZ_NOT_FOUND: 'Kuis tidak ditemukan atau materi belum dipublikasikan.',
        SESSION_INVALID: 'Sesi tidak valid. Silakan mulai ulang kuis (Refresh halaman).',
        TIMEOUT: 'Batas waktu terlampaui. Jawaban ditolak demi integritas penilaian.',
        MAX_ATTEMPTS: 'Anda telah mencapai batas maksimal percobaan.',
        NOT_PUBLISHED: 'Kuis ini belum tersedia untuk dikerjakan.',
    },

    // Pesan Sukses
    MESSAGES: {
        PASSED: 'Selamat! Anda telah lulus materi ini.',
        FAILED: (score: number, min: number) => `Nilai Anda ${score}. Minimal kelulusan adalah ${min}. Silakan coba lagi.`,
    }
};