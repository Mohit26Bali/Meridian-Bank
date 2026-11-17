import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, getEmailFrom, isEmailConfigured } from "./send";
import { otpEmail, passwordResetEmail, escapeHtml } from "./templates";

const message = { to: "customer@example.com", subject: "Hello", text: "plain", html: "<p>html</p>" };
const okResponse = () => new Response(JSON.stringify({ id: "email-123" }), { status: 200 });

describe("sendEmail (Resend)", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key_abcdefghijklmnop");
    vi.stubEnv("ALLOW_EMAIL_IN_TESTS", "1");
    vi.stubEnv("EMAIL_FROM", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POSTs to the Resend API with a bearer key and the message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendEmail(message)).toEqual({ ok: true, id: "email-123" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test_key_abcdefghijklmnop");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ to: ["customer@example.com"], subject: "Hello", text: "plain", html: "<p>html</p>" });
    expect(body.from).toBe("Meridian Bank <onboarding@resend.dev>");
  });

  it("uses EMAIL_FROM when configured", async () => {
    vi.stubEnv("EMAIL_FROM", "Meridian <no-reply@example.org>");
    expect(getEmailFrom()).toBe("Meridian <no-reply@example.org>");
  });

  it("does nothing (and does not call the network) without an API key", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(isEmailConfigured()).toBe(false);
    expect(await sendEmail(message)).toEqual({ ok: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never sends from automated tests unless explicitly allowed", async () => {
    vi.stubEnv("ALLOW_EMAIL_IN_TESTS", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendEmail(message)).toEqual({ ok: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries once on a server error and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("boom", { status: 503 }))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendEmail(message)).toEqual({ ok: true, id: "email-123" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry client errors, and logs neither the key nor the recipient", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendEmail(message)).toEqual({ ok: false, reason: "rejected", status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).toContain("403");
    expect(logged).not.toContain("re_test_key");
    expect(logged).not.toContain("customer@example.com");
  });

  it("reports a network failure after one retry without throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendEmail(message)).toEqual({ ok: false, reason: "network" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("email templates", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;"
    );
  });

  it("OTP e-mail contains the code in both parts and never injects raw HTML", () => {
    const mail = otpEmail({
      firstName: `<img src=x onerror=alert(1)>`,
      code: "482913",
      purpose: "TRANSFER_CONFIRMATION",
      expiresInMinutes: 5,
      summary: `Transfer of $300.00 — <b>rent</b>`,
    });
    expect(mail.subject).toMatch(/Confirm your transfer/);
    expect(mail.text).toContain("482913");
    expect(mail.html).toContain("482913");
    expect(mail.text).toContain("Transfer of $300.00");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).not.toContain("<b>rent</b>");
    expect(mail.html).toContain("&lt;b&gt;rent&lt;/b&gt;");
    expect(mail.text).toMatch(/Never share this code/);
  });

  it("OTP e-mail has a sensible subject for every purpose", () => {
    for (const purpose of ["SIGNUP_VERIFICATION", "TRANSFER_CONFIRMATION", "CARD_PIN_CHANGE", "LOGIN_2FA", "PASSWORD_RESET"] as const) {
      expect(otpEmail({ firstName: "A", code: "123456", purpose, expiresInMinutes: 5 }).subject).toMatch(/Meridian Bank/);
    }
  });

  it("password-reset e-mail carries the link in text and (escaped) in HTML", () => {
    const url = "http://localhost:3000/reset-password?token=abc_DEF-123&x=1";
    const mail = passwordResetEmail({ firstName: "Sam", resetUrl: url, expiresInMinutes: 30 });
    expect(mail.text).toContain(url);
    expect(mail.html).toContain("token=abc_DEF-123&amp;x=1");
    expect(mail.subject).toMatch(/Reset your password/);
  });
});
