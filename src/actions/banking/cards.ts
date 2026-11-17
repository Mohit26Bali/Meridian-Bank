"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import { hashPassword } from "@/lib/auth/password";
import {
  startPendingAction,
  loadPendingAction,
  consumePendingAction,
  clearPendingCookie,
  type PendingChannel,
} from "@/lib/auth/pending-action";
import {
  generateCardNumber,
  generateCvv,
  generateCardExpiry,
} from "@/lib/banking/identifiers";
import { encryptSecret } from "@/lib/security/encryption";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  issueCardSchema,
  cardControlsSchema,
  changePinSchema,
  type IssueCardInput,
  type CardControlsInput,
  type ChangePinInput,
} from "@/lib/validations/cards";
import { notifyUser } from "@/lib/notifications";

const MAX_ACTIVE_CARDS_PER_ACCOUNT = 3;

export type IssueCardResult =
  | {
      success: true;
      card: { id: string; number: string; cvv: string; expiryMonth: number; expiryYear: number };
    }
  | { success: false; error: string };

export type CardActionResult = { success: true } | { success: false; error: string };

async function createCardForAccount(userId: string, accountId: string, type: "DEBIT_PHYSICAL" | "DEBIT_VIRTUAL") {
  const number = generateCardNumber();
  const cvv = generateCvv();
  const expiry = generateCardExpiry();

  const card = await prisma.card.create({
    data: {
      userId,
      accountId,
      cardNumberEncrypted: encryptSecret(number),
      cardNumberLastFour: number.slice(-4),
      cvvEncrypted: encryptSecret(cvv),
      expiryMonth: expiry.month,
      expiryYear: expiry.year,
      type,
    },
  });

  return { card, number, cvv, expiry };
}

export async function issueCardAction(input: IssueCardInput): Promise<IssueCardResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const parsed = issueCardSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Choose an account and card type." };
  }

  const account = await prisma.account.findFirst({
    where: { id: parsed.data.accountId, userId: user.id },
  });
  if (!account) return { success: false, error: "Account not found." };
  if (account.status !== "ACTIVE") {
    return { success: false, error: "This account can't have new cards issued right now." };
  }

  const activeCount = await prisma.card.count({
    where: { accountId: account.id, status: { in: ["ACTIVE", "FROZEN"] } },
  });
  if (activeCount >= MAX_ACTIVE_CARDS_PER_ACCOUNT) {
    return {
      success: false,
      error: `This account already has the maximum of ${MAX_ACTIVE_CARDS_PER_ACCOUNT} cards.`,
    };
  }

  const { card, number, cvv, expiry } = await createCardForAccount(
    user.id,
    account.id,
    parsed.data.type
  );

  const { ipAddress, userAgent } = await getRequestContext();
  await writeAuditLog({
    userId: user.id,
    action: "CARD_ISSUED",
    entityType: "Card",
    entityId: card.id,
    ipAddress,
    userAgent,
    metadata: { type: parsed.data.type },
  });

  revalidatePath("/dashboard/cards");

  return {
    success: true,
    card: { id: card.id, number, cvv, expiryMonth: expiry.month, expiryYear: expiry.year },
  };
}

export async function freezeCardAction(cardId: string): Promise<CardActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const card = await prisma.card.findFirst({ where: { id: cardId, userId: user.id } });
  if (!card) return { success: false, error: "Card not found." };
  if (card.status !== "ACTIVE") return { success: false, error: "Only active cards can be frozen." };

  await prisma.card.update({ where: { id: card.id }, data: { status: "FROZEN" } });

  const { ipAddress, userAgent } = await getRequestContext();
  await writeAuditLog({
    userId: user.id,
    action: "CARD_FROZEN",
    entityType: "Card",
    entityId: card.id,
    ipAddress,
    userAgent,
  });

  await notifyUser({
    userId: user.id,
    category: "SECURITY",
    title: "Card frozen",
    body: `Your card ending in ${card.cardNumberLastFour} has been frozen.`,
  });

  revalidatePath("/dashboard/cards");
  return { success: true };
}

export async function unfreezeCardAction(cardId: string): Promise<CardActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const card = await prisma.card.findFirst({ where: { id: cardId, userId: user.id } });
  if (!card) return { success: false, error: "Card not found." };
  if (card.status !== "FROZEN") return { success: false, error: "Only frozen cards can be unfrozen." };

  await prisma.card.update({ where: { id: card.id }, data: { status: "ACTIVE" } });

  const { ipAddress, userAgent } = await getRequestContext();
  await writeAuditLog({
    userId: user.id,
    action: "CARD_UNFROZEN",
    entityType: "Card",
    entityId: card.id,
    ipAddress,
    userAgent,
  });

  await notifyUser({
    userId: user.id,
    category: "SECURITY",
    title: "Card unfrozen",
    body: `Your card ending in ${card.cardNumberLastFour} is active again.`,
  });

  revalidatePath("/dashboard/cards");
  return { success: true };
}

export async function replaceCardAction(cardId: string): Promise<IssueCardResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const oldCard = await prisma.card.findFirst({ where: { id: cardId, userId: user.id } });
  if (!oldCard) return { success: false, error: "Card not found." };
  if (oldCard.status === "REPLACED") {
    return { success: false, error: "This card has already been replaced." };
  }

  const activeCount = await prisma.card.count({
    where: {
      accountId: oldCard.accountId,
      status: { in: ["ACTIVE", "FROZEN"] },
      id: { not: oldCard.id },
    },
  });
  if (activeCount >= MAX_ACTIVE_CARDS_PER_ACCOUNT) {
    return {
      success: false,
      error: `This account already has the maximum of ${MAX_ACTIVE_CARDS_PER_ACCOUNT} cards.`,
    };
  }

  const { card, number, cvv, expiry } = await prisma.$transaction(async (tx) => {
    await tx.card.update({ where: { id: oldCard.id }, data: { status: "REPLACED" } });

    const newNumber = generateCardNumber();
    const newCvv = generateCvv();
    const newExpiry = generateCardExpiry();

    const newCard = await tx.card.create({
      data: {
        userId: user.id,
        accountId: oldCard.accountId,
        cardNumberEncrypted: encryptSecret(newNumber),
        cardNumberLastFour: newNumber.slice(-4),
        cvvEncrypted: encryptSecret(newCvv),
        expiryMonth: newExpiry.month,
        expiryYear: newExpiry.year,
        type: oldCard.type,
        dailyLimit: oldCard.dailyLimit,
        onlinePaymentsEnabled: oldCard.onlinePaymentsEnabled,
        internationalEnabled: oldCard.internationalEnabled,
      },
    });

    return { card: newCard, number: newNumber, cvv: newCvv, expiry: newExpiry };
  });

  const { ipAddress, userAgent } = await getRequestContext();
  await writeAuditLog({
    userId: user.id,
    action: "CARD_REPLACED",
    entityType: "Card",
    entityId: card.id,
    ipAddress,
    userAgent,
    metadata: { replacedCardId: oldCard.id },
  });

  revalidatePath("/dashboard/cards");

  return {
    success: true,
    card: { id: card.id, number, cvv, expiryMonth: expiry.month, expiryYear: expiry.year },
  };
}

export async function updateCardControlsAction(
  input: CardControlsInput
): Promise<CardActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const parsed = cardControlsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Check the card control values." };
  }

  const card = await prisma.card.findFirst({ where: { id: parsed.data.cardId, userId: user.id } });
  if (!card) return { success: false, error: "Card not found." };

  await prisma.card.update({
    where: { id: card.id },
    data: {
      dailyLimit: parsed.data.dailyLimit,
      onlinePaymentsEnabled: parsed.data.onlinePaymentsEnabled,
      internationalEnabled: parsed.data.internationalEnabled,
    },
  });

  revalidatePath("/dashboard/cards");
  return { success: true };
}

// --- PIN change: OTP-confirmed, mirrors the transfer confirmation pattern ---

// The new PIN's hash is kept server-side (pending_actions). Previously it travelled inside a signed —
// but readable — cookie, where a 4-digit PIN could be brute-forced offline from its hash.
const PIN_CHANNEL: PendingChannel = {
  cookieName: "bank_pending_pin_change",
  tokenType: "card_pin_change",
  type: "PIN_CHANGE",
  ttlSeconds: 10 * 60,
};

interface PinChangePayload {
  cardId: string;
  pinHash: string;
}

export async function initiatePinChangeAction(
  input: ChangePinInput
): Promise<CardActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const parsed = changePinSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Check the PIN fields.",
    };
  }

  const card = await prisma.card.findFirst({ where: { id: parsed.data.cardId, userId: user.id } });
  if (!card) return { success: false, error: "Card not found." };
  if (card.status === "REPLACED" || card.status === "BLOCKED") {
    return { success: false, error: "This card can't have its PIN changed." };
  }

  const { success: withinLimit } = checkRateLimit(
    `pin-change:${user.id}`,
    RATE_LIMITS.TRANSFER_INITIATE.limit,
    RATE_LIMITS.TRANSFER_INITIATE.windowMs
  );
  if (!withinLimit) {
    return { success: false, error: "Too many attempts. Please slow down." };
  }

  const pinHash = await hashPassword(parsed.data.pin);
  const pendingId = await startPendingAction(PIN_CHANNEL, user.id, { cardId: card.id, pinHash });

  await issueOtp(user.id, "CARD_PIN_CHANGE", {
    contextRef: pendingId,
    summary: `Change the PIN of your card ending in ${card.cardNumberLastFour}`,
  });
  return { success: true };
}

export async function resendPinChangeOtpAction(): Promise<CardActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const pending = await loadPendingAction<PinChangePayload>(PIN_CHANNEL, user.id);
  if (!pending) {
    return { success: false, error: "Your session expired. Start again." };
  }

  await issueOtp(user.id, "CARD_PIN_CHANGE", { contextRef: pending.id });
  return { success: true };
}

export async function confirmPinChangeAction(input: { code: string }): Promise<CardActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const pending = await loadPendingAction<PinChangePayload>(PIN_CHANNEL, user.id);
  if (!pending) return { success: false, error: "Your session expired. Start again." };

  const { success: withinLimit } = checkRateLimit(
    `pin-change-verify:${user.id}`,
    RATE_LIMITS.TRANSFER_OTP_VERIFY.limit,
    RATE_LIMITS.TRANSFER_OTP_VERIFY.windowMs
  );
  if (!withinLimit) {
    return { success: false, error: "Too many attempts. Please try again later." };
  }

  const otpResult = await verifyOtp(user.id, "CARD_PIN_CHANGE", input.code, {
    contextRef: pending.id,
  });
  if (!otpResult.ok) {
    const messages: Record<string, string> = {
      not_found: "No pending PIN change found. Start again.",
      expired: "This code has expired. Request a new one.",
      too_many_attempts: "Too many incorrect attempts. Start again.",
      incorrect: "That code is incorrect.",
    };
    return { success: false, error: messages[otpResult.reason] };
  }

  // Single use + ownership: consume the pending change and update the caller's own card together.
  const applied = await prisma.$transaction(async (tx) => {
    if (!(await consumePendingAction(tx, pending.id, user.id, "PIN_CHANGE"))) return false;
    const updated = await tx.card.updateMany({
      where: { id: pending.payload.cardId, userId: user.id, status: { notIn: ["REPLACED", "BLOCKED"] } },
      data: { pinHash: pending.payload.pinHash },
    });
    return updated.count === 1;
  });
  await clearPendingCookie(PIN_CHANNEL);
  if (!applied) return { success: false, error: "Your session expired. Start again." };

  const { ipAddress, userAgent } = await getRequestContext();
  await writeAuditLog({
    userId: user.id,
    action: "CARD_PIN_CHANGED",
    entityType: "Card",
    entityId: pending.payload.cardId,
    ipAddress,
    userAgent,
  });

  await notifyUser({
    userId: user.id,
    category: "SECURITY",
    title: "Card PIN changed",
    body: "Your card PIN was changed successfully.",
  });

  revalidatePath("/dashboard/cards");
  return { success: true };
}
