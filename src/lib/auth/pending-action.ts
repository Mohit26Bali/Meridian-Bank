import "server-only";
import { cookies } from "next/headers";
import type { Prisma, PendingActionType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { signPurposeToken, verifyPurposeToken, type PurposeTokenClaims } from "./tokens";

/**
 * Multi-step actions that wait for a one-time code (a transfer, a card PIN change).
 *
 * The details are stored in the database (`pending_actions`); the browser only holds a SIGNED
 * reference (`pid`) in an httpOnly cookie. Compared with putting the details in the cookie this
 *  - lets the action be consumed exactly once (a copied cookie cannot be replayed),
 *  - keeps sensitive material (e.g. a PIN hash) out of the browser,
 *  - lets the one-time code be bound to this specific action (OtpCode.contextRef = pending id).
 */
export interface PendingChannel {
  cookieName: string;
  tokenType: string;
  type: PendingActionType;
  ttlSeconds: number;
}

type PendingClaims = PurposeTokenClaims & { pid: string };

/** Creates the pending action (retiring any unfinished one of the same kind) and sets the cookie. */
export async function startPendingAction(
  channel: PendingChannel,
  userId: string,
  payload: Prisma.InputJsonObject
): Promise<string> {
  await prisma.pendingAction.updateMany({
    where: { userId, type: channel.type, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const row = await prisma.pendingAction.create({
    data: {
      userId,
      type: channel.type,
      payload,
      expiresAt: new Date(Date.now() + channel.ttlSeconds * 1000),
    },
  });

  const token = await signPurposeToken<PendingClaims>(
    { sub: userId, typ: channel.tokenType, pid: row.id },
    channel.ttlSeconds
  );
  const store = await cookies();
  store.set(channel.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: channel.ttlSeconds,
  });

  return row.id;
}

/** Returns the caller's live (not consumed, not expired) pending action, or null. */
export async function loadPendingAction<T>(
  channel: PendingChannel,
  userId: string
): Promise<{ id: string; payload: T } | null> {
  const store = await cookies();
  const token = store.get(channel.cookieName)?.value;
  if (!token) return null;

  let pid: string;
  try {
    const claims = await verifyPurposeToken<PendingClaims>(token, channel.tokenType);
    if (claims.sub !== userId || typeof claims.pid !== "string") return null;
    pid = claims.pid;
  } catch {
    return null;
  }

  const row = await prisma.pendingAction.findFirst({
    where: { id: pid, userId, type: channel.type, consumedAt: null, expiresAt: { gt: new Date() } },
  });
  return row ? { id: row.id, payload: row.payload as T } : null;
}

/**
 * Marks the action as used. Returns false if someone else already consumed it (or it expired), so call
 * it INSIDE the same transaction as the work it authorises: if that work fails the claim rolls back.
 */
export async function consumePendingAction(
  client: Pick<Prisma.TransactionClient, "pendingAction">,
  id: string,
  userId: string,
  type: PendingActionType
): Promise<boolean> {
  const result = await client.pendingAction.updateMany({
    where: { id, userId, type, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  return result.count === 1;
}

export async function clearPendingCookie(channel: PendingChannel) {
  const store = await cookies();
  store.delete(channel.cookieName);
}
