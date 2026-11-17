import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/auth/session";
import { getRequestContext } from "@/lib/security/request-context";

// Node runtime: needs Prisma. Called by src/middleware.ts when the access cookie has expired but the
// refresh cookie is still present. The refresh cookie is httpOnly + SameSite=Strict, so a cross-site page
// cannot make the browser send it; the response only ever sets cookies and returns no user data.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const ctx = await getRequestContext();
  const result = await refreshSession(ctx);

  if (!result) {
    // refreshSession already cleared the cookies; the Set-Cookie headers travel with this response.
    return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
