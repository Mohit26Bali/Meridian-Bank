import { NextResponse, type NextRequest } from "next/server";
// Narrow entry point on purpose: the full "jose" bundle also contains JWE/compression code that the
// Edge runtime doesn't support and that triggers a "Compiled with warnings" message on clean builds.
import { jwtVerify } from "jose/jwt/verify";

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];
const AUTH_ONLY_PREFIXES = [
  "/login",
  "/signup",
  "/verify",
  "/forgot-password",
  "/reset-password",
];

const ACCESS_TOKEN_COOKIE = "bank_access_token";

function encoder() {
  return new TextEncoder();
}

async function isAuthenticated(request: NextRequest) {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return false;

  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;

  try {
    const { payload } = await jwtVerify(token, encoder().encode(secret), {
      algorithms: ["HS256"],
    });
    // Must be a real access token ("access" == ACCESS_TOKEN_TYPE in lib/auth/tokens.ts, repeated
    // here because the Edge runtime can't import that file). Purpose tokens share the key.
    // Session liveness is checked in getCurrentUser(); middleware only does the cheap check.
    return payload.typ === "access" && typeof payload.sessionId === "string";
  } catch {
    return false;
  }
}

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV !== "production";

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ];

  return directives.join("; ");
}

const REFRESH_TOKEN_COOKIE = "bank_refresh_token";
const REFRESH_PATH = "/api/auth/refresh";

interface RefreshOutcome {
  /** Set-Cookie headers from the refresh endpoint (new access cookie, or cookie deletions on failure). */
  setCookies: string[];
  /** The new access token, if the refresh succeeded. */
  accessToken?: string;
}

/**
 * The access cookie lives 15 minutes; the refresh cookie lives for the whole session. When only the
 * latter is left, ask the Node-runtime refresh endpoint (Prisma isn't available at the edge) for a new
 * access token. Done here so it is transparent to pages AND to Server Action POSTs.
 */
async function refreshAccessToken(request: NextRequest): Promise<RefreshOutcome | null> {
  try {
    const response = await fetch(new URL(REFRESH_PATH, request.nextUrl.origin), {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
        "user-agent": request.headers.get("user-agent") ?? "",
        "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
        "x-real-ip": request.headers.get("x-real-ip") ?? "",
      },
      cache: "no-store",
    });

    const setCookies = response.headers.getSetCookie();
    if (!response.ok) return { setCookies };

    const accessCookie = setCookies.find((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
    const accessToken = accessCookie?.slice(ACCESS_TOKEN_COOKIE.length + 1).split(";")[0];
    return accessToken ? { setCookies, accessToken } : { setCookies };
  } catch {
    return null; // refresh endpoint unreachable: behave as logged out for this request
  }
}

/** Returns the request's Cookie header with the access cookie replaced by `accessToken`. */
function withAccessCookie(cookieHeader: string, accessToken: string) {
  const kept = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
  return [...kept, `${ACCESS_TOKEN_COOKIE}=${accessToken}`].join("; ");
}

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let authed = await isAuthenticated(request);
  let cookiesToSet: string[] = [];

  const canRefresh =
    !authed &&
    Boolean(request.cookies.get(REFRESH_TOKEN_COOKIE)?.value) &&
    pathname !== REFRESH_PATH &&
    pathname !== "/api/auth/session-expired";

  if (canRefresh) {
    const outcome = await refreshAccessToken(request);
    if (outcome) {
      cookiesToSet = outcome.setCookies;
      if (outcome.accessToken) {
        authed = true;
        // Let the page / action being served in THIS request see the new access cookie too.
        requestHeaders.set("cookie", withAccessCookie(request.headers.get("cookie") ?? "", outcome.accessToken));
      }
    }
  }

  const withCookies = (res: NextResponse) => {
    for (const c of cookiesToSet) res.headers.append("set-cookie", c);
    return res;
  };

  if (
    PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    !authed
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return withCookies(NextResponse.redirect(loginUrl));
  }

  if (
    AUTH_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    authed
  ) {
    return withCookies(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  const response = withCookies(
    NextResponse.next({
      request: { headers: requestHeaders },
    })
  );

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
