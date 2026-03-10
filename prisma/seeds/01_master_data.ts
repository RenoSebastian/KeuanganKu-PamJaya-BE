import { PrismaClient } from '@prisma/client';

export const seedMasterData = async (prisma: PrismaClient) => {
    console.log('🌱 Seeding 01_master_data (PAM Jaya Structure)...');

    await prisma.$transaction(async (tx) => {
        const units = [
            // --- DIREKTORAT KEUANGAN DAN UMUM ---
            { kode: 'FIN-01', nama: 'Accounting & Tax', direktorat: 'Keuangan dan Umum', divisi: 'Accounting', subDivisi: 'Accounting & Tax' },
            { kode: 'FIN-02', nama: 'Capex Management', direktorat: 'Keuangan dan Umum', divisi: 'Finance', subDivisi: 'Capex Management' },
            { kode: 'HR-01', nama: 'Human Capital', direktorat: 'Keuangan dan Umum', divisi: 'Human Capital', subDivisi: null },
            { kode: 'HR-02', nama: 'HC Strategy', direktorat: 'Keuangan dan Umum', divisi: 'Human Capital', subDivisi: 'HC Strategy' },
            { kode: 'GS-01', nama: 'Building Management West', direktorat: 'Keuangan dan Umum', divisi: 'General Service', subDivisi: 'Building Management West' },
            { kode: 'GS-02', nama: 'Facility & Office Management', direktorat: 'Keuangan dan Umum', divisi: 'General Service', subDivisi: 'Facility & Office Management' },
            { kode: 'LOG-01', nama: 'Logistic Area I', direktorat: 'Keuangan dan Umum', divisi: 'Procurement & Logistic', subDivisi: 'Logistic Area I' },
            { kode: 'LOG-02', nama: 'Logistic Area II', direktorat: 'Keuangan dan Umum', divisi: 'Procurement & Logistic', subDivisi: 'Logistic Area II' },

            // --- DIREKTORAT TEKNIK ---
            { kode: 'IT-01', nama: 'Pengembangan Sistem', direktorat: 'Teknik', divisi: 'Teknologi Informasi', subDivisi: 'Pengembangan Sistem' },
            { kode: 'IT-02', nama: 'IT Planning, Governance & Control', direktorat: 'Teknik', divisi: 'Teknologi Informasi', subDivisi: 'IT Planning, Governance & Control' },
            { kode: 'IT-03', nama: 'ERP', direktorat: 'Teknik', divisi: 'Teknologi Informasi', subDivisi: 'ERP' },
            { kode: 'TEK-01', nama: 'Project Construction Bundling', direktorat: 'Teknik', divisi: 'Design & Construction Bundling', subDivisi: 'Project Construction Bundling' },
            { kode: 'TEK-02', nama: 'Modelling', direktorat: 'Teknik', divisi: 'Operation Planning', subDivisi: 'Modelling' },
            { kode: 'TEK-03', nama: 'Operation Study & NRW Planning', direktorat: 'Teknik', divisi: 'Operation Planning', subDivisi: 'Operation Study & NRW Planning' },
            { kode: 'TEK-04', nama: 'NRW Data Performance & Support', direktorat: 'Teknik', divisi: 'Operation Planning', subDivisi: 'NRW Data Performance & Support' },
            { kode: 'TEK-05', nama: 'Production Operation', direktorat: 'Teknik', divisi: 'Production', subDivisi: 'Production Operation' },
            { kode: 'TEK-06', nama: 'Project IPA', direktorat: 'Teknik', divisi: 'Production', subDivisi: 'Project IPA' },
            { kode: 'TEK-07', nama: 'Booster Pump Area I', direktorat: 'Teknik', divisi: 'Production', subDivisi: 'Booster Pump Area I' },
            { kode: 'TEK-08', nama: 'Project Engineering', direktorat: 'Teknik', divisi: 'Project Engineering & Project Management', subDivisi: 'Project Engineering' },
            { kode: 'TEK-09', nama: 'Project Management East', direktorat: 'Teknik', divisi: 'Project Engineering & Project Management', subDivisi: 'Project Management East' },
            { kode: 'TEK-10', nama: 'Distribution', direktorat: 'Teknik', divisi: 'Distribution', subDivisi: null },
            { kode: 'TEK-11', nama: 'R&D Technical', direktorat: 'Teknik', divisi: 'Technical', subDivisi: 'R&D Technical' },
            { kode: 'TEK-12', nama: 'Material Quality Control', direktorat: 'Teknik', divisi: 'Asset Management', subDivisi: 'Material Quality Control' },

            // --- DIREKTORAT PELAYANAN / PEMASARAN ---
            { kode: 'COM-01', nama: 'Commercial Performance', direktorat: 'Pemasaran', divisi: 'Commercial', subDivisi: 'Commercial Performance' },
            { kode: 'MKT-01', nama: 'Marketing West', direktorat: 'Pemasaran', divisi: 'Marketing', subDivisi: 'Marketing West' },
            { kode: 'MKT-02', nama: 'Area Business Perdana', direktorat: 'Pemasaran', divisi: 'Marketing', subDivisi: 'Area Business Perdana' },
            { kode: 'MKT-03', nama: 'Area Business Jati Baru', direktorat: 'Pemasaran', divisi: 'Marketing', subDivisi: 'Area Business Jati Baru' },
            { kode: 'MKT-04', nama: 'Area Business Gudang Air', direktorat: 'Pemasaran', divisi: 'Marketing', subDivisi: 'Area Business Gudang Air' },

            // --- DIREKTORAT STRATEGI DAN BISNIS ---
            { kode: 'SDB-01', nama: 'Corporate Planning & Performance Appraisal', direktorat: 'Strategi dan Bisnis', divisi: 'Strategical Planning & Business Portfolio', subDivisi: 'Corporate Planning & Performance Appraisal' },
            { kode: 'SDB-02', nama: 'Business Process & Management System', direktorat: 'Strategi dan Bisnis', divisi: 'Management System', subDivisi: 'Business Process & Management System' },

            // --- DIREKSI & LAINNYA ---
            { kode: 'BOD-01', nama: 'Direksi', direktorat: 'Direksi', divisi: null, subDivisi: null },
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

    console.log('✅ Master Data PAM Jaya & Education Categories Seeded.');
};