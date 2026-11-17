"use server";

import { revalidatePath } from "next/cache";
import type { Account } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import {
  setPendingTransferCookie,
  getPendingTransfer,
  consumePendingTransfer,
  clearPendingTransferCookie,
  type PendingTransfer,
} from "@/lib/auth/pending-transfer";
import { generateReferenceNumber } from "@/lib/banking/identifiers";
import {
  MAX_SINGLE_TRANSFER_AMOUNT,
  getSentTodayTotal,
  findLikelyDuplicate,
} from "@/lib/banking/limits";
import { ACCOUNT_TYPE_LABEL, formatCurrency, maskAccountNumber } from "@/lib/banking/format";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  internalTransferSchema,
  beneficiaryTransferSchema,
  type InternalTransferInput,
  type BeneficiaryTransferInput,
} from "@/lib/validations/banking";
import { notifyUser } from "@/lib/notifications";

export type InitiateTransferResult =
  | { success: true; requiresOtp: true }
  | { success: false; error: string; duplicate?: true };

export type ConfirmTransferResult =
  | {
      success: true;
      referenceNumber: string;
      amount: number;
      description: string;
    }
  | { success: false; error: string };

async function assertSourceAccount(
  userId: string,
  accountId: string,
  amount: number
): Promise<
  | { ok: true; account: Account }
  | { ok: false; error: string }
> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
  });

  if (!account) return { ok: false, error: "That account could not be found." };
  if (account.status !== "ACTIVE") {
    return { ok: false, error: "This account cannot send transfers right now." };
  }
  if (amount > MAX_SINGLE_TRANSFER_AMOUNT) {
    return {
      ok: false,
      error: `Transfers are capped at ${formatCurrency(MAX_SINGLE_TRANSFER_AMOUNT)} per transaction.`,
    };
  }
  if (Number(account.balance) < amount) {
    return { ok: false, error: "Insufficient balance for this transfer." };
  }

  const sentToday = await getSentTodayTotal(account.id);
  if (sentToday + amount > Number(account.dailyTransferLimit)) {
    return {
      ok: false,
      error: `This transfer would exceed your daily limit of ${formatCurrency(account.dailyTransferLimit.toString())}.`,
    };
  }

  return { ok: true, account };
}

/** One line shown in the e-mail so the user can recognise (or reject) what the code authorises. */
function transferSummary(pending: PendingTransfer) {
  return `Transfer of ${formatCurrency(pending.amount)}${pending.description ? ` — ${pending.description}` : ""}`;
}

async function beginOtpChallenge(userId: string, pending: PendingTransfer) {
  const pendingId = await setPendingTransferCookie(userId, pending);
  // The code is bound to THIS pending transfer, so it cannot confirm any other.
  await issueOtp(userId, "TRANSFER_CONFIRMATION", {
    contextRef: pendingId,
    summary: transferSummary(pending),
  });
}

export async function initiateInternalTransferAction(
  input: InternalTransferInput & { confirmDuplicate?: boolean }
): Promise<InitiateTransferResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const parsed = internalTransferSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Check the transfer details.",
    };
  }

  const { success: withinLimit } = checkRateLimit(
    `transfer-initiate:${user.id}`,
    RATE_LIMITS.TRANSFER_INITIATE.limit,
    RATE_LIMITS.TRANSFER_INITIATE.windowMs
  );
  if (!withinLimit) {
    return { success: false, error: "Too many transfer attempts. Please slow down." };
  }

  const { fromAccountId, toAccountId, amount, description } = parsed.data;

  const sourceCheck = await assertSourceAccount(user.id, fromAccountId, amount);
  if (!sourceCheck.ok) return { success: false, error: sourceCheck.error };

  const destination = await prisma.account.findFirst({
    where: { id: toAccountId, userId: user.id },
  });
  if (!destination) return { success: false, error: "Destination account not found." };
  if (destination.status !== "ACTIVE") {
    return { success: false, error: "The destination account can't receive transfers right now." };
  }

  if (!input.confirmDuplicate) {
    const duplicate = await findLikelyDuplicate({
      senderAccountId: fromAccountId,
      amount,
      receiverAccountId: toAccountId,
    });
    if (duplicate) {
      return {
        success: false,
        duplicate: true,
        error: "You just sent a matching transfer moments ago. Send it again?",
      };
    }
  }

  const finalDescription =
    description ||
    `Transfer to ${ACCOUNT_TYPE_LABEL[destination.accountType] ?? destination.accountType} ${maskAccountNumber(destination.accountNumber)}`;

  await beginOtpChallenge(user.id, {
    kind: "internal",
    fromAccountId,
    toAccountId,
    amount,
    description: finalDescription,
  });

  return { success: true, requiresOtp: true };
}

export async function initiateBeneficiaryTransferAction(
  input: BeneficiaryTransferInput & { confirmDuplicate?: boolean }
): Promise<InitiateTransferResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const parsed = beneficiaryTransferSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Check the transfer details.",
    };
  }

  const { success: withinLimit } = checkRateLimit(
    `transfer-initiate:${user.id}`,
    RATE_LIMITS.TRANSFER_INITIATE.limit,
    RATE_LIMITS.TRANSFER_INITIATE.windowMs
  );
  if (!withinLimit) {
    return { success: false, error: "Too many transfer attempts. Please slow down." };
  }

  const { fromAccountId, beneficiaryId, amount, description } = parsed.data;

  const sourceCheck = await assertSourceAccount(user.id, fromAccountId, amount);
  if (!sourceCheck.ok) return { success: false, error: sourceCheck.error };

  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: beneficiaryId, userId: user.id },
  });
  if (!beneficiary) return { success: false, error: "Payee not found." };
  if (beneficiary.status === "BLOCKED") {
    return { success: false, error: "This payee is blocked and can't receive transfers." };
  }
  if (beneficiary.status !== "VERIFIED") {
    return { success: false, error: "Verify this payee before sending money to them." };
  }

  if (!input.confirmDuplicate) {
    const duplicate = await findLikelyDuplicate({
      senderAccountId: fromAccountId,
      amount,
      receiverBeneficiaryId: beneficiaryId,
    });
    if (duplicate) {
      return {
        success: false,
        duplicate: true,
        error: "You just sent a matching transfer moments ago. Send it again?",
      };
    }
  }

  const finalDescription = description || `Transfer to ${beneficiary.nickname}`;

  await beginOtpChallenge(user.id, {
    kind: "beneficiary",
    fromAccountId,
    beneficiaryId,
    amount,
    description: finalDescription,
  });

  return { success: true, requiresOtp: true };
}

export async function resendTransferOtpAction(): Promise<InitiateTransferResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const pending = await getPendingTransfer(user.id);
  if (!pending) {
    return { success: false, error: "Your transfer session expired. Start again." };
  }

  await issueOtp(user.id, "TRANSFER_CONFIRMATION", {
    contextRef: pending.id,
    summary: transferSummary(pending),
  });
  return { success: true, requiresOtp: true };
}

export async function confirmTransferAction(input: {
  code: string;
}): Promise<ConfirmTransferResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const pending = await getPendingTransfer(user.id);
  if (!pending) {
    return { success: false, error: "Your transfer session expired. Start again." };
  }

  const { success: withinLimit } = checkRateLimit(
    `transfer-otp-verify:${user.id}`,
    RATE_LIMITS.TRANSFER_OTP_VERIFY.limit,
    RATE_LIMITS.TRANSFER_OTP_VERIFY.windowMs
  );
  if (!withinLimit) {
    return { success: false, error: "Too many attempts. Please try again later." };
  }

  const otpResult = await verifyOtp(user.id, "TRANSFER_CONFIRMATION", input.code, {
    contextRef: pending.id,
  });
  if (!otpResult.ok) {
    const messages: Record<string, string> = {
      not_found: "No pending transfer found. Start again.",
      expired: "This code has expired. Request a new one.",
      too_many_attempts: "Too many incorrect attempts. Start again.",
      incorrect: "That code is incorrect.",
    };
    return { success: false, error: messages[otpResult.reason] };
  }

  const { ipAddress, userAgent } = await getRequestContext();
  const referenceNumber = generateReferenceNumber("TRANSFER");

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Single use: claim the pending transfer inside this transaction. A copied cookie, a replay or a
      // concurrent request finds it already consumed. If anything below fails the claim rolls back.
      if (!(await consumePendingTransfer(tx, pending.id, user.id))) {
        throw new Error("PENDING_USED");
      }

      // Re-validate at confirmation time. The checks in the initiate step can be stale by now
      // (and a signed pending-transfer cookie can be replayed), so the daily limit, the source,
      // and the destination/payee are all checked again inside the same database transaction.
      const source = await tx.account.findFirst({
        where: { id: pending.fromAccountId, userId: user.id, status: "ACTIVE" },
      });
      if (!source) throw new Error("SOURCE_UNAVAILABLE");

      const sentToday = await getSentTodayTotal(source.id, tx);
      if (sentToday + pending.amount > Number(source.dailyTransferLimit)) {
        throw new Error("DAILY_LIMIT");
      }

      if (pending.kind === "internal") {
        const destination = await tx.account.findFirst({
          where: { id: pending.toAccountId, userId: user.id, status: "ACTIVE" },
        });
        if (!destination) throw new Error("DESTINATION_UNAVAILABLE");
      } else {
        const payee = await tx.beneficiary.findFirst({
          where: { id: pending.beneficiaryId, userId: user.id, status: "VERIFIED" },
        });
        if (!payee) throw new Error("PAYEE_UNAVAILABLE");
      }

      const debited = await tx.account.updateMany({
        where: {
          id: pending.fromAccountId,
          userId: user.id,
          status: "ACTIVE",
          balance: { gte: pending.amount },
        },
        data: { balance: { decrement: pending.amount } },
      });

      if (debited.count === 0) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const sourceAccount = await tx.account.findUniqueOrThrow({
        where: { id: pending.fromAccountId },
      });

      if (pending.kind === "internal" && pending.toAccountId) {
        await tx.account.update({
          where: { id: pending.toAccountId },
          data: { balance: { increment: pending.amount } },
        });
      }

      return tx.transaction.create({
        data: {
          referenceNumber,
          type: "TRANSFER",
          status: "COMPLETED",
          senderAccountId: pending.fromAccountId,
          receiverAccountId: pending.kind === "internal" ? pending.toAccountId : null,
          receiverBeneficiaryId: pending.kind === "beneficiary" ? pending.beneficiaryId : null,
          amount: pending.amount,
          balanceAfter: sourceAccount.balance,
          currency: sourceAccount.currency,
          description: pending.description,
        },
      });
    });

    await clearPendingTransferCookie();

    await writeAuditLog({
      userId: user.id,
      action: "TRANSFER_COMPLETED",
      entityType: "Transaction",
      entityId: result.id,
      ipAddress,
      userAgent,
      metadata: { amount: pending.amount, referenceNumber, kind: pending.kind },
    });

    await notifyUser({
      userId: user.id,
      category: "TRANSACTION",
      title: "Transfer sent",
      body: `${formatCurrency(pending.amount)} sent — ${pending.description ?? "Transfer"}.`,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/transactions");

    return {
      success: true,
      referenceNumber,
      amount: pending.amount,
      description: pending.description ?? "Transfer",
    };
  } catch (error) {
    const rejections: Record<string, string> = {
      INSUFFICIENT_BALANCE: "Insufficient balance for this transfer.",
      DAILY_LIMIT: "This transfer would exceed your daily transfer limit.",
      SOURCE_UNAVAILABLE: "The source account can't send transfers right now.",
      DESTINATION_UNAVAILABLE: "The destination account can't receive transfers right now.",
      PAYEE_UNAVAILABLE: "This payee is no longer verified. Start again.",
      PENDING_USED: "Your transfer session expired. Start again.",
    };
    if (error instanceof Error && error.message in rejections) {
      await clearPendingTransferCookie();
      return { success: false, error: rejections[error.message] };
    }
    throw error;
  }
}
