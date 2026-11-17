import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { otpEmail } from "@/lib/email/templates";
import { generateNumericOtp } from "./tokens";
import type { OtpPurpose } from "@prisma/client";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Keyed hash (HMAC-SHA-256) of the code, bound to the user and purpose. An unsalted SHA-256 of a
 * 6-digit code can be reversed instantly from a leaked table; with a server-side key it cannot.
 */
function hashOtp(userId: string, purpose: OtpPurpose, code: string) {
  const key = process.env.AUTH_SECRET;
  if (!key) throw new Error("AUTH_SECRET is missing.");
  return createHmac("sha256", key).update(`otp:${userId}:${purpose}:${code}`).digest("hex");
}

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export interface IssueOtpOptions {
  /** Ties the code to one pending action (e.g. a specific transfer): it cannot confirm any other. */
  contextRef?: string;
  /** One-line description of what the code authorises; shown in the e-mail so users can spot fraud. */
  summary?: string;
}

/**
 * Creates a one-time code and e-mails it to the user (Resend; see lib/email/send.ts).
 * In development (NODE_ENV !== "production") the code is also printed to the server log so the app is
 * usable without a mail provider. In production the code is NEVER logged.
 * Delivery problems never throw: the user can request another code.
 */
export async function issueOtp(userId: string, purpose: OtpPurpose, options: IssueOtpOptions = {}) {
  const code = generateNumericOtp(6);

  await prisma.otpCode.create({
    data: {
      userId,
      purpose,
      codeHash: hashOtp(userId, purpose, code),
      contextRef: options.contextRef,
      maxAttempts: MAX_ATTEMPTS,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true },
  });

  let delivered = false;
  if (user) {
    const message = otpEmail({
      firstName: user.firstName,
      code,
      purpose,
      expiresInMinutes: OTP_TTL_MS / 60_000,
      summary: options.summary,
    });
    const result = await sendEmail({ to: user.email, ...message });
    delivered = result.ok;
    if (!result.ok && process.env.NODE_ENV === "production") {
      console.error(`[otp] could not deliver a ${purpose} code (${result.reason}); the user can request a new one`);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[mock-otp] user=${userId} purpose=${purpose} code=${code}`);
  }

  return { code, delivered, expiresInSeconds: OTP_TTL_MS / 1000 };
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "incorrect" };

export async function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string,
  options: { contextRef?: string } = {}
): Promise<OtpVerifyResult> {
  const otp = await prisma.otpCode.findFirst({
    where: {
      userId,
      purpose,
      consumedAt: null,
      ...(options.contextRef ? { contextRef: options.contextRef } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { ok: false, reason: "not_found" };
  if (otp.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (otp.attempts >= otp.maxAttempts) {
    return { ok: false, reason: "too_many_attempts" };
  }

  if (!safeEqualHex(otp.codeHash, hashOtp(userId, purpose, code))) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "incorrect" };
  }

  // Claim the code atomically: of several concurrent submissions of the same code (double-click,
  // parallel requests) exactly one succeeds; the others see count === 0 and are rejected.
  const claimed = await prisma.otpCode.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (claimed.count === 0) return { ok: false, reason: "not_found" };

  return { ok: true };
}
