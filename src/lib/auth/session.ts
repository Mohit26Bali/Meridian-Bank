import "server-only";
import { prisma } from "@/lib/db/prisma";
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./tokens";
import {
  setAuthCookies,
  setAccessTokenCookie,
  clearAuthCookies,
  readAuthCookies,
} from "./cookies";

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

async function upsertDevice(userId: string, ctx: RequestContext) {
  if (!ctx.deviceFingerprint) return null;
  return prisma.device.upsert({
    where: {
      userId_fingerprint: { userId, fingerprint: ctx.deviceFingerprint },
    },
    create: {
      userId,
      fingerprint: ctx.deviceFingerprint,
      lastIp: ctx.ipAddress,
      lastSeenAt: new Date(),
    },
    update: {
      lastIp: ctx.ipAddress,
      lastSeenAt: new Date(),
    },
  });
}

/** Creates a session row, mints access + refresh tokens, and sets cookies. */
export async function createSession(
  user: { id: string; role: string },
  ctx: RequestContext,
  rememberMe = false
) {
  const device = await upsertDevice(user.id, ctx);
  const { raw: refreshRaw, hash: refreshHash } = generateRefreshToken();

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: refreshHash,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      deviceId: device?.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });

  const accessToken = await signAccessToken({
    sub: user.id,
    role: user.role,
    sessionId: session.id,
  });

  await setAuthCookies({ accessToken, refreshToken: refreshRaw, rememberMe });

  return { session, accessToken, refreshToken: refreshRaw };
}

/**
 * Verifies the access token cookie and returns the authenticated user, or null.
 * The token must be a real access token AND its session must still be live: revoking a session
 * (sign out, "sign out other devices", password change/reset) takes effect immediately instead of
 * waiting for the 15-minute token to expire.
 */
export async function getCurrentUser() {
  const { accessToken } = await readAuthCookies();
  if (!accessToken) return null;

  try {
    const claims = await verifyAccessToken(accessToken);
    const session = await prisma.session.findUnique({
      where: { id: claims.sessionId },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      session.user.status !== "ACTIVE"
    ) {
      return null;
    }
    return session.user;
  } catch {
    return null;
  }
}

/**
 * Issues a fresh access token for a still-valid session, using the refresh cookie. Called by
 * POST /api/auth/refresh, which the middleware invokes when the 15-minute access cookie has expired —
 * this is what keeps people signed in for the session's lifetime ("remember me": 30 days, otherwise ~7).
 *
 * The refresh token is deliberately NOT rotated on every refresh: with rotation, two requests that
 * refresh at the same moment (very common: a page plus its data requests) race — one rotates the token,
 * the other presents the old one and is wrongly logged out. Instead the session stays server-side
 * revocable (every request re-checks the session row), has an absolute expiry, and the refresh token
 * is stored only as a hash.
 */
export async function refreshSession(ctx: RequestContext) {
  const { refreshToken } = await readAuthCookies();
  if (!refreshToken) return null;

  const session = await prisma.session.findUnique({
    where: { refreshToken: hashToken(refreshToken) },
    include: { user: true },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.user.status !== "ACTIVE"
  ) {
    await clearAuthCookies();
    return null;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: {
      ipAddress: ctx.ipAddress ?? session.ipAddress,
      userAgent: ctx.userAgent ?? session.userAgent,
    },
  });

  const accessToken = await signAccessToken({
    sub: session.user.id,
    role: session.user.role,
    sessionId: session.id,
  });
  await setAccessTokenCookie(accessToken);

  return { user: session.user, accessToken };
}

export async function getActiveSessionsForUser(userId: string) {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { device: true },
    orderBy: { updatedAt: "desc" },
  });
}

/** Identifies which of the user's sessions belongs to the current request, for UI highlighting. */
export async function getCurrentSessionId() {
  const { refreshToken } = await readAuthCookies();
  if (!refreshToken) return null;
  const session = await prisma.session.findUnique({
    where: { refreshToken: hashToken(refreshToken) },
    select: { id: true },
  });
  return session?.id ?? null;
}

export async function revokeCurrentSession() {
  const { refreshToken } = await readAuthCookies();
  if (refreshToken) {
    const refreshHash = hashToken(refreshToken);
    await prisma.session
      .updateMany({
        where: { refreshToken: refreshHash, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
  await clearAuthCookies();
}
