import { NextResponse, type NextRequest } from "next/server";
import { revokeCurrentSession } from "@/lib/auth/session";

/**
 * A still-valid access token JWT only proves the token was signed correctly —
 * it says nothing about whether the underlying account is still ACTIVE. When
 * a Server Component finds the account suspended/locked/closed, it can't
 * clear cookies itself (cookies can only be mutated from a Server Action or
 * Route Handler), so it redirects here instead: this clears the stale
 * cookies so middleware stops treating the browser as authenticated, which
 * is what prevents an infinite /dashboard <-> /login redirect loop.
 */
export async function GET(request: NextRequest) {
  await revokeCurrentSession();
  return NextResponse.redirect(new URL("/login", request.url));
}
