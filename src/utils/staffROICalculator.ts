export interface StaffROIInputs {
  autoPremium: number;
  homePremium: number;
  commissionRate: number; // team member's commission %
  baseSalary: number;
  payrollTaxRate: number;
  autoCommissionRate: number; // agency's new business rate
  homeCommissionRate: number;
  autoRenewalRate: number;
  homeRenewalRate: number;
  retentionRate: number; // annual retention %
  marketingSpend: number;
  benefits: number; // optional
  promoPayOuts: number; // optional
  autoRenewalPeriod: '6months' | 'annual';
}

export interface StaffROIResults {
  // Month 1
  month1AutoPremium: number;
  month1HomePremium: number;
  month1TotalPremium: number;
  month1AutoRevenue: number;
  month1HomeRevenue: number;
  month1TotalRevenue: number;
  
  // Expenses
  baseSalary: number;
  commissionAmount: number;
  payrollTaxAmount: number;
  marketingSpend: number;
  benefits: number;
  promoPayOuts: number;
  totalExpenses: number;
  
  // Month 1 Net
  month1NetProfitLoss: number;
  
  // 6 Month Renewal (only if autoRenewalPeriod is '6months')
  sixMonthAutoRenewalPremium: number;
  sixMonthAutoRenewalRevenue: number;
  sixMonthNetProfitLoss: number;
  
  // Annual Renewal
  annualAutoRenewalPremium: number;
  annualHomeRenewalPremium: number;
  annualAutoRenewalRevenue: number;
  annualHomeRenewalRevenue: number;
  annualTotalRenewalRevenue: number;
  annualNetProfitLoss: number;
  
  // ROI
  roi: number;
}

export function computeStaffROI(inputs: StaffROIInputs): StaffROIResults {
  const {
    autoPremium,
    homePremium,
    commissionRate,
    baseSalary,
    payrollTaxRate,
    autoCommissionRate,
    homeCommissionRate,
    autoRenewalRate,
    homeRenewalRate,
    retentionRate,
    marketingSpend,
    benefits,
    promoPayOuts,
    autoRenewalPeriod,
  } = inputs;

  // Month 1 calculations
  const month1AutoPremium = autoPremium;
  const month1HomePremium = homePremium;
  const month1TotalPremium = month1AutoPremium + month1HomePremium;
  
  const month1AutoRevenue = month1AutoPremium * (autoCommissionRate / 100);
  const month1HomeRevenue = month1HomePremium * (homeCommissionRate / 100);
  const month1TotalRevenue = month1AutoRevenue + month1HomeRevenue;

  // Expenses
  const commissionAmount = month1TotalPremium * (commissionRate / 100);
  const payrollTaxAmount = (baseSalary + commissionAmount) * (payrollTaxRate / 100);
  const totalExpenses = baseSalary + commissionAmount + payrollTaxAmount + marketingSpend + benefits + promoPayOuts;

  // Month 1 Net
  const month1NetProfitLoss = month1TotalRevenue - totalExpenses;

  // 6 Month Renewal - auto only decays at sqrt of retention (half year)
  const sixMonthRetentionFactor = Math.pow(retentionRate / 100, 0.5);
  const sixMonthAutoRenewalPremium = autoPremium * sixMonthRetentionFactor;
  const sixMonthAutoRenewalRevenue = sixMonthAutoRenewalPremium * (autoRenewalRate / 100);
  const sixMonthNetProfitLoss = month1NetProfitLoss + sixMonthAutoRenewalRevenue;

  // Annual Renewal - both auto and home decay at full retention
  const annualRetentionFactor = retentionRate / 100;
  const annualAutoRenewalPremium = autoPremium * annualRetentionFactor;
  const annualHomeRenewalPremium = homePremium * annualRetentionFactor;
  const annualAutoRenewalRevenue = annualAutoRenewalPremium * (autoRenewalRate / 100);
  const annualHomeRenewalRevenue = annualHomeRenewalPremium * (homeRenewalRate / 100);
  const annualTotalRenewalRevenue = annualAutoRenewalRevenue + annualHomeRenewalRevenue;

  // Calculate annual net based on renewal period
  let annualNetProfitLoss: number;
  if (autoRenewalPeriod === '6months') {
    annualNetProfitLoss = sixMonthNetProfitLoss + annualTotalRenewalRevenue;
  } else {
    annualNetProfitLoss = month1NetProfitLoss + annualTotalRenewalRevenue;
  }

  // ROI: (Total Revenue - Total Expenses) / Total Expenses * 100
  const totalRevenue = autoRenewalPeriod === '6months' 
    ? month1TotalRevenue + sixMonthAutoRenewalRevenue + annualTotalRenewalRevenue
    : month1TotalRevenue + annualTotalRenewalRevenue;
  
  const roi = totalExpenses > 0 ? ((totalRevenue - totalExpenses) / totalExpenses) * 100 : 0;

  return {
    month1AutoPremium,
    month1HomePremium,
    month1TotalPremium,
    month1AutoRevenue,
    month1HomeRevenue,
    month1TotalRevenue,
    baseSalary,
    commissionAmount,
    payrollTaxAmount,
    marketingSpend,
    benefits,
    promoPayOuts,
    totalExpenses,
    month1NetProfitLoss,
    sixMonthAutoRenewalPremium,
    sixMonthAutoRenewalRevenue,
    sixMonthNetProfitLoss,
    annualAutoRenewalPremium,
    annualHomeRenewalPremium,
    annualAutoRenewalRevenue,
    annualHomeRenewalRevenue,
    annualTotalRenewalRevenue,
    annualNetProfitLoss,
    roi,
  };
}

export const DEFAULT_STAFF_ROI_INPUTS: StaffROIInputs = {
  autoPremium: 30000,
  homePremium: 20000,
  commissionRate: 6,
  baseSalary: 3000,
  payrollTaxRate: 8,
  autoCommissionRate: 10,
  homeCommissionRate: 10,
  autoRenewalRate: 10,
  homeRenewalRate: 10,
  retentionRate: 90,
  marketingSpend: 0,
  benefits: 0,
  promoPayOuts: 0,
  autoRenewalPeriod: 'annual',
};
