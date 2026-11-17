# Meridian Bank — AI assistant entry point

Read in this order before changing anything:
1. `PROJECT_CONTEXT.md` — architecture, data model, flows, security findings, known issues, conventions. **Start here.**
2. `How to run.md` — verified setup, env vars, e-mail (Resend) setup, ports, tests.
3. `README.md` — product overview (written by the original author; some claims are corrected in PROJECT_CONTEXT.md).

Quick facts
- Next.js 15.5 App Router + Server Actions, React 19, TypeScript, PostgreSQL via Prisma 6, Zod, argon2, jose (JWT). Demo banking app — all money is simulated.
- Server logic lives in `src/actions/**` (mutations) and `src/lib/**`; pages in `src/app/(marketing|auth|app|admin)`.
- Checks: `npm test` (106 tests: 61 unit + 45 integration that call the real Server Actions against a **throwaway Postgres database they create/drop themselves**, skipped if Postgres is unreachable), `npx tsc --noEmit`, `npm run lint`, `npm run build`. No browser/UI tests yet. Add a regression test in `src/test/bank.integration.test.ts` for any money/auth bug you fix.
- Money rules (enforced by tests): balance changes are atomic `increment/decrement` or conditional `updateMany` claims — **never read a balance/status in JS and write it back**.
- Auth rules (enforced by tests): access tokens carry `typ:"access"` + `sessionId` and `getCurrentUser()` checks the live session row; multi-step actions (transfer, PIN change) are **single-use `PendingAction` rows** consumed inside the money transaction, and each one-time code is bound to its row via `OtpCode.contextRef`. Don't put sensitive details back into cookies.
- Sessions refresh silently: the middleware calls `POST /api/auth/refresh` when only the refresh cookie remains. Refresh tokens are deliberately **not rotated** (rotation races under parallel requests) — see PROJECT_CONTEXT.md §6d.
- E-mail goes through Resend (`src/lib/email/`). Env: `RESEND_API_KEY` (**send-only** key), `EMAIL_FROM`, `TRUSTED_PROXY_HOPS`. Without a verified domain Resend only delivers to the account owner's own address; use `delivered@resend.dev` to test. Codes/links are printed to the dev log only when `NODE_ENV !== "production"`. Tests never send mail.
- **Never print, commit or overwrite `.env`** (real local secrets incl. the Resend key; `ENCRYPTION_KEY` must not change once cards/2FA exist). Never copy API keys from anywhere (files, chat) into logs, docs or source. Do not run `prisma migrate dev`/`reset` against `bank_dev` without asking; use `migrate deploy` (the 4th migration, `pending_actions`, must be deployed wherever the code runs).
- Do not remove the `headers()` read in the root layout (CSP nonce depends on it).
- The audit's critical/high issues and the P1 items (e-mail delivery, session refresh, trusted-proxy IPs, single-use pending actions, keyed OTP hashing) were **fixed and tested on 2026-11-16** (`PROJECT_CONTEXT.md` §5, §6b–§6d). Still open before real customers: verified e-mail domain, key rotation, PII encryption, Redis for multi-instance rate limits, Prisma 7 / Zod 4 upgrades, browser tests, first git commit + CI run (§8).
