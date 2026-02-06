import { RiskProfileCategory } from '../dto/risk-profile-response.dto';

/**
 * Bobot Nilai untuk setiap jawaban.
 * Sesuai BRD: A=1, B=2, C=3
 */
export const RISK_SCORE_WEIGHT = {
    A: 1,
    B: 2,
    C: 3,
};

/**
 * Definisi Detail Profil Risiko.
 * Mencakup: Batas Skor, Deskripsi Naratif, dan Alokasi Aset Default.
 */
export const RISK_PROFILE_RULES = {
    [RiskProfileCategory.KONSERVATIF]: {
        maxScore: 16, // Range: 10 - 16
        description:
            'Anda lebih mengutamakan keamanan dana dibandingkan pertumbuhan yang tinggi. Fluktuasi nilai investasi yang besar cenderung membuat Anda tidak nyaman. Strategi yang sesuai adalah penempatan dana pada instrumen dengan risiko rendah dan nilai yang relatif stabil.',
        allocation: {
            lowRisk: 70, // Dominan di Pasar Uang/Deposito
            mediumRisk: 30,
            highRisk: 0,
        },
    },
    [RiskProfileCategory.MODERAT]: {
        maxScore: 23, // Range: 17 - 23
        description:
            'Anda berada di posisi seimbang antara keamanan dana dan potensi pertumbuhan. Anda masih dapat menerima fluktuasi nilai investasi selama sesuai dengan tujuan jangka menengah hingga panjang. Strategi investasi yang cocok adalah kombinasi antara instrumen stabil dan bertumbuh.',
        allocation: {
            lowRisk: 40,
            mediumRisk: 40, // Seimbang
            highRisk: 20,
        },
    },
    [RiskProfileCategory.AGRESIF]: {
        maxScore: 30, // Range: 24 - 30
        description:
            'Anda siap menghadapi fluktuasi nilai investasi demi potensi hasil jangka panjang yang lebih optimal. Penurunan nilai jangka pendek bukan menjadi hambatan utama. Strategi yang sesuai adalah penempatan dana lebih besar pada instrumen dengan potensi pertumbuhan tinggi.',
        allocation: {
            lowRisk: 20,
            mediumRisk: 30,
            highRisk: 50, // Dominan di Saham/Equity
        },
    },
};