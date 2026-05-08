// ATO 2024-25 income tax + Medicare levy (2%)
export function calcAusTax(income: number): number {
  if (income <= 0) return 0;
  const medicare = income * 0.02;
  if (income <= 18_200) return medicare;
  if (income <= 45_000) return (income - 18_200) * 0.19 + medicare;
  if (income <= 135_000) return 5_092 + (income - 45_000) * 0.325 + medicare;
  if (income <= 190_000) return 34_317 + (income - 135_000) * 0.37 + medicare;
  return 54_697 + (income - 190_000) * 0.45 + medicare;
}

// Returns the marginal rate bracket (%) for a given income
export function marginalRateForIncome(income: number): number {
  if (income <= 18_200) return 0;
  if (income <= 45_000) return 19;
  if (income <= 135_000) return 32.5;
  if (income <= 190_000) return 37;
  return 45;
}
