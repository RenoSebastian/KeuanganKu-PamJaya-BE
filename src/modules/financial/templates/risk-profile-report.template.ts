import * as fs from 'fs';
import * as path from 'path';

/**
 * ------------------------------------------------------------------
 * 1. LOGIC LAYER: ASSET HANDLING
 * ------------------------------------------------------------------
 */
function getImageBase64(filePath: string): string {
    try {
        if (!fs.existsSync(filePath)) {
            console.error(`[PDF] File not found: ${filePath}`);
            return '';
        }
        const bitmap = fs.readFileSync(filePath);
        const extension = path.extname(filePath).toLowerCase().replace('.', '');

        let mimeType = '';
        switch (extension) {
            case 'webp': mimeType = 'image/webp'; break;
            case 'png': mimeType = 'image/png'; break;
            case 'jpg':
            case 'jpeg': mimeType = 'image/jpeg'; break;
            case 'svg': mimeType = 'image/svg+xml'; break;
            default: mimeType = 'image/png';
        }

        return `data:${mimeType};base64,${bitmap.toString('base64')}`;
    } catch (error: any) {
        console.error(`[PDF] Error base64: ${error.message}`);
        return '';
    }
}

// Gunakan gambar yang relevan (bisa diganti dengan gambar spesifik risk profile jika ada)
// Saat ini saya reuse gambar yang sudah ada di asset folder Anda untuk menjaga konsistensi.
const ASSET_BASE_PATH = path.join(process.cwd(), 'src/assets/images');

const assets = {
    logoMaxiPro: getImageBase64(path.join(ASSET_BASE_PATH, 'logokeuanganku.png')),
    // Saya gunakan gambar 'financialcheckup' sebagai placeholder header karena relevan dengan analisis
    headerImg1: getImageBase64(path.join(ASSET_BASE_PATH, 'financialcheckup1.webp')),
    headerImg2: getImageBase64(path.join(ASSET_BASE_PATH, 'financialcheckup2.webp'))
};

/**
 * ------------------------------------------------------------------
 * 2. VIEW LAYER: HTML TEMPLATE
 * ------------------------------------------------------------------
 */
export const riskProfileReportTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Risk Profile Analysis Report</title>
  <style>
    :root {
      --item: #000000;
      /* Dynamic Colors based on Handlebars injection usually, but here we set defaults */
      --primary: #0e7490;      /* Cyan 700 */
      --primary-dark: #ffffff; /* Cyan 800 */
      --secondary: #64748b;    /* Slate 500 */
      --dark: #0f172a;         /* Slate 900 */
      --border: #e2e8f0;       /* Slate 200 */
      --bg-soft: #f8fafc;
      --page-width: 210mm;
      --page-height: 297mm;
      --page-padding: 15mm;
    }

    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    body {
      margin: 0; padding: 0;
      font-family: Helvetica, Arial, sans-serif;
      color: var(--dark);
      background-color: #525252;
    }

    /* --- PAGE CONTAINER --- */
    .page {
      width: var(--page-width);
      min-height: var(--page-height);
      background: #ffffff;
      margin: 20px auto;
      padding: var(--page-padding);
      padding-bottom: 25mm; 
      position: relative;
      overflow: hidden;
      display: flex; flex-direction: column;
    }

    @media print {
      body { background: none; }
      .page { margin: 0; box-shadow: none; page-break-after: always; height: auto; min-height: var(--page-height); }
    }

    /* --- UTILS --- */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: 700; }
    
    /* --- HEADER GRID 2x2 --- */
    .header-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 110px 70px;
      gap: 8px;
      margin-bottom: 30px;
    }
    .h-title-box {
      background-color: var(--primary);
      color: white;
      padding: 20px 30px;
      border-top-left-radius: 20px;
      display: flex; flex-direction: column; justify-content: center;
    }
    .h-image-right-top {
      background-image: url('${assets.headerImg1}');
      background-size: cover; background-position: center;
      border-top-right-radius: 20px;
      background-color: var(--dark);
    }
    .h-image-left-bottom {
      background-image: url('${assets.headerImg2}');
      background-size: cover; background-position: center;
      border-bottom-left-radius: 20px;
      background-color: var(--secondary);
    }
   .h-brand-box {
        background-color: var(--primary-dark);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        border-bottom-right-radius: 20px;
        padding: 10px;
    }
    
    .logo-maxipro { 
      height: 88px; 
      width: auto; 
      display: block;
    }

    .main-heading { 
      font-family: 'Times New Roman', serif; 
      font-size: 32px; line-height: 1; margin: 0; 
    }
    .sub-heading { text-transform: uppercase; font-size: 10px; letter-spacing: 2px; opacity: 0.9; margin-bottom: 4px; }

    /* --- SECTION TITLE --- */
    .section-title {
      font-size: 12px; font-weight: 800; color: var(--secondary);
      text-transform: uppercase; letter-spacing: 1px;
      border-bottom: 2px solid var(--border); padding-bottom: 6px; margin-bottom: 8px;
    }

    /* --- CLIENT INFO (01) --- */
    .info-container {
      margin-bottom: 30px;
    }
    .info-card {
      background: var(--bg-soft); border: 1px solid var(--border);
      border-radius: 12px; padding: 16px;
    }
    .info-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 8px; font-size: 11px; border-bottom: 1px dashed #ccc; padding-bottom: 4px;
    }
    .info-row:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
    .label { color: var(--secondary); font-weight: 600; }
    .value { font-weight: 700; color: var(--dark); font-family: monospace; font-size: 12px; }

    /* --- RESULT CARD (02) --- */
    .result-card {
      color: white; /* Text color will be white for contrast */
      border-radius: 16px;
      padding: 30px;
      text-align: center;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    
    .profile-label { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 10px; }
    .profile-value { font-size: 36px; font-weight: 800; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px; }
    .score-badge { 
      display: inline-block; 
      background: rgba(255, 255, 255, 0.2); 
      padding: 6px 16px; 
      border-radius: 20px; 
      font-size: 14px; 
      font-weight: 600; 
    }

    /* --- DESCRIPTION TEXT (03) --- */
    .desc-box {
      font-size: 11px; line-height: 1.6; text-align: justify; color: var(--dark);
      margin-bottom: 30px; padding: 0 5px;
    }

    /* --- ALLOCATION TABLE (04) --- */
    .alloc-table {
      width: 100%; border-collapse: collapse; margin-bottom: 10px;
    }
    .alloc-table th {
      text-align: left; font-size: 10px; text-transform: uppercase; color: var(--secondary);
      padding: 10px; border-bottom: 2px solid var(--border); background-color: var(--bg-soft);
    }
    .alloc-table td {
      padding: 12px 10px; border-bottom: 1px solid var(--border); vertical-align: middle;
    }
    
    .alloc-name { font-size: 11px; font-weight: 700; color: var(--dark); }
    .alloc-sub { font-size: 9px; color: var(--secondary); margin-top: 2px; }
    .alloc-percent { font-size: 14px; font-weight: 800; font-family: monospace; color: var(--dark); text-align: center;}
    
    /* Bar Chart Visualization inside Table */
    .bar-container {
      width: 100%; background-color: #f1f5f9; height: 12px; border-radius: 6px; overflow: hidden;
    }
    .bar-fill { height: 100%; border-radius: 6px; }

    /* Color Classes */
    .bg-low { background-color: #22c55e; }    /* Green */
    .bg-medium { background-color: #eab308; } /* Yellow/Orange */
    .bg-high { background-color: #ef4444; }   /* Red */

    /* --- DISCLAIMER --- */
    .disclaimer-box {
      margin-top: auto; /* Push to bottom */
      border-top: 1px solid var(--border);
      padding-top: 15px;
    }
    .disclaimer-title { font-size: 9px; font-weight: 800; color: var(--secondary); margin-bottom: 4px; text-transform: uppercase; }
    .disclaimer-text { font-size: 9px; color: #94a3b8; text-align: justify; line-height: 1.4; }

    /* --- PAGE FOOTER --- */
    .page-footer {
      position: absolute; 
      bottom: 0; left: 0; right: 0;
      height: 15mm; padding: 0 15mm;
      border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
      background: white;
    }
    .footer-text { font-size: 9px; color: var(--secondary); font-weight: 500; letter-spacing: 0.5px; }

  </style>
</head>
<body>
  <div class="page">
    
    <div class="header-grid">
      <div class="h-title-box">
        <div class="sub-heading">MAXIPRO Financial</div>
        <h1 class="main-heading">Risk Profile</h1>
      </div>
      <div class="h-image-right-top"></div>
      <div class="h-image-left-bottom"></div>
      <div class="h-brand-box">
        <img src="${assets.logoMaxiPro}" class="logo-maxipro" alt="Logo">
      </div>
    </div>

    <div class="info-container">
      <div class="section-title">01. Informasi Klien</div>
      <div class="info-card">
        <div class="grid-2">
          <div>
            <div class="info-row"><span class="label">Nama Klien</span><span class="value">{{clientName}}</span></div>
            <div class="info-row"><span class="label">Tanggal Simulasi</span><span class="value">{{generatedAt}}</span></div>
          </div>
          <div>
            <div class="info-row"><span class="label">Total Skor</span><span class="value">{{score}} / 30</span></div>
            <div class="info-row"><span class="label">Kategori</span><span class="value">{{profile}}</span></div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-title">02. Hasil Evaluasi</div>
    <div class="result-card" style="background-color: {{themeColor}};">
      <div class="profile-label">Tipe Profil Risiko Anda</div>
      <h2 class="profile-value">{{profile}}</h2>
      <div class="score-badge">Skor: {{score}}</div>
    </div>

    <div class="section-title">03. Analisa Karakteristik</div>
    <div class="desc-box">
      <p>{{description}}</p>
    </div>

    <div class="section-title">04. Rekomendasi Alokasi Aset</div>
    <div style="margin-bottom: 12px; font-size: 10px; color: var(--secondary); font-style: italic;">
      *Acuan porsi portofolio investasi yang disarankan untuk profil {{profile}}.
    </div>

    <table class="alloc-table">
      <thead>
        <tr>
          <th width="40%">Kelas Aset</th>
          <th width="15%" class="text-center">Porsi</th>
          <th width="45%">Visualisasi</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="alloc-name">Pasar Uang / Deposito</div>
            <div class="alloc-sub">Low Risk • Likuiditas Tinggi</div>
          </td>
          <td class="text-center">
            <div class="alloc-percent" style="color: #22c55e;">{{allocation.low}}%</div>
          </td>
          <td>
            <div class="bar-container">
              <div class="bar-fill bg-low" style="width: {{allocation.low}}%;"></div>
            </div>
          </td>
        </tr>
        
        <tr>
          <td>
            <div class="alloc-name">Obligasi / Pendapatan Tetap</div>
            <div class="alloc-sub">Medium Risk • Keseimbangan</div>
          </td>
          <td class="text-center">
            <div class="alloc-percent" style="color: #eab308;">{{allocation.medium}}%</div>
          </td>
          <td>
            <div class="bar-container">
              <div class="bar-fill bg-medium" style="width: {{allocation.medium}}%;"></div>
            </div>
          </td>
        </tr>

        <tr>
          <td>
            <div class="alloc-name">Saham / Equity</div>
            <div class="alloc-sub">High Risk • Pertumbuhan</div>
          </td>
          <td class="text-center">
            <div class="alloc-percent" style="color: #ef4444;">{{allocation.high}}%</div>
          </td>
          <td>
            <div class="bar-container">
              <div class="bar-fill bg-high" style="width: {{allocation.high}}%;"></div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="disclaimer-box">
      <div class="disclaimer-title">Disclaimer Penting:</div>
      <div class="disclaimer-text">
        Laporan ini dihasilkan secara otomatis oleh sistem KeuanganKu berdasarkan jawaban kuesioner yang Anda berikan. Hasil ini merupakan gambaran profil risiko umum dan <strong>bukan merupakan rekomendasi produk investasi tertentu secara spesifik</strong>. Keputusan keuangan sebaiknya disesuaikan kembali dengan tujuan keuangan, jangka waktu, dan kondisi pasar terkini. Kami menyarankan Anda untuk berkonsultasi lebih lanjut dengan agen profesional kami sebelum mengambil keputusan investasi.
      </div>
    </div>

    <div class="page-footer">
      <div class="footer-text">Generated by KeuanganKu System</div>
      <div class="footer-text">CONFIDENTIAL • Page 1 of 1</div>
    </div>

  </div>
</body>
</html>
`;