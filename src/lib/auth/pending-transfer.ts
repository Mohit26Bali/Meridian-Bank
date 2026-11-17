import "server-only";
import type { Prisma } from "@prisma/client";
import {
  startPendingAction,
  loadPendingAction,
  consumePendingAction,
  clearPendingCookie,
  type PendingChannel,
} from "./pending-action";

export interface PendingTransfer {
  kind: "internal" | "beneficiary";
  fromAccountId: string;
  toAccountId?: string;
  beneficiaryId?: string;
  amount: number;
  description?: string;
}

const CHANNEL: PendingChannel = {
  cookieName: "bank_pending_transfer",
  tokenType: "transfer_confirmation",
  type: "TRANSFER",
  ttlSeconds: 10 * 60,
};

/** Stores the transfer server-side, sets the signed reference cookie and returns the pending id. */
export async function setPendingTransferCookie(userId: string, transfer: PendingTransfer) {
  return startPendingAction(CHANNEL, userId, transfer as unknown as Prisma.InputJsonObject);
}

export async function getPendingTransfer(userId: string) {
  const pending = await loadPendingAction<PendingTransfer>(CHANNEL, userId);
  return pending ? { ...pending.payload, id: pending.id } : null;
}

/** Call inside the transaction that moves the money. */
export function consumePendingTransfer(
  client: Pick<Prisma.TransactionClient, "pendingAction">,
  id: string,
  userId: string
) {
  return consumePendingAction(client, id, userId, "TRANSFER");
}

export async function clearPendingTransferCookie() {
  await clearPendingCookie(CHANNEL);
}
