import "server-only";
import { cookies } from "next/headers";
import { signPurposeToken, verifyPurposeToken } from "./tokens";

const COOKIE_NAME = "bank_pending_verification";
const TTL_SECONDS = 10 * 60;
const TOKEN_TYPE = "email_verification";

export async function setPendingVerificationCookie(userId: string) {
  const token = await signPurposeToken({ sub: userId, typ: TOKEN_TYPE }, TTL_SECONDS);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function getPendingVerificationUserId() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const claims = await verifyPurposeToken(token, TOKEN_TYPE);
    return claims.sub;
  } catch {
    return null;
  }
}

export async function clearPendingVerificationCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
