import { randomBytes, randomInt, createHash } from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const encoder = new TextEncoder();

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set a 32+ character secret in the environment."
    );
  }
  return encoder.encode(secret);
}

export const ACCESS_TOKEN_TTL_SECONDS = Number(
  process.env.AUTH_ACCESS_TOKEN_TTL ?? 900
);
export const REFRESH_TOKEN_TTL_SECONDS = Number(
  process.env.AUTH_REFRESH_TOKEN_TTL ?? 2_592_000
);

/**
 * Every JWT this app signs carries a `typ`. Access tokens use "access"; the short-lived
 * multi-step tokens (login_2fa, email_verification, transfer_confirmation, ...) use their own
 * values. They share one signing key, so the type MUST be checked on verification or a
 * purpose token could be presented as a login token (this was a 2FA bypass).
 * NOTE: src/middleware.ts repeats the literal "access" because it runs on the Edge runtime.
 */
export const ACCESS_TOKEN_TYPE = "access";

export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  role: string;
  sessionId: string;
}

export async function signAccessToken(claims: AccessTokenClaims) {
  return new SignJWT({ ...claims, typ: ACCESS_TOKEN_TYPE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify<AccessTokenClaims & { typ?: string }>(
    token,
    getSecretKey(),
    { algorithms: ["HS256"] }
  );
  if (
    payload.typ !== ACCESS_TOKEN_TYPE ||
    typeof payload.sub !== "string" ||
    typeof payload.sessionId !== "string"
  ) {
    throw new Error("Not an access token");
  }
  return payload;
}

export interface PurposeTokenClaims extends JWTPayload {
  sub: string;
  typ: string;
}

export async function signPurposeToken<T extends PurposeTokenClaims>(
  claims: T,
  ttlSeconds: number
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSecretKey());
}

export async function verifyPurposeToken<T extends PurposeTokenClaims = PurposeTokenClaims>(
  token: string,
  expectedTyp: string
) {
  const { payload } = await jwtVerify<T>(token, getSecretKey());
  if (payload.typ !== expectedTyp) {
    throw new Error("Token purpose mismatch");
  }
  return payload;
}

/** Opaque, high-entropy refresh token. Only the SHA-256 hash is persisted. */
export function generateRefreshToken() {
  const raw = randomBytes(48).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

/** Short-lived, single-use codes: OTP, email verification, password reset. */
export function generateNumericOtp(length = 6) {
  // randomInt is uniform; `randomByte % 10` slightly favoured the digits 0-5.
  let code = "";
  for (let i = 0; i < length; i++) {
    code += randomInt(0, 10).toString();
  }
  return code;
}

export function generateOpaqueToken() {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}
