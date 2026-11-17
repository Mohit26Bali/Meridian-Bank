# How to run — Meridian Bank

Next.js 15 (App Router, Server Actions) + PostgreSQL + Prisma. Everything below was **verified on 2026-11-14** on Windows 11 with Node 22.17.1 and PostgreSQL 17.4 unless marked *unverified*.

> **Demo software.** No real money, no real payment rails. See `PROJECT_CONTEXT.md` → *Known Issues* before exposing it to anyone else.

## Prerequisites
- **Node.js ≥ 20** (`engines` in package.json; verified on 22.17.1) and npm
- **PostgreSQL** running and reachable (verified: PostgreSQL 17.4 on `localhost:5432`; the schema uses only standard features, so other recent versions should work — *unverified*)
- An empty database for the app (the existing dev setup uses a database named `bank_dev`)

## 1. Install
```bash
npm install          # also runs `prisma generate` (postinstall); use `npm ci` on a clean checkout
```

## 2. Configure environment (`.env`)
**Do not overwrite an existing `.env`.** In this folder `.env` already exists and is configured for local development (it is git-ignored). Only on a fresh clone:
```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }   # PowerShell: never overwrites an existing file
```
Variables (placeholders only — use your own values):

| Variable | Meaning / safe example |
|---|---|
| `DATABASE_URL` | `postgresql://<user>:<password>@localhost:5432/bank_dev?schema=public` |
| `AUTH_SECRET` | ≥ 32 random characters (the app throws if shorter). `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `AUTH_ACCESS_TOKEN_TTL` | seconds, default `900` |
| `AUTH_REFRESH_TOKEN_TTL` | seconds, default `2592000` |
| `ENCRYPTION_KEY` | base64 of exactly 32 bytes (AES-256-GCM). `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NODE_ENV` | `development` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` — also the base of the links in password-reset e-mails (it is baked in at **build** time, so rebuild after changing it) |
| `RESEND_API_KEY` | API key from https://resend.com/api-keys. Create a **"Sending access"** key (least privilege — it cannot read mail or manage domains). Never commit it. Empty = e-mail disabled (see "E-mail" below) |
| `EMAIL_FROM` | `Meridian Bank <onboarding@resend.dev>` (Resend sandbox sender; default). Use `Meridian Bank <no-reply@your-domain>` once your domain is verified |
| `TRUSTED_PROXY_HOPS` | number of reverse proxies in front of the app: `0` locally (default), `1` behind a single proxy/CDN such as Render, Vercel or nginx. Controls whether `X-Forwarded-For` is trusted for client IPs / rate limits |

⚠ **Never change `ENCRYPTION_KEY` after cards / 2FA have been created** — existing encrypted card numbers, CVVs and TOTP secrets become undecryptable.

## 3. Database
```bash
npx prisma migrate status    # read-only: should say "Database schema is up to date!"
npx prisma migrate deploy    # apply the 4 committed migrations (the 4th, 2026-11-16, adds the pending_actions table)
```
Use `migrate deploy`, not `migrate dev` (interactive, can reset data). Verified 2026-11-16: `bank_dev` has all 4 migrations applied (the new one only adds an empty table). **After pulling these changes on another machine you must run `npx prisma migrate deploy`**, otherwise transfers and PIN changes fail ("table pending_actions does not exist"). There is **no seed script**; the app starts with an empty database (the current `bank_dev` has 0 users).

## 4. Start
```bash
npm run dev          # http://localhost:3000   (Next.js dev server)
```
`next` was upgraded to **15.5.29** on 2026-11-16 (the critical RCE advisory affected ≤ 15.5.23 and more advisories ≤ 15.5.27). `next dev` listens on all network interfaces by default; for a personal machine it is still good practice to bind to localhost only: `npx next dev -H 127.0.0.1` (verified working).

Production-style run (verified to build and serve): `npm run build` then `npm run start` (add `-H 127.0.0.1 -p 3000` via `npx next start -H 127.0.0.1`). In production mode one-time codes and reset links are **only delivered by e-mail** (they are never printed to the log), so `RESEND_API_KEY` must be set — see "E-mail" below.

## E-mail (one-time codes and password-reset links)
The app e-mails sign-up codes, transfer confirmation codes, card-PIN-change codes and password-reset links through **Resend** (`src/lib/email/`; plain `fetch`, no SDK). Verified on 2026-11-16 against the real production build and the real Resend API (35/35 live checks, see PROJECT_CONTEXT.md §6c).
- **Development (`npm run dev`)**: the code/link is e-mailed *and* also printed in the server terminal (`[mock-otp] … code=123456`, `[mock-email] password reset token …`), so you can always continue even if mail can't be delivered.
- **Production**: only e-mail. If sending fails, the error is logged **without the code** (`[otp] could not deliver …`) and the user can press "resend".
- **Resend sandbox rules (important):** without a verified domain you can only send from `onboarding@resend.dev`, and **only to the e-mail address of your own Resend account** (other recipients are rejected with HTTP 403 — logged as `[email] delivery failed (rejected HTTP 403)`). To e-mail real customers: add and verify a domain at https://resend.com/domains (DNS records), then set `EMAIL_FROM="Meridian Bank <no-reply@your-domain>"`.
- **To test without a real inbox**, sign up with `delivered@resend.dev` (Resend's official test address). The message shows up in https://resend.com/emails.
- **Automated tests never send e-mail** (`sendEmail` refuses when `NODE_ENV=test`).
- **Keys:** use a *sending-only* key in `.env`. If a key is ever exposed (pasted into chat, committed, logged), delete it in the Resend dashboard and create a new one — nothing else needs to change.

## 5. Using the app locally
1. Open http://localhost:3000 → **Sign up** (password: ≥ 12 chars with upper, lower, digit and symbol).
2. A 6-digit code is e-mailed to the address you signed up with (and printed in the dev server terminal). Enter it on the verify page. Verifying creates a Checking and a Savings account.
3. Transfers and card-PIN changes also ask for an e-mailed code (the transfer e-mail states the amount and note). The code only works for **that** transfer/PIN change and only once. Password reset: "Forgot password" → open the e-mailed link (only the newest link works).
4. **Admin area (`/admin`)** needs a staff role and there is no UI to create the first one. *Unverified* (not run during the audit): after signing up, promote yourself in SQL — `UPDATE users SET role = 'SUPER_ADMIN' WHERE email = '<your-email>';` (enum values: `CUSTOMER, SUPPORT_AGENT, AUDITOR, ADMIN, SUPER_ADMIN`).
5. **Sessions** stay alive automatically: the 15-minute access cookie is silently renewed from the refresh cookie (30 days with "remember me", about 7 otherwise). Signing out, changing/resetting the password, or revoking a session ends it immediately.
6. After the 2026-11-16 security updates everyone must sign in again once (old login cookies are no longer accepted), and any half-finished transfer/PIN change must be restarted.

## Tests and checks
```bash
npm test             # Vitest — 106 tests in 10 files, all passing (verified 2026-11-16, repeated runs stable)
npx tsc --noEmit     # type-check — clean
npm run lint         # ESLint — clean
npm run build        # production build — succeeds with no warnings (verified from a clean .next on 2026-11-16)
npm audit --omit=dev # 0 critical, 8 high, 1 moderate — the rest need Prisma 7 / Zod 4 (see PROJECT_CONTEXT.md §5 #21)
```
- **61 unit tests** (email client/templates, middleware refresh logic, client-IP parsing, redirect safety, crypto, rate limiter, …) need nothing but Node. **45 integration tests** (`src/test/bank.integration.test.ts`) call the real Server Actions against a **throwaway PostgreSQL database that they create and drop themselves** (`bank_test_<random>`; they refuse to run against anything else and never touch `bank_dev`). They need a PostgreSQL server reachable through the `DATABASE_URL` in `.env` (the role must be allowed to `CREATE DATABASE`; override the server with `TEST_DATABASE_URL`). **If PostgreSQL isn't reachable they skip themselves** instead of failing.
- Run only the integration suite: `npx vitest run src/test/bank.integration.test.ts` (≈ 13 s).
- No component or browser (E2E) tests exist yet; the README mentions ad hoc Playwright runs that are not in the repo.

## Default ports
Next.js 3000 · PostgreSQL 5432.

## Troubleshooting
- **`AUTH_SECRET is missing or too short`** — set a ≥ 32 character secret in `.env`.
- **`ENCRYPTION_KEY must decode to exactly 32 bytes`** — regenerate with the command above.
- **`Can't reach database server` / P1001** — start PostgreSQL; check host/port/credentials in `DATABASE_URL`.
- **`The table … does not exist`** — run `npx prisma migrate deploy`.
- **Redirect loop between `/dashboard` and `/login`** — stale cookies for a suspended/deleted user: clear the site's cookies or visit `/api/auth/session-expired`.
- **Blank/unstyled page when serving the production build over plain `http://`** — *unverified*: the CSP contains `upgrade-insecure-requests` and production sets HSTS; use `npm run dev` locally, HTTPS in production.
- **argon2 install errors** — it is a native module; use a supported Node version and a matching OS/arch (build Docker images on the target platform).
- **KYC upload fails with a large image** — the Server-Action body limit is 15 MB (`next.config.ts`); verified on the live production server with a 4.6 MB, four-photo submission. Each image must be a PNG/JPEG/WEBP under ~2.5 MB (Zod validation).
- **Integration tests are skipped** — PostgreSQL wasn't reachable or the role can't create databases (see Tests and checks).
- **`The table … pending_actions does not exist`** — run `npx prisma migrate deploy` (see section 3).
- **No e-mail arrives** — check, in order: `RESEND_API_KEY` is set (and the server was restarted); the recipient is **your own Resend account address** unless a domain is verified (HTTP 403 in the log otherwise); the message appears in https://resend.com/emails with status `delivered`; spam folder. In development you can always use the code printed in the server terminal.
- **`[otp] could not deliver …` in production logs** — Resend rejected or was unreachable; the user can request a new code. Nothing sensitive is logged.
- **Everyone shows the same IP / rate limits are shared** — behind a reverse proxy set `TRUSTED_PROXY_HOPS=1` (or the right hop count). Locally leave it `0`.
- **Clock-skew gotcha (found while testing):** this PC's clock appeared to run ~2½ minutes ahead of Resend's. Comparing local timestamps with Resend's (e.g. in scripts) is unreliable — compare message IDs instead. It is worth syncing the Windows clock (Settings → Time & language → Date & time → Sync now).
