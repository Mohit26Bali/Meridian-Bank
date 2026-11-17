import "server-only";

/**
 * Transactional e-mail through the Resend REST API (https://resend.com/docs/api-reference/emails/send-email).
 * Plain `fetch` — no SDK dependency.
 *
 * Configuration (environment):
 *   RESEND_API_KEY  a *sending-only* API key is enough (least privilege). Never commit it.
 *   EMAIL_FROM      e.g. `Meridian Bank <no-reply@your-verified-domain.com>`.
 *                   Defaults to Resend's sandbox sender `onboarding@resend.dev`, which can only
 *                   deliver to the Resend account owner's own address until you verify a domain.
 *
 * Privacy: this module never logs recipients, subjects, bodies or the API key — only an HTTP status.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type EmailResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: "not_configured" | "rejected" | "network"; status?: number };

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export function getEmailFrom() {
  return process.env.EMAIL_FROM?.trim() || "Meridian Bank <onboarding@resend.dev>";
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

async function postOnce(apiKey: string, message: EmailMessage): Promise<EmailResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: getEmailFrom(),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, reason: "rejected", status: response.status };
    }
    const data = (await response.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: data?.id ?? null };
  } catch {
    return { ok: false, reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends one message. Never throws: callers get a result and decide what to do.
 * Retries once on network errors and 5xx/429 responses (client errors such as 401/403/422 are final).
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "not_configured" };

  // Automated tests must never send real e-mail, even if a developer's .env contains a key.
  if (process.env.NODE_ENV === "test" && process.env.ALLOW_EMAIL_IN_TESTS !== "1") {
    return { ok: false, reason: "not_configured" };
  }

  let result = await postOnce(apiKey, message);
  const retryable =
    !result.ok && (result.reason === "network" || (result.status !== undefined && (result.status >= 500 || result.status === 429)));
  if (retryable) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    result = await postOnce(apiKey, message);
  }

  if (!result.ok) {
    console.error(
      `[email] delivery failed (${result.reason}${result.status ? ` HTTP ${result.status}` : ""})`
    );
  }
  return result;
}
