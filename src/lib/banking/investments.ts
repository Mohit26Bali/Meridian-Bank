export interface InvestmentTerms {
  expectedReturnRate: number;
  maturityMonths: number | null;
  volatile: boolean;
  earlyWithdrawalPenaltyPercent: number;
}

/** Mock rates — not tied to any real market or bank product. */
export const INVESTMENT_TERMS: Record<string, InvestmentTerms> = {
  FIXED_DEPOSIT: { expectedReturnRate: 6.5, maturityMonths: 12, volatile: false, earlyWithdrawalPenaltyPercent: 1 },
  RECURRING_DEPOSIT: { expectedReturnRate: 6, maturityMonths: 12, volatile: false, earlyWithdrawalPenaltyPercent: 1 },
  MUTUAL_FUND: { expectedReturnRate: 10, maturityMonths: null, volatile: true, earlyWithdrawalPenaltyPercent: 0 },
  STOCK: { expectedReturnRate: 9, maturityMonths: null, volatile: true, earlyWithdrawalPenaltyPercent: 0 },
};

/** Deterministic pseudo-randomness so the "market" looks alive without a background job or stored history. */
function seededUnit(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 10_000) / 10_000; // 0..1
}

/**
 * Computes today's value for an active investment. Matured/withdrawn/cancelled
 * investments return their frozen stored value instead — this function is only
 * meaningful for ACTIVE positions.
 */
export function computeCurrentValue(investment: {
  id: string;
  type: string;
  principal: number;
  expectedReturnRate: number;
  startDate: Date;
  maturityDate: Date | null;
}) {
  const now = new Date();
  const asOf = investment.maturityDate && now > investment.maturityDate ? investment.maturityDate : now;
  const elapsedYears = Math.max(0, (asOf.getTime() - investment.startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  const trendValue = investment.principal * (1 + (investment.expectedReturnRate / 100) * elapsedYears);
  const terms = INVESTMENT_TERMS[investment.type];

  if (!terms?.volatile) {
    return trendValue;
  }

  // Deterministic daily wiggle: same seed -> same value until the calendar date changes.
  const todayKey = now.toISOString().slice(0, 10);
  const wiggle = (seededUnit(`${investment.id}:${todayKey}`) * 2 - 1) * 0.06;
  return Math.max(0, trendValue * (1 + wiggle));
}

export function maturityDateFor(type: string, startDate: Date) {
  const terms = INVESTMENT_TERMS[type];
  if (!terms?.maturityMonths) return null;
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + terms.maturityMonths);
  return date;
}

export function formatWithdrawalNotice(penaltyPercent: number) {
  if (penaltyPercent === 0) return null;
  return `Withdrawing before maturity applies a ${penaltyPercent}% penalty on the payout.`;
}
