// Integration tests: call the REAL Server Actions against a throwaway PostgreSQL database
// (created and dropped by test-db.ts). Skipped automatically if PostgreSQL is not reachable.
// Run: npx vitest run src/test/bank.integration.test.ts
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import * as OTPAuth from "otpauth";
import { createTestDatabase } from "./test-db";
import * as nx from "./next-mocks";

vi.mock("next/headers", async () => {
  const m = await import("./next-mocks");
  return { cookies: m.cookies, headers: m.headers };
});
vi.mock("next/cache", async () => {
  const m = await import("./next-mocks");
  return { revalidatePath: m.revalidatePath };
});
vi.mock("next/navigation", async () => {
  const m = await import("./next-mocks");
  return { redirect: m.redirect, notFound: m.notFound };
});

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

// Tests must never send real e-mail (a developer's .env may contain a Resend key) and use per-"browser"
// client IPs (the mock sets X-Forwarded-For; the app only trusts it when TRUSTED_PROXY_HOPS is set).
process.env.RESEND_API_KEY = "";
process.env.TRUSTED_PROXY_HOPS = "1";

const db = await createTestDatabase().catch((error) => {
  console.warn("Integration tests skipped:", (error as Error).message);
  return null;
});

// IMPORTANT: modules that create the Prisma client are imported only AFTER DATABASE_URL points at the
// throwaway database (static imports would be evaluated first and could hit the development database).
async function loadModules() {
  const [prisma, session, tokens, password, provision, encryption, signup, verify, login, logout, forgot, reset, deposit, transfer, bene, cards, loans, invest, kyc, profile, security, tfa, adminUsers, adminKyc] =
    await Promise.all([
      import("@/lib/db/prisma"),
      import("@/lib/auth/session"),
      import("@/lib/auth/tokens"),
      import("@/lib/auth/password"),
      import("@/lib/banking/provision-accounts"),
      import("@/lib/security/encryption"),
      import("@/actions/auth/signup"),
      import("@/actions/auth/verify-email"),
      import("@/actions/auth/login"),
      import("@/actions/auth/logout"),
      import("@/actions/auth/forgot-password"),
      import("@/actions/auth/reset-password"),
      import("@/actions/banking/deposit"),
      import("@/actions/banking/transfer"),
      import("@/actions/banking/beneficiaries"),
      import("@/actions/banking/cards"),
      import("@/actions/banking/loans"),
      import("@/actions/banking/investments"),
      import("@/actions/kyc"),
      import("@/actions/profile"),
      import("@/actions/security"),
      import("@/actions/two-factor"),
      import("@/actions/admin/users"),
      import("@/actions/admin/kyc"),
    ]);
  return { prisma: prisma.prisma, session, tokens, password, provision, encryption, signup, verify, login, logout, forgot, reset, deposit, transfer, bene, cards, loans, invest, kyc, profile, security, tfa, adminUsers, adminKyc };
}

const M = db ? await loadModules() : null;
const suite = M ? describe : describe.skip;

const PASSWORD = "Str0ng!Passw0rd#1";
const NEW_PASSWORD = "An0ther!Passw0rd#2";
const IMG = "data:image/png;base64,iVBORw0KGgo=";

const luhnValid = (num: string) => {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
};

suite("Meridian Bank — real flows on a throwaway database", () => {
  const m = M!;
  const prisma = m.prisma;
  const lastOtp: Record<string, string> = {};
  let lastResetToken = "";
  let seq = 0;
  let passwordHash = "";

  beforeAll(async () => {
    passwordHash = await m.password.hashPassword(PASSWORD);
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      const line = args.join(" ");
      const o = /\[mock-otp\].*purpose=(\w+) code=(\d{6})/.exec(line);
      if (o) lastOtp[o[1]] = o[2];
      const t = /password reset token for \S+: (\S+)/.exec(line);
      if (t) lastResetToken = t[1];
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.$disconnect();
    await db!.drop();
  });

  // ---------- helpers ----------
  async function seedUser(opts: { balance?: number; role?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" | "SUPPORT_AGENT" } = {}) {
    seq += 1;
    const user = await prisma.user.create({
      data: {
        firstName: "Test",
        lastName: `User${seq}`,
        email: `user${seq}@test.example`,
        phone: `+1555000${String(1000 + seq)}`,
        passwordHash,
        status: "ACTIVE",
        emailVerified: true,
        role: opts.role ?? "CUSTOMER",
        kyc: { create: {} },
      },
    });
    const { checking, savings } = await m.provision.provisionDefaultAccounts(user.id);
    if (opts.balance) {
      await prisma.account.update({ where: { id: checking.id }, data: { balance: opts.balance } });
    }
    return { user, checking, savings };
  }
  async function signIn(browser: string, user: { id: string; role: string }) {
    nx.useBrowser(browser);
    await m.session.createSession({ id: user.id, role: user.role }, { ipAddress: "127.0.0.1", userAgent: "vitest" });
  }
  const balanceOf = async (accountId: string) =>
    Number((await prisma.account.findUniqueOrThrow({ where: { id: accountId } })).balance);

  // ====================================================================
  describe("onboarding and authentication", () => {
    it("signup → e-mail OTP → ACTIVE user with Checking+Savings accounts and a session", async () => {
      nx.useBrowser("newbie");
      const r = await m.signup.signupAction({
        firstName: "New", lastName: "Customer", email: "newbie@test.example", phone: "+15559990001",
        password: PASSWORD, confirmPassword: PASSWORD, acceptTerms: true,
      });
      expect(r).toEqual({ success: true });
      const pending = await prisma.user.findUniqueOrThrow({ where: { email: "newbie@test.example" } });
      expect(pending.status).toBe("PENDING_VERIFICATION");
      expect(pending.passwordHash).toMatch(/^\$argon2id\$/);
      expect(nx.getCookie("bank_pending_verification")).toBeTruthy();

      const wrong = await m.verify.verifyEmailAction({ code: lastOtp.SIGNUP_VERIFICATION === "000000" ? "111111" : "000000" });
      expect(wrong).toMatchObject({ success: false });

      expect(await m.verify.verifyEmailAction({ code: lastOtp.SIGNUP_VERIFICATION })).toEqual({ success: true });
      const user = await prisma.user.findUniqueOrThrow({ where: { email: "newbie@test.example" }, include: { accounts: true } });
      expect(user.status).toBe("ACTIVE");
      expect(user.emailVerified).toBe(true);
      expect(user.accounts.map((a) => a.accountType).sort()).toEqual(["CURRENT", "SAVINGS"]);
      expect(user.accounts.every((a) => Number(a.balance) === 0 && /^\d{12}$/.test(a.accountNumber))).toBe(true);
      expect(nx.getCookie("bank_access_token")).toBeTruthy();
      expect((await m.session.getCurrentUser())?.id).toBe(user.id);
    });

    it("rejects weak passwords and duplicate e-mail/phone", async () => {
      nx.useBrowser("dup");
      const base = { firstName: "A", lastName: "B", email: "dup@test.example", phone: "+15559990002", acceptTerms: true as const };
      expect(await m.signup.signupAction({ ...base, password: "short", confirmPassword: "short" })).toMatchObject({ success: false });
      expect(await m.signup.signupAction({ ...base, password: "alllowercase123!", confirmPassword: "alllowercase123!" })).toMatchObject({ success: false });
      expect(await m.signup.signupAction({ ...base, password: PASSWORD, confirmPassword: PASSWORD })).toEqual({ success: true });
      const again = await m.signup.signupAction({ ...base, phone: "+15559990003", password: PASSWORD, confirmPassword: PASSWORD });
      expect(again).toMatchObject({ success: false });
    });

    it("login: success creates a session and history; wrong password gives a generic error", async () => {
      const { user } = await seedUser();
      nx.useBrowser("login1");
      const bad = await m.login.loginAction({ email: user.email, password: "Wrong!Passw0rd#9", rememberMe: false });
      expect(bad).toEqual({ success: false, error: "Incorrect email or password." });
      expect(await m.login.loginAction({ email: "nobody@test.example", password: PASSWORD, rememberMe: false })).toEqual({ success: false, error: "Incorrect email or password." });
      const ok = await m.login.loginAction({ email: user.email, password: PASSWORD, rememberMe: true });
      expect(ok).toMatchObject({ success: true });
      expect(nx.getCookie("bank_access_token") && nx.getCookie("bank_refresh_token")).toBeTruthy();
      expect(await prisma.session.count({ where: { userId: user.id, revokedAt: null } })).toBe(1);
      const history = await prisma.loginHistory.findMany({ where: { userId: user.id } });
      expect(history.some((h) => h.successful)).toBe(true);
      expect(history.some((h) => !h.successful && h.reason === "incorrect_password")).toBe(true);
    });

    it("lockout: 5 wrong passwords lock the account even for the correct password", async () => {
      const { user } = await seedUser();
      nx.useBrowser("lock");
      for (let i = 0; i < 5; i++) {
        await m.login.loginAction({ email: user.email, password: "Wrong!Passw0rd#9", rememberMe: false });
      }
      const locked = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(locked.lockedUntil && locked.lockedUntil > new Date()).toBeTruthy();
      expect(await m.login.loginAction({ email: user.email, password: PASSWORD, rememberMe: false })).toMatchObject({ success: false });
    });

    it("logout revokes the session and clears cookies", async () => {
      const { user } = await seedUser();
      await signIn("out", user);
      await expect(m.logout.logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");
      expect(nx.getCookie("bank_access_token")).toBeUndefined();
      expect(await prisma.session.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
      expect(await m.session.getCurrentUser()).toBeNull();
    });

    it("every money action refuses unauthenticated callers", async () => {
      nx.useBrowser("anon");
      nx.clearCookies();
      const uuid = crypto.randomUUID();
      const results = await Promise.all([
        m.deposit.depositAction({ accountId: uuid, amount: 10 }),
        m.transfer.initiateInternalTransferAction({ fromAccountId: uuid, toAccountId: crypto.randomUUID(), amount: 10 }),
        m.transfer.confirmTransferAction({ code: "123456" }),
        m.loans.applyForLoanAction({ accountId: uuid, type: "PERSONAL", principal: 2000, termMonths: 12 }),
        m.invest.createInvestmentAction({ accountId: uuid, type: "FIXED_DEPOSIT", principal: 100 }),
        m.cards.issueCardAction({ accountId: uuid, type: "DEBIT_VIRTUAL" }),
      ]);
      for (const r of results) expect(r).toMatchObject({ success: false, error: "Please log in again." });
    });
  });

  // ====================================================================
  describe("deposits and transfers", () => {
    it("deposit credits the account and records a transaction; invalid amounts are rejected", async () => {
      const { user, checking } = await seedUser();
      await signIn("dep", user);
      expect(await m.deposit.depositAction({ accountId: checking.id, amount: 250.5, description: "salary" })).toMatchObject({ success: true });
      expect(await balanceOf(checking.id)).toBe(250.5);
      const tx = await prisma.transaction.findFirstOrThrow({ where: { receiverAccountId: checking.id } });
      expect(tx).toMatchObject({ type: "DEPOSIT", status: "COMPLETED", currency: "USD" });
      expect(Number(tx.amount)).toBe(250.5);
      expect(Number(tx.balanceAfter)).toBe(250.5);
      expect(tx.referenceNumber).toMatch(/^DEP-\d{8}-\d{6}$/);
      for (const amount of [0, -5, 50_000.01, 10.123]) {
        expect(await m.deposit.depositAction({ accountId: checking.id, amount })).toMatchObject({ success: false });
      }
      expect(await balanceOf(checking.id)).toBe(250.5);
    });

    it("internal transfer: needs the right OTP, moves money atomically, cannot be replayed", async () => {
      const { user, checking, savings } = await seedUser({ balance: 1000 });
      await signIn("tr1", user);
      expect(await m.transfer.initiateInternalTransferAction({ fromAccountId: checking.id, toAccountId: savings.id, amount: 300, description: "rent" })).toEqual({ success: true, requiresOtp: true });
      expect(nx.getCookie("bank_pending_transfer")).toBeTruthy();
      expect(await balanceOf(checking.id)).toBe(1000); // nothing moved before confirmation

      const wrongCode = lastOtp.TRANSFER_CONFIRMATION === "000000" ? "111111" : "000000";
      expect(await m.transfer.confirmTransferAction({ code: wrongCode })).toMatchObject({ success: false, error: "That code is incorrect." });
      expect(await balanceOf(checking.id)).toBe(1000);

      const code = lastOtp.TRANSFER_CONFIRMATION;
      const done = await m.transfer.confirmTransferAction({ code });
      expect(done).toMatchObject({ success: true, amount: 300, description: "rent" });
      expect(await balanceOf(checking.id)).toBe(700);
      expect(await balanceOf(savings.id)).toBe(300);
      const tx = await prisma.transaction.findFirstOrThrow({ where: { senderAccountId: checking.id } });
      expect(tx).toMatchObject({ type: "TRANSFER", status: "COMPLETED", receiverAccountId: savings.id });
      expect(Number(tx.balanceAfter)).toBe(700);
      expect(nx.getCookie("bank_pending_transfer")).toBeUndefined();
      expect(await m.transfer.confirmTransferAction({ code })).toMatchObject({ success: false });
      expect(await balanceOf(checking.id)).toBe(700);
    });

    it("transfer rules: per-transfer cap, insufficient funds, same account, foreign account, daily limit", async () => {
      const a = await seedUser({ balance: 20_000 });
      const b = await seedUser({ balance: 0 });
      await signIn("tr2", a.user);
      const init = (over: Record<string, unknown>) =>
        m.transfer.initiateInternalTransferAction({ fromAccountId: a.checking.id, toAccountId: a.savings.id, amount: 10, ...over } as never);
      expect(await init({ amount: 5000.01 })).toMatchObject({ success: false, error: expect.stringContaining("capped") });
      expect(await init({ amount: 0 })).toMatchObject({ success: false });
      expect(await init({ amount: 1.005 })).toMatchObject({ success: false });
      expect(await init({ toAccountId: a.checking.id })).toMatchObject({ success: false });
      expect(await init({ toAccountId: b.checking.id })).toMatchObject({ success: false, error: "Destination account not found." });
      expect(await init({ fromAccountId: b.checking.id })).toMatchObject({ success: false, error: "That account could not be found." });
      await prisma.account.update({ where: { id: a.checking.id }, data: { dailyTransferLimit: 1000 } });
      expect(await init({ amount: 1000.5 })).toMatchObject({ success: false, error: expect.stringContaining("daily limit") });
      await prisma.account.update({ where: { id: a.checking.id }, data: { balance: 5 } });
      expect(await init({ amount: 10 })).toMatchObject({ success: false, error: "Insufficient balance for this transfer." });
      await prisma.account.update({ where: { id: a.checking.id }, data: { status: "FROZEN" } });
      expect(await init({ amount: 1 })).toMatchObject({ success: false });
    });

    it("duplicate-transfer warning appears, and confirmDuplicate overrides it", async () => {
      const { user, checking, savings } = await seedUser({ balance: 1000 });
      await signIn("dup2", user);
      const first = { fromAccountId: checking.id, toAccountId: savings.id, amount: 50 };
      await m.transfer.initiateInternalTransferAction(first);
      await m.transfer.confirmTransferAction({ code: lastOtp.TRANSFER_CONFIRMATION });
      expect(await m.transfer.initiateInternalTransferAction(first)).toMatchObject({ success: false, duplicate: true });
      expect(await m.transfer.initiateInternalTransferAction({ ...first, confirmDuplicate: true })).toEqual({ success: true, requiresOtp: true });
    });

    it("payee flow: unverified payee blocked, verified payee debited (money leaves the system)", async () => {
      const { user, checking } = await seedUser({ balance: 500 });
      await signIn("bene", user);
      expect(await m.bene.addBeneficiaryAction({ nickname: "Landlord", bankName: "Other Bank", accountNumber: "123456789012", ifsc: "ABCD0123456" })).toMatchObject({ success: true });
      expect(await m.bene.addBeneficiaryAction({ nickname: "Landlord2", bankName: "Other Bank", accountNumber: "123456789012", ifsc: "ABCD0123456" })).toMatchObject({ success: false });
      const payee = await prisma.beneficiary.findFirstOrThrow({ where: { userId: user.id } });
      const t = { fromAccountId: checking.id, beneficiaryId: payee.id, amount: 120 };
      expect(await m.transfer.initiateBeneficiaryTransferAction(t)).toMatchObject({ success: false, error: "Verify this payee before sending money to them." });
      expect(await m.bene.verifyBeneficiaryAction(payee.id)).toMatchObject({ success: true });
      expect(await m.transfer.initiateBeneficiaryTransferAction(t)).toEqual({ success: true, requiresOtp: true });
      expect(await m.transfer.confirmTransferAction({ code: lastOtp.TRANSFER_CONFIRMATION })).toMatchObject({ success: true });
      expect(await balanceOf(checking.id)).toBe(380);
      const tx = await prisma.transaction.findFirstOrThrow({ where: { senderAccountId: checking.id } });
      expect(tx.receiverBeneficiaryId).toBe(payee.id);
      expect(tx.receiverAccountId).toBeNull();
    });
  });

  // ====================================================================
  describe("cards", () => {
    it("issue → encrypted at rest, Luhn-valid; freeze/unfreeze; replace; max 3 per account; controls", async () => {
      const { user, checking, savings } = await seedUser();
      await signIn("card", user);
      const issued = await m.cards.issueCardAction({ accountId: checking.id, type: "DEBIT_VIRTUAL" });
      if (!issued.success) throw new Error(issued.error);
      expect(issued.card.number).toMatch(/^\d{16}$/);
      expect(luhnValid(issued.card.number)).toBe(true);
      expect(issued.card.cvv).toMatch(/^\d{3}$/);
      const row = await prisma.card.findUniqueOrThrow({ where: { id: issued.card.id } });
      expect(row.cardNumberEncrypted).not.toContain(issued.card.number);
      expect(row.cvvEncrypted).not.toContain(issued.card.cvv);
      expect(m.encryption.decryptSecret(row.cardNumberEncrypted)).toBe(issued.card.number);
      expect(row.cardNumberLastFour).toBe(issued.card.number.slice(-4));

      expect(await m.cards.freezeCardAction(row.id)).toMatchObject({ success: true });
      expect(await m.cards.freezeCardAction(row.id)).toMatchObject({ success: false });
      expect(await m.cards.unfreezeCardAction(row.id)).toMatchObject({ success: true });
      expect(await m.cards.updateCardControlsAction({ cardId: row.id, dailyLimit: 500, onlinePaymentsEnabled: false, internationalEnabled: true })).toMatchObject({ success: true });
      const ctl = await prisma.card.findUniqueOrThrow({ where: { id: row.id } });
      expect([Number(ctl.dailyLimit), ctl.onlinePaymentsEnabled, ctl.internationalEnabled]).toEqual([500, false, true]);

      const replaced = await m.cards.replaceCardAction(row.id);
      if (!replaced.success) throw new Error(replaced.error);
      expect(replaced.card.number).not.toBe(issued.card.number);
      expect((await prisma.card.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("REPLACED");
      expect(await m.cards.replaceCardAction(row.id)).toMatchObject({ success: false });

      for (let i = 0; i < 3; i++) expect(await m.cards.issueCardAction({ accountId: savings.id, type: "DEBIT_PHYSICAL" })).toMatchObject({ success: true });
      expect(await m.cards.issueCardAction({ accountId: savings.id, type: "DEBIT_PHYSICAL" })).toMatchObject({ success: false, error: expect.stringContaining("maximum of 3") });
    });

    it("PIN change needs the OTP and stores only an argon2 hash", async () => {
      const { user, checking } = await seedUser();
      await signIn("pin", user);
      const issued = await m.cards.issueCardAction({ accountId: checking.id, type: "DEBIT_VIRTUAL" });
      if (!issued.success) throw new Error(issued.error);
      expect(await m.cards.initiatePinChangeAction({ cardId: issued.card.id, pin: "1234", confirmPin: "9999" })).toMatchObject({ success: false });
      expect(await m.cards.initiatePinChangeAction({ cardId: issued.card.id, pin: "12a4", confirmPin: "12a4" })).toMatchObject({ success: false });
      expect(await m.cards.initiatePinChangeAction({ cardId: issued.card.id, pin: "4821", confirmPin: "4821" })).toMatchObject({ success: true });
      expect(await m.cards.confirmPinChangeAction({ code: lastOtp.CARD_PIN_CHANGE === "000000" ? "111111" : "000000" })).toMatchObject({ success: false });
      expect(await m.cards.confirmPinChangeAction({ code: lastOtp.CARD_PIN_CHANGE })).toMatchObject({ success: true });
      const row = await prisma.card.findUniqueOrThrow({ where: { id: issued.card.id } });
      expect(row.pinHash).toMatch(/^\$argon2id\$/);
      expect(row.pinHash).not.toContain("4821");
    });
  });

  // ====================================================================
  describe("loans", () => {
    it("approves within bounds, disburses, collects EMIs and closes after the last instalment", async () => {
      const { user, checking } = await seedUser();
      await signIn("loan", user);
      const r = await m.loans.applyForLoanAction({ accountId: checking.id, type: "PERSONAL", principal: 6000, termMonths: 6 });
      if (!r.success || !r.approved) throw new Error("loan was not approved");
      expect(await balanceOf(checking.id)).toBe(6000);
      const loan = await prisma.loan.findFirstOrThrow({ where: { userId: user.id } });
      expect(loan).toMatchObject({ status: "DISBURSED", paidInstallments: 0, termMonths: 6 });
      expect(Number(loan.emiAmount)).toBeCloseTo(r.emiAmount, 1);
      expect(Number(loan.interestRateApr)).toBe(12);
      expect(await prisma.transaction.count({ where: { receiverAccountId: checking.id, type: "DEPOSIT", amount: 6000 } })).toBe(1);

      await prisma.account.update({ where: { id: checking.id }, data: { balance: 10_000 } });
      for (let i = 1; i <= 6; i++) {
        expect(await m.loans.payEmiAction({ loanId: loan.id })).toEqual({ success: true });
        expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).paidInstallments).toBe(i);
      }
      const closed = await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } });
      expect(closed.status).toBe("CLOSED");
      expect(closed.closedAt).not.toBeNull();
      expect(await balanceOf(checking.id)).toBeCloseTo(10_000 - 6 * Number(loan.emiAmount), 2);
      expect(await m.loans.payEmiAction({ loanId: loan.id })).toMatchObject({ success: false });
    });

    it("rejects out-of-bounds applications and refuses EMIs the balance cannot cover", async () => {
      const { user, checking } = await seedUser();
      await signIn("loan2", user);
      expect(await m.loans.applyForLoanAction({ accountId: checking.id, type: "PERSONAL", principal: 500, termMonths: 12 })).toMatchObject({ success: true, approved: false });
      expect(await m.loans.applyForLoanAction({ accountId: checking.id, type: "PERSONAL", principal: 5000, termMonths: 600 })).toMatchObject({ success: true, approved: false });
      expect(await balanceOf(checking.id)).toBe(0);
      expect(await prisma.loan.count({ where: { userId: user.id, status: "REJECTED" } })).toBe(2);
      await m.loans.applyForLoanAction({ accountId: checking.id, type: "AUTO", principal: 20_000, termMonths: 24 });
      await prisma.account.update({ where: { id: checking.id }, data: { balance: 10 } });
      const loan = await prisma.loan.findFirstOrThrow({ where: { userId: user.id, status: "DISBURSED" } });
      expect(await m.loans.payEmiAction({ loanId: loan.id })).toMatchObject({ success: false, error: "Insufficient balance to cover this EMI." });
    });
  });

  // ====================================================================
  describe("investments", () => {
    it("creates (debits), values, and withdraws early with the 1% penalty; no double withdrawal", async () => {
      const { user, checking } = await seedUser({ balance: 5000 });
      await signIn("inv", user);
      expect(await m.invest.createInvestmentAction({ accountId: checking.id, type: "FIXED_DEPOSIT", principal: 1000 })).toEqual({ success: true });
      expect(await balanceOf(checking.id)).toBe(4000);
      const inv = await prisma.investment.findFirstOrThrow({ where: { userId: user.id } });
      expect(inv).toMatchObject({ status: "ACTIVE", type: "FIXED_DEPOSIT" });
      expect(Number(inv.principal)).toBe(1000);
      expect(inv.maturityDate && inv.maturityDate > new Date()).toBeTruthy();
      expect(await m.invest.createInvestmentAction({ accountId: checking.id, type: "STOCK", principal: 999_999 })).toMatchObject({ success: false });

      expect(await m.invest.withdrawInvestmentAction({ investmentId: inv.id, accountId: checking.id })).toEqual({ success: true });
      const bal = await balanceOf(checking.id);
      expect(bal).toBeGreaterThan(4985); // ~ 1000 less 1% penalty
      expect(bal).toBeLessThan(4991);
      expect((await prisma.investment.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("WITHDRAWN");
      expect(await m.invest.withdrawInvestmentAction({ investmentId: inv.id, accountId: checking.id })).toMatchObject({ success: false });
      expect(Math.abs((await balanceOf(checking.id)) - bal)).toBeLessThan(0.0001);
    });
  });

  // ====================================================================
  describe("profile, 2FA, passwords, KYC, admin", () => {
    it("2FA: setup stores an encrypted secret; login then demands a valid TOTP", async () => {
      const { user } = await seedUser();
      await signIn("tfa-a", user);
      const setup = await m.tfa.setupTwoFactorAction();
      if (!setup.success) throw new Error(setup.error);
      const totp = new OTPAuth.TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(setup.secret) });
      expect(await m.tfa.verifyTwoFactorSetupAction({ token: "000000" })).toMatchObject({ success: false });
      expect(await m.tfa.verifyTwoFactorSetupAction({ token: totp.generate() })).toEqual({ success: true });
      const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.twoFactorEnabled).toBe(true);
      expect(row.twoFactorSecret).not.toContain(setup.secret);

      nx.useBrowser("tfa-b");
      const login = await m.login.loginAction({ email: user.email, password: PASSWORD, rememberMe: false });
      expect(login).toMatchObject({ success: true, requires2FA: true });
      expect(nx.getCookie("bank_access_token")).toBeUndefined();
      expect(nx.getCookie("bank_pending_2fa")).toBeTruthy();
      expect(await m.tfa.confirmLogin2FAAction({ token: "000000" })).toMatchObject({ success: false });
      expect(await m.tfa.confirmLogin2FAAction({ token: totp.generate() })).toEqual({ success: true });
      expect(nx.getCookie("bank_access_token")).toBeTruthy();
      expect((await m.session.getCurrentUser())?.id).toBe(user.id);
    });

    it("[regression] a pending-2FA token must NOT work as a login token (2FA bypass)", async () => {
      const { user } = await seedUser();
      await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true, twoFactorSecret: m.encryption.encryptSecret("JBSWY3DPEHPK3PXP") } });
      nx.useBrowser("bypass");
      expect(await m.login.loginAction({ email: user.email, password: PASSWORD, rememberMe: false })).toMatchObject({ requires2FA: true });
      const pending = nx.getCookie("bank_pending_2fa")!;
      nx.setCookieRaw("bank_access_token", pending); // what an attacker with only the password could do
      expect(await m.session.getCurrentUser()).toBeNull();
    });

    it("change password: needs the current one, rotates the hash, old password stops working", async () => {
      const { user } = await seedUser();
      await signIn("pw", user);
      const base = { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD };
      expect(await m.profile.changePasswordAction({ ...base, currentPassword: "Wrong!Passw0rd#9" })).toMatchObject({ success: false, error: "Current password is incorrect." });
      expect(await m.profile.changePasswordAction({ ...base, newPassword: "weak", confirmPassword: "weak" })).toMatchObject({ success: false });
      expect(await m.profile.changePasswordAction({ ...base, newPassword: PASSWORD, confirmPassword: PASSWORD })).toMatchObject({ success: false });
      expect(await m.profile.changePasswordAction(base)).toEqual({ success: true });
      nx.useBrowser("pw2");
      expect(await m.login.loginAction({ email: user.email, password: PASSWORD, rememberMe: false })).toMatchObject({ success: false });
      expect(await m.login.loginAction({ email: user.email, password: NEW_PASSWORD, rememberMe: false })).toMatchObject({ success: true });
    });

    it("[regression] changing the password must immediately sign out other devices", async () => {
      const { user } = await seedUser();
      await signIn("dev-a", user);
      await signIn("dev-b", user);
      nx.useBrowser("dev-a");
      expect(await m.profile.changePasswordAction({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })).toEqual({ success: true });
      expect(await prisma.session.count({ where: { userId: user.id, revokedAt: { not: null } } })).toBe(1); // DB says revoked
      expect((await m.session.getCurrentUser())?.id).toBe(user.id); // this device stays signed in
      nx.useBrowser("dev-b");
      expect(await m.session.getCurrentUser()).toBeNull(); // the other device must be out right away
    });

    it("[regression] revoking a session must invalidate that device's access token", async () => {
      const { user } = await seedUser();
      await signIn("rev-a", user);
      await signIn("rev-b", user);
      const victim = await prisma.session.findFirstOrThrow({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
      nx.useBrowser("rev-a");
      expect(await m.security.revokeSessionAction(victim.id)).toEqual({ success: true });
      nx.useBrowser("rev-b");
      expect(await m.session.getCurrentUser()).toBeNull();
    });

    it("password reset: single-use token, new password works, old one and old sessions die", async () => {
      const { user } = await seedUser();
      await signIn("reset-old", user);
      nx.useBrowser("reset");
      expect(await m.forgot.forgotPasswordAction({ email: user.email })).toEqual({ success: true });
      expect(await m.forgot.forgotPasswordAction({ email: "ghost@test.example" })).toEqual({ success: true }); // no enumeration
      const token = lastResetToken;
      expect(token.length).toBeGreaterThan(20);
      expect(await m.reset.resetPasswordAction({ token: "bogus", password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })).toMatchObject({ success: false });
      expect(await m.reset.resetPasswordAction({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })).toEqual({ success: true });
      expect(await m.reset.resetPasswordAction({ token, password: "Yet!Another1Passw0rd", confirmPassword: "Yet!Another1Passw0rd" })).toMatchObject({ success: false });
      expect(await m.login.loginAction({ email: user.email, password: PASSWORD, rememberMe: false })).toMatchObject({ success: false });
      expect(await m.login.loginAction({ email: user.email, password: NEW_PASSWORD, rememberMe: false })).toMatchObject({ success: true });
      expect(await prisma.session.count({ where: { userId: user.id, revokedAt: { not: null } } })).toBe(1);
    });

    it("KYC: submit → PENDING; staff review; customers cannot review", async () => {
      const cust = await seedUser();
      const admin = await seedUser({ role: "ADMIN" });
      await signIn("kyc-c", cust.user);
      const form = { pan: "abcde1234f", aadhaar: "123456789012", panDocument: IMG, aadhaarDocument: IMG, selfie: IMG, addressProof: IMG };
      expect(await m.kyc.submitKycAction({ ...form, aadhaar: "123" })).toMatchObject({ success: false });
      expect(await m.kyc.submitKycAction({ ...form, selfie: "data:text/html;base64,PGI+" })).toMatchObject({ success: false });
      expect(await m.kyc.submitKycAction(form)).toEqual({ success: true });
      expect(await m.kyc.submitKycAction(form)).toMatchObject({ success: false });
      const kyc = await prisma.kyc.findUniqueOrThrow({ where: { userId: cust.user.id }, include: { documents: true } });
      expect(kyc).toMatchObject({ status: "PENDING", pan: "ABCDE1234F" });
      expect(kyc.documents).toHaveLength(4);

      await expect(m.adminKyc.reviewKycAction({ kycId: kyc.id, decision: "VERIFIED" })).rejects.toThrow("NEXT_REDIRECT:/dashboard");
      await signIn("kyc-a", admin.user);
      expect(await m.adminKyc.reviewKycAction({ kycId: kyc.id, decision: "REJECTED" })).toMatchObject({ success: false });
      expect(await m.adminKyc.reviewKycAction({ kycId: kyc.id, decision: "VERIFIED" })).toEqual({ success: true });
      expect(await prisma.kyc.findUniqueOrThrow({ where: { id: kyc.id } })).toMatchObject({ status: "VERIFIED", reviewedById: admin.user.id });
      expect(await m.adminKyc.reviewKycAction({ kycId: kyc.id, decision: "REJECTED", rejectionReason: "x" })).toMatchObject({ success: false });
    });

    it("admin: suspending a user locks them out at once; role changes are SUPER_ADMIN-only; no self-edits", async () => {
      const target = await seedUser();
      const admin = await seedUser({ role: "ADMIN" });
      const root = await seedUser({ role: "SUPER_ADMIN" });
      await signIn("t", target.user);
      await signIn("adm", admin.user);
      expect(await m.adminUsers.updateUserStatusAction({ userId: admin.user.id, status: "SUSPENDED" })).toMatchObject({ success: false });
      expect(await m.adminUsers.updateUserRoleAction({ userId: target.user.id, role: "AUDITOR" })).toMatchObject({ success: false });
      expect(await m.adminUsers.updateUserStatusAction({ userId: root.user.id, status: "SUSPENDED" })).toMatchObject({ success: false });
      expect(await m.adminUsers.updateUserStatusAction({ userId: target.user.id, status: "SUSPENDED", reason: "test" })).toEqual({ success: true });
      nx.useBrowser("t");
      expect(await m.session.getCurrentUser()).toBeNull();
      await signIn("root", root.user);
      expect(await m.adminUsers.updateUserRoleAction({ userId: target.user.id, role: "SUPPORT_AGENT" })).toEqual({ success: true });
      expect(await m.adminUsers.updateUserRoleAction({ userId: root.user.id, role: "CUSTOMER" })).toMatchObject({ success: false });
      await signIn("cust", (await seedUser()).user);
      await expect(m.adminUsers.updateUserStatusAction({ userId: target.user.id, status: "ACTIVE" })).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    });
  });

  // ====================================================================
  describe("authorization: one customer cannot touch another's money", () => {
    it("cannot use, freeze, repay, withdraw or fund someone else's resources", async () => {
      const a = await seedUser({ balance: 5000 });
      await signIn("owner", a.user);
      const card = await m.cards.issueCardAction({ accountId: a.checking.id, type: "DEBIT_VIRTUAL" });
      if (!card.success) throw new Error(card.error);
      await m.loans.applyForLoanAction({ accountId: a.checking.id, type: "PERSONAL", principal: 3000, termMonths: 12 });
      await m.invest.createInvestmentAction({ accountId: a.checking.id, type: "FIXED_DEPOSIT", principal: 500 });
      const loan = await prisma.loan.findFirstOrThrow({ where: { userId: a.user.id } });
      const inv = await prisma.investment.findFirstOrThrow({ where: { userId: a.user.id } });

      const b = await seedUser({ balance: 5000 });
      await signIn("thief", b.user);
      const before = await balanceOf(a.checking.id);
      expect(await m.cards.freezeCardAction(card.card.id)).toMatchObject({ success: false });
      expect(await m.cards.replaceCardAction(card.card.id)).toMatchObject({ success: false });
      expect(await m.loans.payEmiAction({ loanId: loan.id })).toMatchObject({ success: false });
      expect(await m.invest.withdrawInvestmentAction({ investmentId: inv.id, accountId: b.checking.id })).toMatchObject({ success: false });
      expect(await m.invest.withdrawInvestmentAction({ investmentId: inv.id, accountId: a.checking.id })).toMatchObject({ success: false });
      expect(await m.deposit.depositAction({ accountId: a.checking.id, amount: 100 })).toMatchObject({ success: false });
      expect(await m.transfer.initiateInternalTransferAction({ fromAccountId: a.checking.id, toAccountId: b.checking.id, amount: 100 })).toMatchObject({ success: false });
      expect(await m.transfer.initiateInternalTransferAction({ fromAccountId: b.checking.id, toAccountId: a.checking.id, amount: 100 })).toMatchObject({ success: false });
      expect(await balanceOf(a.checking.id)).toBe(before);
      expect(await prisma.card.findUniqueOrThrow({ where: { id: card.card.id } })).toMatchObject({ status: "ACTIVE" });
    });
  });

  // ====================================================================
  describe("single-use pending actions and one-time-code binding", () => {
    it("a code only confirms ITS transfer; starting another transfer retires the first", async () => {
      const { user, checking, savings } = await seedUser({ balance: 1000 });
      await signIn("bind", user);
      await m.transfer.initiateInternalTransferAction({ fromAccountId: checking.id, toAccountId: savings.id, amount: 100 });
      const firstCode = lastOtp.TRANSFER_CONFIRMATION;
      await m.transfer.initiateInternalTransferAction({ fromAccountId: checking.id, toAccountId: savings.id, amount: 200 });
      const secondCode = lastOtp.TRANSFER_CONFIRMATION;

      expect(await prisma.pendingAction.count({ where: { userId: user.id, type: "TRANSFER", consumedAt: null } })).toBe(1);
      expect(await m.transfer.confirmTransferAction({ code: firstCode })).toMatchObject({ success: false, error: "That code is incorrect." });
      expect(await m.transfer.confirmTransferAction({ code: secondCode })).toMatchObject({ success: true, amount: 200 });
      expect(await balanceOf(checking.id)).toBe(800);
    });

    it("a copied pending-transfer cookie is useless once the transfer has been confirmed", async () => {
      const { user, checking, savings } = await seedUser({ balance: 1000 });
      await signIn("copy", user);
      await m.transfer.initiateInternalTransferAction({ fromAccountId: checking.id, toAccountId: savings.id, amount: 100 });
      const copied = nx.getCookie("bank_pending_transfer")!;
      expect(await m.transfer.confirmTransferAction({ code: lastOtp.TRANSFER_CONFIRMATION })).toMatchObject({ success: true });

      nx.setCookieRaw("bank_pending_transfer", copied);
      expect(await m.transfer.resendTransferOtpAction()).toMatchObject({ success: false });
      expect(await m.transfer.confirmTransferAction({ code: "123456" })).toMatchObject({ success: false, error: expect.stringContaining("expired") });
      expect(await balanceOf(checking.id)).toBe(900);
      expect((await prisma.pendingAction.findFirstOrThrow({ where: { userId: user.id } })).consumedAt).not.toBeNull();
    });

    it("a pending action cannot be used by a different signed-in user", async () => {
      const a = await seedUser({ balance: 1000 });
      const b = await seedUser({ balance: 1000 });
      await signIn("owner2", a.user);
      await m.transfer.initiateInternalTransferAction({ fromAccountId: a.checking.id, toAccountId: a.savings.id, amount: 100 });
      const stolen = nx.getCookie("bank_pending_transfer")!;
      const code = lastOtp.TRANSFER_CONFIRMATION;
      await signIn("thief2", b.user);
      nx.setCookieRaw("bank_pending_transfer", stolen);
      expect(await m.transfer.confirmTransferAction({ code })).toMatchObject({ success: false });
      expect(await balanceOf(a.checking.id)).toBe(1000);
    });

    it("the new PIN's hash stays on the server (never in the cookie) and the change applies once", async () => {
      const { user, checking } = await seedUser();
      await signIn("pin2", user);
      const issued = await m.cards.issueCardAction({ accountId: checking.id, type: "DEBIT_VIRTUAL" });
      if (!issued.success) throw new Error(issued.error);
      expect(await m.cards.initiatePinChangeAction({ cardId: issued.card.id, pin: "4821", confirmPin: "4821" })).toMatchObject({ success: true });

      const cookie = nx.getCookie("bank_pending_pin_change")!;
      const claims = JSON.parse(Buffer.from(cookie.split(".")[1], "base64url").toString());
      expect(Object.keys(claims)).not.toContain("pinHash");
      expect(Object.keys(claims)).not.toContain("cardId");
      expect(cookie).not.toContain("argon2");
      const pending = await prisma.pendingAction.findFirstOrThrow({ where: { userId: user.id, type: "PIN_CHANGE" } });
      expect((pending.payload as { pinHash: string }).pinHash).toMatch(/^\$argon2id\$/);

      const code = lastOtp.CARD_PIN_CHANGE;
      expect(await m.cards.confirmPinChangeAction({ code })).toMatchObject({ success: true });
      expect((await prisma.card.findUniqueOrThrow({ where: { id: issued.card.id } })).pinHash).toMatch(/^\$argon2id\$/);
      expect(await m.cards.confirmPinChangeAction({ code })).toMatchObject({ success: false });
    });

    it("OTP codes are stored as keyed hashes, not plain or unsalted SHA-256", async () => {
      const { user, checking, savings } = await seedUser({ balance: 100 });
      await signIn("hash", user);
      await m.transfer.initiateInternalTransferAction({ fromAccountId: checking.id, toAccountId: savings.id, amount: 10 });
      const code = lastOtp.TRANSFER_CONFIRMATION;
      const row = await prisma.otpCode.findFirstOrThrow({ where: { userId: user.id, purpose: "TRANSFER_CONFIRMATION" } });
      const { createHash } = await import("node:crypto");
      expect(row.codeHash).not.toBe(code);
      expect(row.codeHash).not.toBe(createHash("sha256").update(code).digest("hex"));
      expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.contextRef).toBeTruthy(); // bound to the pending transfer
    });
  });

  // ====================================================================
  describe("session refresh (stay signed in beyond the 15-minute access token)", () => {
    const ctx = { ipAddress: "127.0.0.1", userAgent: "vitest" };

    it("renews an expired access cookie from the refresh cookie: same session, same refresh token", async () => {
      const { user } = await seedUser();
      await signIn("rf1", user);
      const refreshBefore = nx.getCookie("bank_refresh_token");

      nx.deleteCookie("bank_access_token"); // what the browser does after the 15-minute max-age
      expect(await m.session.getCurrentUser()).toBeNull();

      const refreshed = await m.session.refreshSession(ctx);
      expect(refreshed?.user.id).toBe(user.id);
      expect(nx.getCookie("bank_access_token")).toBeTruthy();
      expect((await m.session.getCurrentUser())?.id).toBe(user.id);
      expect(nx.getCookie("bank_refresh_token")).toBe(refreshBefore); // not rotated
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    });

    it("survives many simultaneous refreshes (the race that breaks rotating refresh tokens)", async () => {
      const { user } = await seedUser();
      await signIn("rf2", user);
      nx.deleteCookie("bank_access_token");
      const results = await Promise.all(Array.from({ length: 8 }, () => m.session.refreshSession(ctx)));
      expect(results.every((r) => r?.user.id === user.id)).toBe(true);
      expect((await m.session.getCurrentUser())?.id).toBe(user.id);
      expect(await prisma.session.count({ where: { userId: user.id, revokedAt: null } })).toBe(1);
    });

    it("refuses revoked sessions, expired sessions, suspended users and missing cookies — and clears cookies", async () => {
      // revoked (e.g. signed out from another device)
      const a = await seedUser();
      await signIn("rf3", a.user);
      await prisma.session.updateMany({ where: { userId: a.user.id }, data: { revokedAt: new Date() } });
      nx.deleteCookie("bank_access_token");
      expect(await m.session.refreshSession(ctx)).toBeNull();
      expect(nx.getCookie("bank_refresh_token")).toBeUndefined();

      // absolute expiry reached
      const b = await seedUser();
      await signIn("rf4", b.user);
      await prisma.session.updateMany({ where: { userId: b.user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      nx.deleteCookie("bank_access_token");
      expect(await m.session.refreshSession(ctx)).toBeNull();

      // suspended account
      const c = await seedUser();
      await signIn("rf5", c.user);
      await prisma.user.update({ where: { id: c.user.id }, data: { status: "SUSPENDED" } });
      nx.deleteCookie("bank_access_token");
      expect(await m.session.refreshSession(ctx)).toBeNull();

      // no cookie at all
      nx.useBrowser("rf6");
      nx.clearCookies();
      expect(await m.session.refreshSession(ctx)).toBeNull();

      // a forged/unknown refresh token
      nx.setCookieRaw("bank_refresh_token", "not-a-real-refresh-token");
      expect(await m.session.refreshSession(ctx)).toBeNull();
      expect(nx.getCookie("bank_refresh_token")).toBeUndefined();
    });

    it("logging out kills the refresh path too", async () => {
      const { user } = await seedUser();
      await signIn("rf7", user);
      const refreshToken = nx.getCookie("bank_refresh_token")!;
      await expect(m.logout.logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");
      nx.setCookieRaw("bank_refresh_token", refreshToken); // attacker kept a copy
      expect(await m.session.refreshSession(ctx)).toBeNull();
    });
  });

  // ====================================================================
  describe("e-mail delivery of codes and reset links (Resend is stubbed — nothing is really sent)", () => {
    let sent: { to: string[]; subject: string; text: string; html: string }[] = [];
    const stubResend = (status = 200) => {
      sent = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init: { body: string }) => {
          if (String(url).startsWith("https://api.resend.com/")) {
            sent.push(JSON.parse(init.body));
            return new Response(JSON.stringify({ id: "stub-id" }), { status });
          }
          throw new Error(`unexpected network call to ${url}`);
        })
      );
    };
    const codeIn = (mail: { text: string }) => /code is: (\d{6})/.exec(mail.text)?.[1];

    beforeAll(() => undefined);
    const enable = () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key_abcdefghijklmnop");
      vi.stubEnv("ALLOW_EMAIL_IN_TESTS", "1");
    };
    const disable = () => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
      process.env.RESEND_API_KEY = "";
      process.env.TRUSTED_PROXY_HOPS = "1";
    };

    it("signup e-mails the verification code to the new address, and that code works", async () => {
      enable();
      stubResend();
      try {
        nx.useBrowser("mail1");
        const email = "mailcheck@test.example";
        expect(await m.signup.signupAction({ firstName: "Mia", lastName: "Mail", email, phone: "+15558880001", password: PASSWORD, confirmPassword: PASSWORD, acceptTerms: true })).toEqual({ success: true });

        expect(sent).toHaveLength(1);
        expect(sent[0].to).toEqual([email]);
        expect(sent[0].subject).toMatch(/Verify your email/);
        expect(sent[0].text).toContain("Hi Mia");
        const emailed = codeIn(sent[0]);
        expect(emailed).toMatch(/^\d{6}$/);
        expect(emailed).toBe(lastOtp.SIGNUP_VERIFICATION); // same code as the one stored for verification
        expect(await m.verify.verifyEmailAction({ code: emailed! })).toEqual({ success: true });
      } finally {
        disable();
      }
    });

    it("a transfer code e-mail says what it authorises (amount and note)", async () => {
      const { user, checking, savings } = await seedUser({ balance: 1000 });
      await signIn("mail2", user);
      enable();
      stubResend();
      try {
        await m.transfer.initiateInternalTransferAction({ fromAccountId: checking.id, toAccountId: savings.id, amount: 123.45, description: "Rent for November" });
        expect(sent).toHaveLength(1);
        expect(sent[0].to).toEqual([user.email]);
        expect(sent[0].subject).toMatch(/Confirm your transfer/);
        expect(sent[0].text).toContain("$123.45");
        expect(sent[0].text).toContain("Rent for November");
        expect(codeIn(sent[0])).toBe(lastOtp.TRANSFER_CONFIRMATION);
      } finally {
        disable();
      }
    });

    it("in production the code is never logged; failures log a generic line without the code", async () => {
      const { user } = await seedUser();
      const { issueOtp } = await import("@/lib/auth/otp");
      enable();
      vi.stubEnv("NODE_ENV", "production");
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        stubResend();
        lastOtp.SIGNUP_VERIFICATION = "";
        const ok = await issueOtp(user.id, "SIGNUP_VERIFICATION");
        expect(ok.delivered).toBe(true);
        expect(lastOtp.SIGNUP_VERIFICATION).toBe(""); // the [mock-otp] log line was not written
        expect(codeIn(sent[0])).toBe(ok.code);

        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
        const failed = await issueOtp(user.id, "SIGNUP_VERIFICATION");
        expect(failed.delivered).toBe(false);
        expect(errorSpy.mock.calls.flat().join(" ")).not.toContain(failed.code);
        expect(errorSpy.mock.calls.flat().join(" ")).toMatch(/could not deliver/);
      } finally {
        errorSpy.mockRestore();
        disable();
      }
    });

    it("a provider outage never breaks signup or transfers (the user can resend)", async () => {
      enable();
      stubResend(500);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        nx.useBrowser("mail3");
        const r = await m.signup.signupAction({ firstName: "Oli", lastName: "Outage", email: "outage@test.example", phone: "+15558880002", password: PASSWORD, confirmPassword: PASSWORD, acceptTerms: true });
        expect(r).toEqual({ success: true });
        expect(await prisma.otpCode.count({ where: { user: { email: "outage@test.example" } } })).toBe(1);
        expect(await m.verify.resendVerificationOtpAction()).toEqual({ success: true });
      } finally {
        errorSpy.mockRestore();
        disable();
      }
    });

    it("password reset e-mails a one-time link; only the newest link works", async () => {
      const { user } = await seedUser();
      enable();
      stubResend();
      try {
        nx.useBrowser("mail4");
        await m.forgot.forgotPasswordAction({ email: user.email });
        const firstToken = lastResetToken;
        await m.forgot.forgotPasswordAction({ email: user.email });
        const secondToken = lastResetToken;
        expect(sent).toHaveLength(2);
        expect(sent[1].to).toEqual([user.email]);
        expect(sent[1].subject).toMatch(/Reset your password/);
        expect(sent[1].text).toMatch(/\/reset-password\?token=/);
        expect(sent[1].text).toContain(encodeURIComponent(secondToken));

        expect(await m.reset.resetPasswordAction({ token: firstToken, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })).toMatchObject({ success: false });
        expect(await m.reset.resetPasswordAction({ token: secondToken, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })).toEqual({ success: true });
      } finally {
        disable();
      }
    });

    it("unknown e-mail addresses get no mail, and the response looks identical", async () => {
      enable();
      stubResend();
      try {
        nx.useBrowser("mail5");
        expect(await m.forgot.forgotPasswordAction({ email: "nobody-here@test.example" })).toEqual({ success: true });
        expect(sent).toHaveLength(0);
      } finally {
        disable();
      }
    });
  });

  // ====================================================================
  describe("money integrity under concurrency (double-clicks, parallel requests)", () => {
    it("[regression] parallel deposits must all be counted (no lost updates)", async () => {
      for (let round = 0; round < 3; round++) {
        const { user, checking } = await seedUser();
        await signIn(`race-dep-${round}`, user);
        const results = await Promise.all(Array.from({ length: 8 }, () => m.deposit.depositAction({ accountId: checking.id, amount: 100 })));
        expect(results.every((r) => r.success)).toBe(true);
        expect(await balanceOf(checking.id)).toBe(800);
      }
    });

    it("[regression] withdrawing the same investment in parallel must pay out only once", async () => {
      const { user, checking } = await seedUser({ balance: 5000 });
      await signIn("race-inv", user);
      await m.invest.createInvestmentAction({ accountId: checking.id, type: "FIXED_DEPOSIT", principal: 1000 });
      const inv = await prisma.investment.findFirstOrThrow({ where: { userId: user.id } });
      const results = await Promise.all(Array.from({ length: 4 }, () => m.invest.withdrawInvestmentAction({ investmentId: inv.id, accountId: checking.id })));
      expect(results.filter((r) => r.success)).toHaveLength(1);
      expect(await balanceOf(checking.id)).toBeLessThan(4995); // one payout of ~990, not several
    });

    it("[regression] paying the same EMI in parallel must debit once and count one instalment", async () => {
      const { user, checking } = await seedUser();
      await signIn("race-emi", user);
      await m.loans.applyForLoanAction({ accountId: checking.id, type: "PERSONAL", principal: 6000, termMonths: 6 });
      await prisma.account.update({ where: { id: checking.id }, data: { balance: 10_000 } });
      const loan = await prisma.loan.findFirstOrThrow({ where: { userId: user.id } });
      await Promise.all(Array.from({ length: 3 }, () => m.loans.payEmiAction({ loanId: loan.id })));
      const after = await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } });
      const debited = 10_000 - (await balanceOf(checking.id));
      expect(Math.round(debited / Number(loan.emiAmount))).toBe(after.paidInstallments); // charged == credited
    });

    it("[regression] a double-submitted transfer confirmation must send the money once", async () => {
      const { user, checking, savings } = await seedUser({ balance: 1000 });
      await signIn("race-tr", user);
      await m.transfer.initiateInternalTransferAction({ fromAccountId: checking.id, toAccountId: savings.id, amount: 100 });
      const code = lastOtp.TRANSFER_CONFIRMATION;
      const results = await Promise.all([m.transfer.confirmTransferAction({ code }), m.transfer.confirmTransferAction({ code })]);
      expect(results.filter((r) => r.success)).toHaveLength(1);
      expect(await balanceOf(checking.id)).toBe(900);
      expect(await balanceOf(savings.id)).toBe(100);
    });

    it("[regression] the daily transfer limit must hold even if a confirmation is replayed", async () => {
      const { user, checking, savings } = await seedUser({ balance: 20_000 });
      await prisma.account.update({ where: { id: checking.id }, data: { dailyTransferLimit: 5000 } });
      await signIn("limit", user);
      await m.transfer.initiateInternalTransferAction({ fromAccountId: checking.id, toAccountId: savings.id, amount: 4000 });
      const savedPending = nx.getCookie("bank_pending_transfer")!; // attacker/user keeps a copy of the signed cookie
      expect(await m.transfer.confirmTransferAction({ code: lastOtp.TRANSFER_CONFIRMATION })).toMatchObject({ success: true });
      nx.setCookieRaw("bank_pending_transfer", savedPending);
      await m.transfer.resendTransferOtpAction();
      const replay = await m.transfer.confirmTransferAction({ code: lastOtp.TRANSFER_CONFIRMATION });
      expect(replay).toMatchObject({ success: false });
      expect(await balanceOf(checking.id)).toBe(16_000); // 4,000 sent today, not 8,000 (limit 5,000)
    });
  });
});
