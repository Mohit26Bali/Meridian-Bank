# Meridian Bank

A full-stack, production-style banking platform built with Next.js 15 (App Router), React 19, PostgreSQL, and Prisma. It's a **demonstration product** — no real money moves, no real payment providers are integrated, and no real financial institution is behind it — but the engineering is built to the standard of a real one: Argon2 password hashing, AES-256-GCM encryption at rest, TOTP two-factor authentication, signed OTP challenge flows, role-based admin access, audit logging, and a strict nonce-based CSP.

## Tech stack

- **Framework**: Next.js 15 (App Router, Server Actions, Route Handlers), React 19, TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Styling**: Tailwind CSS v4, shadcn/ui (Radix primitives), Framer Motion
- **Auth**: Argon2id password hashing, JWT access tokens (`jose`), opaque refresh tokens, TOTP 2FA (`otpauth` + `qrcode`)
- **Forms**: react-hook-form + Zod validation
- **Charts**: Recharts
- **Testing**: Vitest (unit tests), Playwright (used ad hoc for E2E verification during development)

## Getting started

### Prerequisites

- Node.js 20+
- A local PostgreSQL instance (no Docker setup required — just a running `postgres` server and a database)

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in real values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Purpose |
   | --- | --- |
   | `DATABASE_URL` | Postgres connection string |
   | `AUTH_SECRET` | Signing secret for JWT access tokens — use a long random string |
   | `AUTH_ACCESS_TOKEN_TTL` | Access token lifetime in seconds (default 900 = 15 min) |
   | `AUTH_REFRESH_TOKEN_TTL` | Refresh token lifetime in seconds (default 2,592,000 = 30 days) |
   | `ENCRYPTION_KEY` | Base64-encoded 32-byte key used for AES-256-GCM encryption of card numbers/CVVs/2FA secrets at rest |
   | `NEXT_PUBLIC_APP_URL` | Public base URL, used for absolute links in metadata (OpenGraph, sitemap, robots.txt) |

   Generate a valid `ENCRYPTION_KEY`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

3. Run Prisma migrations against your database:

   ```bash
   npx prisma migrate deploy
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build (run `build` first) |
| `npm run lint` | ESLint |

## Architecture

Routes are organized into four route groups under `src/app`, each with its own layout:

- **`(marketing)`** — public landing page and product pages. Fully static-content, no auth required.
- **`(auth)`** — login, signup, email verification, password reset. Redirects authenticated users away.
- **`(app)`** — the customer dashboard: accounts, transfers, cards, loans, investments, notifications, profile, settings. Requires an active session.
- **`(admin)`** — staff-only tools: user management, KYC review, audit logs. Requires a staff role (`SUPPORT_AGENT`, `AUDITOR`, `ADMIN`, or `SUPER_ADMIN`); permissions are further tiered within the section (e.g. only `SUPER_ADMIN` can reassign roles).

Supporting code lives under `src/lib`:

- `lib/auth` — session/token management, TOTP, admin role permissions
- `lib/security` — encryption, rate limiting, audit logging, request context, CSP-adjacent concerns
- `lib/banking` — account/transaction queries and formatting shared across pages
- `lib/validations` — Zod schemas, one per domain area
- `lib/admin` — admin-only data queries (cross-user by design, gated by caller)

Server Actions live under `src/actions`, mirroring the same domain split (`actions/auth`, `actions/banking`, `actions/admin`, etc.).

### Notable security details

- **CSP**: `middleware.ts` generates a per-request nonce and sets a strict `script-src 'self' 'nonce-...' 'strict-dynamic'` policy. The root layout reads that nonce via `headers()` — that read is what causes Next.js to stamp the nonce onto every script tag it emits, including its own hydration bootstrap. **Do not remove that `headers()` call** without understanding this; without it, every script on every page silently fails CSP in production. This nonce requirement also means the app is fully dynamically rendered (no static prerendering) — an accepted trade-off, not an oversight.
- **Encryption at rest**: card numbers, CVVs, and TOTP secrets are AES-256-GCM encrypted before being stored (`lib/security/encryption.ts`).
- **Rate limiting**: in-memory, fixed-window (`lib/security/rate-limit.ts`). Fine for a single instance; back it with Redis before running more than one server process.
- **IDOR protection**: every query that takes a client-supplied ID scopes it to the authenticated user's ID (customer-facing) or gates on staff role (admin-facing) — see any `lib/banking/queries.ts` or `actions/admin/*` function for the pattern.

## Deployment

1. Provision a PostgreSQL database and set `DATABASE_URL` (and every other variable in `.env.example`) on the host.
2. Install dependencies — `npm install` triggers `prisma generate` automatically via the `postinstall` script, so the Prisma Client is always regenerated fresh on a clean checkout.
3. Apply migrations against the production database: `npx prisma migrate deploy` (not `migrate dev`, which is interactive and dev-only).
4. `npm run build && npm run start`, or hand the build off to your platform (Vercel, a container, etc.).

A few things worth knowing before deploying:

- **`argon2` is a native Node addon.** It needs a real Node.js runtime (not the Edge runtime) and a platform-matching prebuilt binary — this is why password hashing and TOTP verification only ever run in Server Actions/Server Components, never in `middleware.ts`. If you deploy inside Docker, build the image on the same OS/arch you'll run it on (or let `npm install` run inside the container) so the correct native binary gets installed.
- **The app is fully dynamically rendered** (see the CSP note above) — there's no static export to serve from a CDN edge; it needs a running Node.js server for every request.
- **The in-memory rate limiter resets per process.** Fine for a single instance; if you run more than one server process behind a load balancer, replace `lib/security/rate-limit.ts`'s in-memory store with Redis first, or limits become effectively multiplied by the instance count.

## Mock banking model

This app **does not integrate any real payment rails**. Transfers, deposits, card issuance, loan disbursement, and investment growth are all simulated:

- Balances are plain Postgres rows updated in a transaction.
- Investment "returns" are a deterministic pseudo-random function of the investment ID and date — no cron job, no real market data.
- KYC documents are stored as base64 data URLs directly in Postgres (no S3/blob storage) with simulated OCR extraction.
- OTP codes are logged to the server console (`[mock-otp] ...`) instead of sent by SMS/email — there is no real delivery provider configured.

## Status and limitations

A working demo banking platform (Next.js, Prisma, PostgreSQL); all money is simulated. Before it could be used with real customers it would need: a verified e-mail sending domain (without one Resend only delivers to the account owner), encryption of personal data at rest, a shared store such as Redis for rate limits when more than one server runs, and upgrades for the remaining dependency advisories.
