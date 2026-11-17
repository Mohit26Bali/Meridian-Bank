import type { OtpPurpose } from "@prisma/client";

/** Escapes text for safe use inside HTML. Every dynamic value in the templates goes through this. */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BRAND = "Meridian Bank";

interface Rendered {
  subject: string;
  text: string;
  html: string;
}

function layout(title: string, bodyHtml: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1f2b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:28px;">
        <tr><td style="font-size:18px;font-weight:700;padding-bottom:16px;">${BRAND}</td></tr>
        <tr><td style="font-size:15px;line-height:1.55;">${bodyHtml}</td></tr>
        <tr><td style="font-size:12px;color:#6b7280;padding-top:24px;border-top:1px solid #e5e7eb;">
          This is a demonstration banking application. No real money is involved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const OTP_COPY: Partial<Record<OtpPurpose, { subject: string; headline: string }>> = {
  SIGNUP_VERIFICATION: { subject: "Verify your email address", headline: "Confirm your email address" },
  TRANSFER_CONFIRMATION: { subject: "Confirm your transfer", headline: "Confirm your transfer" },
  CARD_PIN_CHANGE: { subject: "Confirm your card PIN change", headline: "Confirm your card PIN change" },
  LOGIN_2FA: { subject: "Your sign-in code", headline: "Your sign-in code" },
  PASSWORD_RESET: { subject: "Your password reset code", headline: "Your password reset code" },
  PHONE_VERIFICATION: { subject: "Your verification code", headline: "Your verification code" },
};

export function otpEmail(input: {
  firstName: string;
  code: string;
  purpose: OtpPurpose;
  expiresInMinutes: number;
  /** Optional one-line description of what the code authorises, e.g. "Transfer of $300.00". */
  summary?: string;
}): Rendered {
  const copy = OTP_COPY[input.purpose] ?? { subject: "Your verification code", headline: "Your verification code" };
  const name = input.firstName || "there";
  const summaryText = input.summary ? `\n${input.summary}\n` : "";

  const text =
    `Hi ${name},\n\n${copy.headline}.${summaryText}\n` +
    `Your one-time code is: ${input.code}\n\n` +
    `It expires in ${input.expiresInMinutes} minutes and can be used once.\n` +
    `Never share this code. ${BRAND} will never ask you for it by phone, chat or email.\n` +
    `If you didn't request it, you can ignore this message and consider changing your password.\n`;

  const html = layout(
    copy.headline,
    `<p style="margin:0 0 12px;">Hi ${escapeHtml(name)},</p>
     <p style="margin:0 0 12px;">${escapeHtml(copy.headline)}.</p>
     ${input.summary ? `<p style="margin:0 0 12px;padding:10px 12px;background:#f4f5f7;border-radius:8px;">${escapeHtml(input.summary)}</p>` : ""}
     <p style="margin:0 0 6px;">Your one-time code is:</p>
     <p style="margin:0 0 16px;font-size:30px;font-weight:700;letter-spacing:6px;">${escapeHtml(input.code)}</p>
     <p style="margin:0 0 12px;">It expires in ${input.expiresInMinutes} minutes and can be used once.</p>
     <p style="margin:0;color:#6b7280;font-size:13px;">Never share this code. ${BRAND} will never ask you for it. If you didn't request it, ignore this message and consider changing your password.</p>`
  );

  return { subject: `${copy.subject} — ${BRAND}`, text, html };
}

export function passwordResetEmail(input: {
  firstName: string;
  resetUrl: string;
  expiresInMinutes: number;
}): Rendered {
  const name = input.firstName || "there";
  const text =
    `Hi ${name},\n\nWe received a request to reset your ${BRAND} password.\n\n` +
    `Choose a new password here (the link expires in ${input.expiresInMinutes} minutes and works once):\n${input.resetUrl}\n\n` +
    `If you didn't ask for this, you can ignore this email — your password won't change.\n`;

  const html = layout(
    "Reset your password",
    `<p style="margin:0 0 12px;">Hi ${escapeHtml(name)},</p>
     <p style="margin:0 0 16px;">We received a request to reset your ${BRAND} password.</p>
     <p style="margin:0 0 16px;"><a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;background:#1a56db;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Choose a new password</a></p>
     <p style="margin:0 0 12px;color:#6b7280;font-size:13px;">The link expires in ${input.expiresInMinutes} minutes and works once. If the button doesn't work, copy this address into your browser:<br>${escapeHtml(input.resetUrl)}</p>
     <p style="margin:0;color:#6b7280;font-size:13px;">If you didn't ask for this, ignore this email — your password won't change.</p>`
  );

  return { subject: `Reset your password — ${BRAND}`, text, html };
}
