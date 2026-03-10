import { PrismaClient } from '@prisma/client';

export const seedMasterData = async (prisma: PrismaClient) => {
    console.log('🌱 Seeding 01_master_data...');

    // 1. Menggunakan Transaction untuk atomicity pada Unit Kerja
    await prisma.$transaction(async (tx) => {
        const units = [
            // --- Data bawaan sistem (Diperkaya agar kompatibel dengan schema baru) ---
            { kode: 'IT-01', nama: 'Divisi Teknologi Informasi', direktorat: 'Teknik', divisi: 'Teknologi Informasi', subDivisi: 'Pengembangan Sistem' },
            { kode: 'FIN-01', nama: 'Divisi Keuangan & Akuntansi', direktorat: 'Keuangan dan Umum', divisi: 'Accounting', subDivisi: 'Accounting & Tax' },
            { kode: 'HR-01', nama: 'Divisi SDM & Umum', direktorat: 'Keuangan dan Umum', divisi: 'Human Capital', subDivisi: 'Training Evaluation' },
            { kode: 'BOD-01', nama: 'Direksi', direktorat: 'Direksi', divisi: null, subDivisi: null },

            // --- Data Injeksi berdasarkan referensi File Excel Pelatihan ---
            { kode: 'KDU-02', nama: 'Capex Management', direktorat: 'Keuangan dan Umum', divisi: 'Finance', subDivisi: 'Capex Management' },
            { kode: 'KDU-03', nama: 'Building Mgt West', direktorat: 'Keuangan dan Umum', divisi: 'General Service', subDivisi: 'Building Management West' },
            { kode: 'KDU-04', nama: 'Facility & Office Mgt', direktorat: 'Keuangan dan Umum', divisi: 'General Service', subDivisi: 'Facility & Office Management' },
            { kode: 'TEK-02', nama: 'Project Network', direktorat: 'Teknik', divisi: 'Design & Construction Bundling', subDivisi: 'Project Construction Bundling' },
            { kode: 'TEK-03', nama: 'Operation Modelling', direktorat: 'Teknik', divisi: 'Operation Planning', subDivisi: 'Modelling' },
            { kode: 'TEK-04', nama: 'Transmisi & NRW', direktorat: 'Teknik', divisi: 'Operation Planning', subDivisi: 'Operation Study & NRW Planning' },
            { kode: 'TEK-05', nama: 'Production Operation', direktorat: 'Teknik', divisi: 'Production', subDivisi: 'Production Operation' },
            { kode: 'TEK-06', nama: 'Project Engineering', direktorat: 'Teknik', divisi: 'Project Engineering & Project Management', subDivisi: 'Project Engineering' },
            { kode: 'SDB-01', nama: 'Corporate Planning', direktorat: 'Strategi dan Bisnis', divisi: 'Strategical Planning & Business Portfolio', subDivisi: 'Corporate Planning & Performance Appraisal' },
        ];

        for (const unit of units) {
            await tx.unitKerja.upsert({
                where: { kodeUnit: unit.kode },
                update: {
                    namaUnit: unit.nama,
                    direktorat: unit.direktorat,
                    divisi: unit.divisi,
                    subDivisi: unit.subDivisi
                },
                create: {
                    kodeUnit: unit.kode,
                    namaUnit: unit.nama,
                    direktorat: unit.direktorat,
                    divisi: unit.divisi,
                    subDivisi: unit.subDivisi
                },
            });
        }
    });

    // 2. SEED EDUCATION CATEGORIES 
    // [UPDATED] Mengembalikan properti 'description' karena kita telah menambahkannya di schema.prisma pada Fase 1
    const educationCategories = [
        {
            name: 'Perencanaan Dasar',
            slug: 'perencanaan-dasar',
            description: 'Konsep dasar manajemen keuangan personal',
            displayOrder: 1,
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/2617/2617304.png',
        },
        {
            name: 'Analisis Keuangan',
            slug: 'analisis-keuangan',
            description: 'Membedah rasio dan kesehatan finansial',
            displayOrder: 2,
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/1570/1570998.png',
        },
        {
            name: 'Tujuan Keuangan',
            slug: 'tujuan-keuangan',
            description: 'Strategi mencapai target aset dan proteksi',
            displayOrder: 3,
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/2850/2850343.png',
        },
    ];

    for (const cat of educationCategories) {
        await prisma.educationCategory.upsert({
            where: { slug: cat.slug },
            update: {
                name: cat.name,
                description: cat.description,
                displayOrder: cat.displayOrder,
                iconUrl: cat.iconUrl,
            },
            create: {
                name: cat.name,
                slug: cat.slug,
                description: cat.description,
                displayOrder: cat.displayOrder,
                iconUrl: cat.iconUrl,
            },
        });
    }

    console.log('✅ Master Data & Education Categories Seeded.');
};