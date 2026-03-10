import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2'; // [FIX FASE 1]
import { DEFAULT_PASSWORD } from './helpers';

export const seedUsers = async (prisma: PrismaClient) => {
    console.log('🌱 Seeding 02_users...');

    // 1. Prepare Dependencies
    // [FIX FASE 1] Hash menggunakan Argon2 secara langsung di seeder
    const passwordHash = await argon2.hash(DEFAULT_PASSWORD || 'password123');

    // Fetch Unit Kerja IDs (Required for Relation)
    const unitIT = await prisma.unitKerja.findUnique({ where: { kodeUnit: 'IT-01' } });
    const unitBOD = await prisma.unitKerja.findUnique({ where: { kodeUnit: 'BOD-01' } });

    if (!unitIT || !unitBOD) {
        throw new Error('❌ Critical Error: Unit Kerja not found. Run 01_master_data first.');
    }

    // 2. Create Director (Role: DIRECTOR)
    await prisma.user.upsert({
        where: { email: 'director@keuanganku.com' },
        update: {},
        create: {
            fullName: 'Bapak Direktur Utama',
            email: 'director@keuanganku.com',
            nip: 'DIR-001',
            passwordHash,
            role: Role.DIRECTOR,
            unitKerjaId: unitBOD.id,
            dateOfBirth: new Date('1975-05-20'),
            dependentCount: 2,
            isFirstLogin: false, // [NEW FASE 1] Set false untuk akun dummy
        },
    });

    // 3. Create Admin (Role: ADMIN)
    await prisma.user.upsert({
        where: { email: 'hello@keuanganku.id' },
        update: {},
        create: {
            fullName: 'System Administrator',
            email: 'hello@keuanganku.id', // Menyesuaikan dengan where clause Anda
            nip: 'ADM-001',
            passwordHash,
            role: Role.ADMIN,
            unitKerjaId: unitIT.id,
            dateOfBirth: new Date('1990-08-17'),
            dependentCount: 0,
            isFirstLogin: false, // [NEW FASE 1] Set false untuk akun dummy
        },
    });

    console.log(`✅ 1 Director, 1 Admin Users Seeded.`);
};