import { CreateFinancialRecordDto } from '../dto/create-financial-record.dto';
import { CreatePensionDto } from '../dto/create-pension.dto';
import { CreateInsuranceDto } from '../dto/create-insurance.dto';
import { CreateGoalDto, SimulateGoalDto } from '../dto/create-goal.dto';
import { CreateEducationPlanDto } from '../dto/create-education.dto';
import { CreateBudgetDto } from '../dto/create-budget.dto';
import { SchoolLevel, CostType } from '@prisma/client';
import { RiskAnswerOption } from '../dto/calculate-risk-profile.dto';
import { RiskProfileCategory } from '../dto/risk-profile-response.dto';

// --- INTERFACES (Mirroring FE logic) ---
export interface RatioDetail {
  id: string;
  label: string;
  value: number;
  benchmark: string;
  statusColor: 'GREEN_DARK' | 'GREEN_LIGHT' | 'YELLOW' | 'RED';
  recommendation: string;
  status?: string;
}

export interface HealthAnalysisResult {
  score: number;
  globalStatus: 'SEHAT' | 'WASPADA' | 'BAHAYA';
  ratios: RatioDetail[];
  netWorth: number; // H. Kekayaan Bersih
  surplusDeficit: number; // Q. Surplus/Defisit
  generatedAt: string;
  incomeFixed?: number;
  incomeVariable?: number;
}

// ============================================================================
// 1. FINANCIAL HEALTH CHECK UP ENGINE
// ============================================================================

export const calculateFinancialHealth = (
  data: CreateFinancialRecordDto,
): HealthAnalysisResult => {
  // --- 1. AGGREGATION (PENGGABUNGAN DATA) ---

  const val = (n: number) => Number(n) || 0;

  // --- A. TOTAL ASET (STOCK) ---
  const totalLiquid = val(data.assetCash);

  const totalPersonal =
    val(data.assetHome) +
    val(data.assetVehicle) +
    val(data.assetJewelry) +
    val(data.assetAntique) +
    val(data.assetPersonalOther);

  const totalInvestment =
    val(data.assetInvHome) +
    val(data.assetInvVehicle) +
    val(data.assetGold) +
    val(data.assetInvAntique) +
    val(data.assetStocks) +
    val(data.assetMutualFund) +
    val(data.assetBonds) +
    val(data.assetDeposit) +
    val(data.assetInvOther);

  const totalAssets = totalLiquid + totalPersonal + totalInvestment;

  // --- B. TOTAL UTANG (STOCK) ---
  const totalConsumptiveDebt =
    val(data.debtKPR) +
    val(data.debtKPM) +
    val(data.debtCC) +
    val(data.debtCoop) +
    val(data.debtConsumptiveOther);

  const totalBusinessDebt = val(data.debtBusiness);
  const totalDebt = totalConsumptiveDebt + totalBusinessDebt;

  // --- C. KEKAYAAN BERSIH ---
  const netWorth = totalAssets - totalDebt;

  // --- D. ARUS KAS TAHUNAN (FLOW) ---
  const totalAnnualIncome = (val(data.incomeFixed) + val(data.incomeVariable)) * 12;

  const totalConsumptiveInstallment =
    (val(data.installmentKPR) +
      val(data.installmentKPM) +
      val(data.installmentCC) +
      val(data.installmentCoop) +
      val(data.installmentConsumptiveOther)) * 12;

  const totalAnnualInstallment = totalConsumptiveInstallment + (val(data.installmentBusiness) * 12);

  const totalInsurance =
    (val(data.insuranceLife) +
      val(data.insuranceHealth) +
      val(data.insuranceHome) +
      val(data.insuranceVehicle) +
      val(data.insuranceBPJS) +
      val(data.insuranceOther)) * 12;

  const totalAnnualSaving =
    (val(data.savingEducation) +
      val(data.savingRetirement) +
      val(data.savingPilgrimage) +
      val(data.savingHoliday) +
      val(data.savingEmergency) +
      val(data.savingOther)) * 12;

  const totalFamilyExpense =
    (val(data.expenseFood) +
      val(data.expenseSchool) +
      val(data.expenseTransport) +
      val(data.expenseCommunication) +
      val(data.expenseHelpers) +
      val(data.expenseLifestyle) +
      val(data.expenseTax)) * 12;

  const totalAnnualExpense = totalAnnualInstallment + totalInsurance + totalAnnualSaving + totalFamilyExpense;
  const monthlyExpense = totalAnnualExpense / 12;
  const surplusDeficit = (totalAnnualIncome - totalAnnualExpense) / 12;

  // --- 2. PERHITUNGAN 8 RASIO (STANDARISASI BEST PRACTICE) ---
  const ratios: RatioDetail[] = [];

  // #1. RASIO DANA DARURAT (A / P) | Target: 3-6x (Range Threshold)
  const r1 = monthlyExpense > 0 ? totalLiquid / monthlyExpense : 0;
  let s1: any = 'RED';
  let rec1 = 'Dana darurat Anda belum ideal (< 3x). Mulai alokasikan porsi khusus dari penghasilan untuk antisipasi krisis.';

  if (r1 >= 3 && r1 <= 6) {
    s1 = 'GREEN_DARK';
    rec1 = 'Dana darurat berada pada kondisi sangat ideal (3-6x pengeluaran). Perlindungan keuangan Anda memadai.';
  } else if (r1 > 6 && r1 <= 12) {
    s1 = 'GREEN_LIGHT';
    rec1 = 'Kondisi dana darurat sangat aman. Anda dapat mulai memikirkan instrumen investasi untuk dana lebihnya.';
  } else if (r1 > 12) {
    s1 = 'YELLOW';
    rec1 = 'Dana darurat Anda sangat berlebih. Ini kurang efisien karena tergerus inflasi. Segera alihkan ke instrumen investasi produktif.';
  } else {
    s1 = 'RED';
  }

  ratios.push({
    id: 'emergency_fund',
    label: 'Rasio Dana Darurat',
    value: parseFloat(r1.toFixed(1)),
    benchmark: '3 - 6 kali',
    statusColor: s1,
    recommendation: rec1,
  });

  // #2. RASIO LIKUIDITAS vs NET WORTH (A / H) | Target: Min 15%
  const r2 = netWorth > 0 ? (totalLiquid / netWorth) * 100 : 0;
  let s2: any = 'RED';
  let rec2 = 'Likuiditas Anda di bawah standar aman (< 10%). Risiko tinggi bila butuh uang tunai mendadak. Tingkatkan aset likuid Anda.';

  if (r2 >= 25) {
    s2 = 'GREEN_DARK';
    rec2 = 'Likuiditas sangat prima. Aset tunai Anda mendominasi dan sangat siap digunakan kapan saja.';
  } else if (r2 >= 15) {
    s2 = 'GREEN_LIGHT';
    rec2 = 'Likuiditas seimbang. Memenuhi standar aman tanpa banyak dana menganggur.';
  } else if (r2 >= 10) {
    s2 = 'YELLOW';
    rec2 = 'Likuiditas mendekati batas minimum. Berhati-hati bila ada pengeluaran besar mendadak.';
  } else {
    s2 = 'RED';
  }

  ratios.push({
    id: 'liq_networth',
    label: 'Likuiditas vs Net Worth',
    value: parseFloat(r2.toFixed(1)),
    benchmark: 'Min 15%',
    statusColor: s2,
    recommendation: rec2,
  });

  // #3. RASIO TABUNGAN (M / I) | Target: Min 10% (Fixed Bug)
  const r3 = totalAnnualIncome > 0 ? (totalAnnualSaving / totalAnnualIncome) * 100 : 0;
  let s3: any = 'RED';
  let rec3 = 'Rasio menabung Anda kritis (< 5%). Tekan pengeluaran gaya hidup agar dapat menyisihkan dana masa depan.';

  if (r3 >= 20) {
    s3 = 'GREEN_DARK';
    rec3 = 'Disiplin menabung Anda sangat luar biasa. Ruang untuk mencapai kemandirian finansial sangat terbuka lebar.';
  } else if (r3 >= 10) {
    s3 = 'GREEN_LIGHT';
    rec3 = 'Rasio tabungan sudah berada di jalur yang benar dan memenuhi standar minimum.';
  } else if (r3 >= 5) {
    s3 = 'YELLOW';
    rec3 = 'Porsi menabung belum memenuhi target minimum 10%. Periksa kembali alokasi pengeluaran Anda.';
  } else {
    s3 = 'RED';
  }

  ratios.push({
    id: 'saving_ratio',
    label: 'Rasio Tabungan',
    value: parseFloat(r3.toFixed(1)),
    benchmark: 'Min 10%',
    statusColor: s3,
    recommendation: rec3,
  });

  // #4. RASIO UTANG vs ASET (G / D) | Target: Maks 50%
  const r4 = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;
  let s4: any = 'RED';
  let rec4 = 'Bahaya! Utang mendominasi lebih dari 50% total aset Anda. Risiko kebangkrutan sangat tinggi.';

  if (r4 <= 15) {
    s4 = 'GREEN_DARK';
    rec4 = 'Struktur utang sangat ringan. Kondisi aset sangat mendominasi liabilitas.';
  } else if (r4 <= 35) {
    s4 = 'GREEN_LIGHT';
    rec4 = 'Rasio utang masih dalam zona terkontrol dan tidak membebani pertumbuhan aset.';
  } else if (r4 <= 50) {
    s4 = 'YELLOW';
    rec4 = 'Porsi utang mendekati limit maksimal perbankan. Hentikan penambahan utang baru.';
  } else {
    s4 = 'RED';
  }

  ratios.push({
    id: 'debt_asset_ratio',
    label: 'Rasio Utang vs Aset',
    value: parseFloat(r4.toFixed(1)),
    benchmark: 'Maks 50%',
    statusColor: s4,
    recommendation: rec4,
  });

  // #5. RASIO CICILAN UTANG TOTAL (K / I) | Target: Maks 35%
  const r5 = totalAnnualIncome > 0 ? (totalAnnualInstallment / totalAnnualIncome) * 100 : 0;
  let s5: any = 'RED';
  let rec5 = 'Beban cicilan melampaui standar keamanan (DBR > 35%). Risiko gagal bayar dan arus kas macet sangat tinggi.';

  if (r5 <= 15) {
    s5 = 'GREEN_DARK';
    rec5 = 'Beban cicilan bulanan sangat ringan. Memberikan kebebasan untuk arus kas dan investasi.';
  } else if (r5 <= 25) {
    s5 = 'GREEN_LIGHT';
    rec5 = 'Beban cicilan berada pada batas yang wajar dan aman secara finansial.';
  } else if (r5 <= 35) {
    s5 = 'YELLOW';
    rec5 = 'Cicilan mendekati ambang batas toleransi. Hindari pengambilan kredit baru agar tidak terjebak defisit.';
  } else {
    s5 = 'RED';
  }

  ratios.push({
    id: 'debt_service_ratio',
    label: 'Rasio Cicilan Total',
    value: parseFloat(r5.toFixed(1)),
    benchmark: 'Maks 35%',
    statusColor: s5,
    recommendation: rec5,
  });

  // #6. RASIO CICILAN KONSUMTIF (J / I) | Target: Maks 15%
  const r6 = totalAnnualIncome > 0 ? (totalConsumptiveInstallment / totalAnnualIncome) * 100 : 0;
  let s6: any = 'RED';
  let rec6 = 'Utang konsumtif (Paylater, CC, dsb) memakan porsi terlalu besar. Segera lunasi utang berbunga tinggi.';

  if (r6 <= 5) {
    s6 = 'GREEN_DARK';
    rec6 = 'Beban utang konsumtif sangat minim. Bukti perilaku finansial yang sehat dan terkontrol.';
  } else if (r6 <= 10) {
    s6 = 'GREEN_LIGHT';
    rec6 = 'Porsi utang konsumtif wajar dan tidak mengganggu arus kas secara signifikan.';
  } else if (r6 <= 15) {
    s6 = 'YELLOW';
    rec6 = 'Cicilan konsumtif menyentuh batas toleransi. Lakukan pengendalian belanja impulsif.';
  } else {
    s6 = 'RED';
  }

  ratios.push({
    id: 'consumptive_ratio',
    label: 'Rasio Utang Konsumtif',
    value: parseFloat(r6.toFixed(1)),
    benchmark: 'Maks 15%',
    statusColor: s6,
    recommendation: rec6,
  });

  // #7. RASIO ASET INVESTASI (C / H) | Target: Min 50%
  const r7 = netWorth > 0 ? (totalInvestment / netWorth) * 100 : 0;
  let s7: any = 'RED';
  let rec7 = 'Hampir seluruh aset Anda bersifat konsumtif/menganggur (< 15%). Segera susun portofolio investasi agar uang bekerja untuk Anda.';

  if (r7 >= 50) {
    s7 = 'GREEN_DARK';
    rec7 = 'Luar biasa! Mayoritas kekayaan Anda bekerja memproduksi hasil (Investasi). Teruskan strategi ini.';
  } else if (r7 >= 30) {
    s7 = 'GREEN_LIGHT';
    rec7 = 'Kondisi cukup baik dengan porsi investasi yang sedang berkembang.';
  } else if (r7 >= 15) {
    s7 = 'YELLOW';
    rec7 = 'Porsi aset produktif masih minim. Alihkan fokus dari aset konsumtif ke investasi riil/finansial.';
  } else {
    s7 = 'RED';
  }

  ratios.push({
    id: 'invest_asset_ratio',
    label: 'Rasio Aset Investasi',
    value: parseFloat(r7.toFixed(1)),
    benchmark: 'Min 50%',
    statusColor: s7,
    recommendation: rec7,
  });

  // #8. RASIO SOLVABILITAS (H / D) | Target: Min 50%
  const r8 = totalAssets > 0 ? (netWorth / totalAssets) * 100 : 0;
  let s8: any = 'RED';
  let rec8 = 'Solvabilitas kritis (< 30%). Hampir seluruh aset Anda dibiayai oleh utang. Risiko kebangkrutan mengancam.';

  if (r8 >= 75) {
    s8 = 'GREEN_DARK';
    rec8 = 'Fondasi solvabilitas sangat kokoh. Modal pribadi sangat mendominasi dibandingkan kewajiban utang.';
  } else if (r8 >= 50) {
    s8 = 'GREEN_LIGHT';
    rec8 = 'Kondisi solvabilitas aman. Rasio kepemilikan aset bersih memenuhi batas sehat.';
  } else if (r8 >= 30) {
    s8 = 'YELLOW';
    rec8 = 'Kondisi mulai rentan karena utang membiayai porsi yang cukup besar dari aset Anda.';
  } else {
    s8 = 'RED';
  }

  ratios.push({
    id: 'solvency_ratio',
    label: 'Rasio Solvabilitas',
    value: parseFloat(r8.toFixed(1)),
    benchmark: 'Min 50%',
    statusColor: s8,
    recommendation: rec8,
  });

  // =================================================================
  // 3. HITUNG SKOR KESEHATAN (WEIGHTED DISTRIBUTION LOGIC)
  // =================================================================
  const SCORE_WEIGHTS: Record<string, number> = {
    GREEN_DARK: 100,
    GREEN_LIGHT: 85,
    YELLOW: 50,
    RED: 15,
  };

  let totalPoints = 0;
  const totalRatios = ratios.length;
  let redCount = 0;

  ratios.forEach((r) => {
    const points = SCORE_WEIGHTS[r.statusColor] || 0;
    totalPoints += points;
    if (r.statusColor === 'RED') redCount++;
  });

  let score = totalRatios > 0 ? Math.round(totalPoints / totalRatios) : 0;
  let globalStatus: 'SEHAT' | 'WASPADA' | 'BAHAYA';

  if (score >= 80) {
    globalStatus = 'SEHAT';
  } else if (score >= 50) {
    globalStatus = 'WASPADA';
  } else {
    globalStatus = 'BAHAYA';
  }

  // --- LOGIC TAMBAHAN (SAFETY NET) ---
  if (globalStatus === 'SEHAT' && redCount >= 2) {
    globalStatus = 'WASPADA';
    score = 79;
  }

  return {
    score,
    globalStatus,
    ratios,
    netWorth,
    surplusDeficit,
    generatedAt: new Date().toISOString(),
    incomeFixed: val(data.incomeFixed),
    incomeVariable: val(data.incomeVariable),
  };
};

// ============================================================================
// 2. TVM (TIME VALUE OF MONEY) CORE HELPERS
// ============================================================================

export const calculateFV = (rate: number, nper: number, pmt: number, pv: number, type: 0 | 1 = 0) => {
  if (rate === 0) return -(pv + pmt * nper);
  const pow = Math.pow(1 + rate, nper);
  return -((pv * pow) + (pmt * (1 + rate * type) * (pow - 1) / rate));
};

export const calculatePMT = (rate: number, nper: number, pv: number, fv: number = 0, type: 0 | 1 = 0) => {
  if (rate === 0) return -(pv + fv) / nper;
  const pvif = Math.pow(1 + rate, nper);
  return -(rate * (fv + (pv * pvif))) / ((pvif - 1) * (1 + rate * type));
};

export const calculatePensionPlan = (data: CreatePensionDto) => {
  const { currentAge, retirementAge, lifeExpectancy = 80, currentExpense, currentSaving = 0, inflationRate = 5, returnRate = 8 } = data;
  const yearsToRetire = retirementAge - currentAge;
  const retirementDuration = lifeExpectancy - retirementAge;

  if (yearsToRetire <= 0) throw new Error("Usia pensiun harus lebih besar dari usia sekarang");
  if (retirementDuration <= 0) throw new Error("Usia harapan hidup harus lebih besar dari usia pensiun");

  const iRate = inflationRate / 100;
  const rRate = returnRate / 100;
  const nettRate = rRate - iRate;

  const annualExpenseCurrent = currentExpense * 12;
  const futureAnnualExpense = annualExpenseCurrent * Math.pow(1 + iRate, yearsToRetire);

  let totalFundNeeded = 0;
  if (nettRate === 0) {
    totalFundNeeded = futureAnnualExpense * retirementDuration;
  } else {
    const pvadFactor = (1 - Math.pow(1 + nettRate, -retirementDuration)) / nettRate;
    totalFundNeeded = futureAnnualExpense * pvadFactor * (1 + nettRate);
  }

  const fixedExistingFundRate = 0.055;
  const fvExistingFund = currentSaving * Math.pow(1 + fixedExistingFundRate, yearsToRetire);
  const shortfall = Math.max(0, totalFundNeeded - fvExistingFund);

  let annualSaving = 0;
  if (shortfall > 0) {
    if (nettRate === 0) {
      annualSaving = shortfall / yearsToRetire;
    } else {
      const sinkingFundFactor = Math.pow(1 + nettRate, yearsToRetire) - 1;
      annualSaving = (shortfall * nettRate) / sinkingFundFactor;
    }
  }

  return {
    yearsToRetire,
    retirementDuration,
    futureMonthlyExpense: futureAnnualExpense / 12,
    totalFundNeeded,
    fvExistingFund,
    shortfall,
    monthlySaving: annualSaving / 12
  };
};

export const calculateInsurancePlan = (data: CreateInsuranceDto) => {
  const { monthlyExpense, existingDebt = 0, existingCoverage = 0, protectionDuration = 10, inflationRate = 5, returnRate = 7, finalExpense = 0 } = data;
  const iRate = inflationRate / 100;
  const rRate = returnRate / 100;
  const nettRate = rRate - iRate;
  const annualExpense = monthlyExpense * 12;
  const n = protectionDuration;

  let incomeReplacementValue = 0;
  if (nettRate === 0) {
    incomeReplacementValue = annualExpense * n;
  } else {
    const discountFactor = (1 - Math.pow(1 + nettRate, -n)) / nettRate;
    incomeReplacementValue = annualExpense * discountFactor * (1 + nettRate);
  }

  const debtClearanceValue = existingDebt;
  const otherNeeds = finalExpense;
  const totalNeeded = incomeReplacementValue + debtClearanceValue + otherNeeds;
  const coverageGap = Math.max(0, totalNeeded - existingCoverage);

  let recommendation = "";
  if (coverageGap <= 0) {
    recommendation = "Selamat! Nilai perlindungan asuransi Anda saat ini sudah mencukupi kebutuhan keluarga (Biaya Hidup, Hutang, & Biaya Duka).";
  } else {
    const formattedGap = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(coverageGap);
    recommendation = `Keluarga Anda membutuhkan dana tambahan sebesar ${formattedGap} untuk menjaga standar hidup selama ${n} tahun, melunasi hutang, serta mencadangkan biaya akhir hayat jika terjadi risiko. Disarankan menambah UP Asuransi Jiwa Berjangka (Term Life).`;
  }

  return {
    annualExpense,
    nettRatePercentage: (nettRate * 100).toFixed(2),
    incomeReplacementValue,
    debtClearanceValue,
    otherNeeds,
    totalNeeded,
    coverageGap,
    recommendation
  };
};

export const calculateGoalPlan = (data: CreateGoalDto) => {
  const { targetAmount, targetDate, inflationRate = 5, returnRate = 6 } = data;
  const now = new Date();
  const target = new Date(targetDate);
  const monthsDuration = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());

  if (monthsDuration <= 0) {
    throw new Error("Target waktu harus di masa depan");
  }

  const yearsDuration = monthsDuration / 12;
  const futureTargetAmount = targetAmount * Math.pow(1 + (inflationRate / 100), yearsDuration);
  const monthlyRate = (returnRate / 100) / 12;

  const monthlySaving = Math.abs(calculatePMT(monthlyRate, monthsDuration, 0, futureTargetAmount));

  return {
    monthsDuration,
    futureTargetAmount,
    monthlySaving
  };
};

export const calculateGoalSimulation = (data: SimulateGoalDto) => {
  const { currentCost, years, inflationRate = 5, returnRate = 6 } = data;
  const iRate = inflationRate / 100;
  const futureValue = currentCost * Math.pow(1 + iRate, years);
  const monthlyRate = (returnRate / 100) / 12;
  const months = years * 12;

  const monthlySaving = Math.abs(calculatePMT(monthlyRate, months, 0, futureValue));

  return {
    futureValue,
    monthlySaving
  };
};

export function calculateEducationPlan(dto: CreateEducationPlanDto) {
  const inflationRate = (dto.inflationRate || 10) / 100;
  const returnRate = (dto.returnRate || 12) / 100;
  const rRateMonthly = returnRate / 12;

  const stagesBreakdown = dto.stages.map((stage) => {
    let futureCost = 0;

    if (stage.level === SchoolLevel.S2) {
      futureCost = Number(stage.currentCost) * Math.pow(1 + inflationRate, stage.yearsToStart);
    } else if (stage.level === SchoolLevel.S1 && stage.costType === CostType.ANNUAL) {
      const durationS1 = 4;
      let totalS1Cost = 0;
      for (let i = 0; i < durationS1; i++) {
        const yearInflation = stage.yearsToStart + i;
        const costPerYear = Number(stage.currentCost) * Math.pow(1 + inflationRate, yearInflation);
        totalS1Cost += costPerYear;
      }
      futureCost = totalS1Cost;
    } else {
      futureCost = Number(stage.currentCost) * Math.pow(1 + inflationRate, stage.yearsToStart);
    }

    let monthlySavingItem = 0;
    const months = stage.yearsToStart * 12;
    if (months > 0) {
      monthlySavingItem = Math.abs(calculatePMT(rRateMonthly, months, 0, futureCost));
    }

    return {
      ...stage,
      futureCost,
      monthlySaving: monthlySavingItem,
    };
  });

  const totalFutureCost = stagesBreakdown.reduce((acc, item) => acc + item.futureCost, 0);
  const totalMonthlySaving = stagesBreakdown.reduce((acc, item) => acc + item.monthlySaving, 0);

  return {
    totalFutureCost,
    monthlySaving: totalMonthlySaving,
    stagesBreakdown,
  };
}

export const calculateBudgetSplit = (totalIncome: number) => {
  return {
    livingCost: totalIncome * 0.45,
    productiveDebt: totalIncome * 0.20,
    consumptiveDebt: totalIncome * 0.15,
    insurance: totalIncome * 0.10,
    saving: totalIncome * 0.10,
  };
};

export const calculateRiskProfileAnalysis = (answers: RiskAnswerOption[]) => {
  let totalScore = 0;

  for (const answer of answers) {
    switch (answer) {
      case RiskAnswerOption.A:
        totalScore += 1;
        break;
      case RiskAnswerOption.B:
        totalScore += 2;
        break;
      case RiskAnswerOption.C:
        totalScore += 3;
        break;
      default:
        totalScore += 0;
    }
  }

  let profile: RiskProfileCategory;
  let description: string;
  let allocation: { lowRisk: number; mediumRisk: number; highRisk: number };

  if (totalScore <= 16) {
    profile = RiskProfileCategory.KONSERVATIF;
    description = 'Anda lebih mengutamakan keamanan dana dibandingkan pertumbuhan yang tinggi. Fokus utama pada menjaga nilai uang agar tidak berkurang. Strategi: Dominan di instrumen stabil.';
    allocation = { lowRisk: 70, mediumRisk: 30, highRisk: 0 };
  } else if (totalScore <= 23) {
    profile = RiskProfileCategory.MODERAT;
    description = 'Anda berada di posisi seimbang antara keamanan dana dan potensi pertumbuhan. Anda siap menghadapi fluktuasi nilai investasi yang wajar demi hasil yang lebih baik dari inflasi.';
    allocation = { lowRisk: 40, mediumRisk: 40, highRisk: 20 };
  } else {
    profile = RiskProfileCategory.AGRESIF;
    description = 'Anda siap menghadapi fluktuasi nilai investasi yang tinggi demi potensi hasil jangka panjang yang maksimal. Penurunan jangka pendek dianggap wajar dalam mengejar growth.';
    allocation = { lowRisk: 20, mediumRisk: 30, highRisk: 50 };
  }

  return { totalScore, profile, description, allocation };
};