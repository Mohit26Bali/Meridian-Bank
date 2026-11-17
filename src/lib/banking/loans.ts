export interface LoanTerms {
  aprPercent: number;
  minPrincipal: number;
  maxPrincipal: number;
  minTermMonths: number;
  maxTermMonths: number;
}

/** Mock underwriting rates and limits — not tied to any real credit product. */
export const LOAN_TERMS: Record<string, LoanTerms> = {
  PERSONAL: { aprPercent: 12, minPrincipal: 1000, maxPrincipal: 50_000, minTermMonths: 6, maxTermMonths: 60 },
  AUTO: { aprPercent: 8.5, minPrincipal: 5000, maxPrincipal: 100_000, minTermMonths: 12, maxTermMonths: 84 },
  HOME: { aprPercent: 7, minPrincipal: 20_000, maxPrincipal: 750_000, minTermMonths: 60, maxTermMonths: 360 },
  EDUCATION: { aprPercent: 6, minPrincipal: 1000, maxPrincipal: 150_000, minTermMonths: 12, maxTermMonths: 180 },
  BUSINESS: { aprPercent: 10, minPrincipal: 5000, maxPrincipal: 250_000, minTermMonths: 12, maxTermMonths: 120 },
};

/** Standard amortizing-loan EMI formula. */
export function calculateEmi(principal: number, aprPercent: number, termMonths: number) {
  const monthlyRate = aprPercent / 100 / 12;
  if (monthlyRate === 0) return principal / termMonths;

  const factor = Math.pow(1 + monthlyRate, termMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export interface RepaymentInstallment {
  number: number;
  dueDate: Date;
  emi: number;
  principalPortion: number;
  interestPortion: number;
  remainingBalance: number;
  paid: boolean;
}

/** Computed on the fly from the loan's terms — no per-installment rows are persisted. */
export function generateRepaymentSchedule(loan: {
  principal: number;
  interestRateApr: number;
  termMonths: number;
  emiAmount: number;
  disbursedAt: Date | null;
  paidInstallments: number;
}): RepaymentInstallment[] {
  if (!loan.disbursedAt) return [];

  const monthlyRate = loan.interestRateApr / 100 / 12;
  let balance = loan.principal;
  const schedule: RepaymentInstallment[] = [];

  for (let i = 1; i <= loan.termMonths; i++) {
    const interestPortion = balance * monthlyRate;
    const principalPortion = Math.min(loan.emiAmount - interestPortion, balance);
    balance = Math.max(0, balance - principalPortion);

    const dueDate = new Date(loan.disbursedAt);
    dueDate.setMonth(dueDate.getMonth() + i);

    schedule.push({
      number: i,
      dueDate,
      emi: loan.emiAmount,
      principalPortion,
      interestPortion,
      remainingBalance: balance,
      paid: i <= loan.paidInstallments,
    });
  }

  return schedule;
}
