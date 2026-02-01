import { PruneExecutionDto } from '../dto/prune-execution.dto';

export interface RetentionStrategy {
  /**
   * Eksekusi strategi retensi (Dry Run atau Delete).
   * Method ini bertanggung jawab untuk menghitung atau menghapus data usang
   * dan mengembalikan laporan eksekusi.
   * * @param cutoffDate Batas tanggal data (data sebelum ini akan diproses).
   * @param isDryRun Jika true, hanya hitung estimasi jumlah data tanpa menghapus.
   * @returns Laporan hasil eksekusi (PruneExecutionDto).
   */
  execute(cutoffDate: Date, isDryRun: boolean): Promise<PruneExecutionDto>;
}

// Token untuk Dependency Injection di NestJS (Diupdate untuk konsistensi)
export const RETENTION_STRATEGIES = {
  HISTORICAL: 'HISTORICAL_STRATEGY',
  SNAPSHOT: 'SNAPSHOT_STRATEGY',
  EDUCATION: 'EDUCATION_CLEANUP_STRATEGY',
};