import "server-only";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const ISSUER = "Meridian Bank";

export function generateTotpSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function buildTotpUri(secret: string, email: string) {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

export async function generateTotpQrCodeDataUrl(uri: string) {
  return QRCode.toDataURL(uri, { margin: 1, width: 240 });
}

/** Allows the token to match the previous/next 30s window to absorb clock drift. */
export function verifyTotpToken(secret: string, token: string) {
  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}
