import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) { }

  /**
   * [IMPLEMENTED] ADAPTER METHOD
   * Dipanggil oleh FinancialController dan modul lain.
   * Tugasnya: Memetakan parameter 'flat' menjadi struktur DTO/Database.
   */
  async logActivity(data: {
    userId: string;
    action: string;
    entity?: string;
    entityId?: string;
    details?: string;
    ip?: string;
    userAgent?: string;
  }) {
    // Mapping Logic:
    // 1. userId -> actorId (Sesuai schema Prisma)
    // 2. entity, entityId, details -> masuk ke kolom JSON 'metadata'
    const payload: CreateAuditLogDto = {
      actorId: data.userId,
      action: data.action,
      // [FIX] Gunakan undefined, bukan null, agar sesuai dengan definisi DTO (string | undefined)
      targetUserId: undefined,
      metadata: {
        entity: data.entity,
        entityId: data.entityId,
        details: data.details,
        ip: data.ip,
        userAgent: data.userAgent,
        timestamp: new Date().toISOString()
      },
    };

    // Panggil Core Logic
    return this.logAccess(payload);
  }

  /**
   * CORE: MENCATAT JEJAK DIGITAL (AUDIT TRAIL)
   * Menyimpan data langsung ke tabel AccessLog di Database.
   */
  async logAccess(dto: CreateAuditLogDto): Promise<void> {
    try {
      await this.prisma.accessLog.create({
        data: {
          actorId: dto.actorId,
          // Prisma biasanya butuh null untuk kolom optional di DB, jadi konversi di sini
          targetUserId: dto.targetUserId ?? null,
          action: dto.action,
          // Cast ke any atau InputJsonValue agar Prisma tidak komplain soal tipe JSON
          metadata: (dto.metadata as any) ?? {},
        },
      });
    } catch (error) {
      // Fail-safe: Error logging JANGAN SAMPAI mematikan flow utama user
      // User tetap harus bisa download PDF meski log gagal dicatat.
      this.logger.error(
        `[AUDIT FAILURE] Failed to log action '${dto.action}' by ${dto.actorId}`,
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  /**
   * READ: HISTORY LOG
   * Mengambil data log untuk ditampilkan di dashboard Admin/Direksi
   */
  async getAllLogs() {
    return this.prisma.accessLog.findMany({
      include: {
        actor: {
          select: { fullName: true, email: true, role: true },
        },
        targetUser: {
          select: { fullName: true, unitKerja: { select: { namaUnit: true } } },
        },
      },
      orderBy: { accessedAt: 'desc' },
      take: 100,
    });
  }
}