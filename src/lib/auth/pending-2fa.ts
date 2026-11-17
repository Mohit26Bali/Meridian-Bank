import "server-only";
import { cookies } from "next/headers";
import { signPurposeToken, verifyPurposeToken } from "./tokens";

const COOKIE_NAME = "bank_pending_2fa";
const TTL_SECONDS = 5 * 60;
const TOKEN_TYPE = "login_2fa";

export async function setPending2faCookie(userId: string, rememberMe: boolean) {
  const token = await signPurposeToken(
    { sub: userId, typ: TOKEN_TYPE, rememberMe },
    TTL_SECONDS
  );
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function getPending2fa() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const claims = await verifyPurposeToken<{ sub: string; typ: string; rememberMe: boolean }>(
      token,
      TOKEN_TYPE
    );
    return { userId: claims.sub, rememberMe: Boolean(claims.rememberMe) };
  } catch {
    return null;
  }
}

export async function clearPending2faCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
