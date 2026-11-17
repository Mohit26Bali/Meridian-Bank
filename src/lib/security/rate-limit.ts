/**
 * In-memory fixed-window rate limiter. Suitable for a single-instance dev/staging
 * deployment. In production, back this with Redis (INCR + EXPIRE) so limits hold
 * across multiple server instances.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodically evict expired buckets so this map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref?.();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { success: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

export const RATE_LIMITS = {
  LOGIN: { limit: 5, windowMs: 15 * 60 * 1000 },
  SIGNUP: { limit: 5, windowMs: 60 * 60 * 1000 },
  OTP_REQUEST: { limit: 3, windowMs: 5 * 60 * 1000 },
  OTP_VERIFY: { limit: 5, windowMs: 5 * 60 * 1000 },
  PASSWORD_RESET_REQUEST: { limit: 3, windowMs: 60 * 60 * 1000 },
  MOCK_DEPOSIT: { limit: 10, windowMs: 60 * 60 * 1000 },
  TRANSFER_INITIATE: { limit: 15, windowMs: 60 * 60 * 1000 },
  TRANSFER_OTP_VERIFY: { limit: 5, windowMs: 10 * 60 * 1000 },
  BENEFICIARY_ADD: { limit: 10, windowMs: 60 * 60 * 1000 },
  LOAN_APPLY: { limit: 5, windowMs: 60 * 60 * 1000 },
  INVESTMENT_CREATE: { limit: 10, windowMs: 60 * 60 * 1000 },
  PASSWORD_CHANGE: { limit: 5, windowMs: 60 * 60 * 1000 },
  KYC_SUBMIT: { limit: 5, windowMs: 60 * 60 * 1000 },
  TWO_FACTOR_VERIFY: { limit: 5, windowMs: 10 * 60 * 1000 },
  ADMIN_ACTION: { limit: 60, windowMs: 60 * 60 * 1000 },
} as const;
