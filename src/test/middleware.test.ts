import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

const SECRET = "test-secret-test-secret-test-secret-123456";
let middleware: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  process.env.AUTH_SECRET = SECRET;
  ({ middleware } = await import("@/middleware"));
});

const key = () => new TextEncoder().encode(SECRET);
const signed = (claims: Record<string, unknown>, expires: string | number = "10m") =>
  new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setExpirationTime(expires).sign(key());

const req = (path: string, cookie = "") =>
  new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });

const refreshReply = (status: number, cookies: string[]) => {
  const headers = new Headers();
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(JSON.stringify({ ok: status === 200 }), { status, headers });
};

describe("middleware: auth gating and transparent session refresh", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lets a valid access token through without calling the refresh endpoint", async () => {
    const access = await signed({ sub: "u1", typ: "access", sessionId: "s1", role: "CUSTOMER" });
    const res = await middleware(req("/dashboard", `bank_access_token=${access}; bank_refresh_token=r1`));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated visitor with no cookies to /login (and does not refresh)", async () => {
    const res = await middleware(req("/dashboard/transfer"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?redirectTo=%2Fdashboard%2Ftransfer");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes an EXPIRED access token using the refresh cookie and forwards the new cookie", async () => {
    const expired = await signed({ sub: "u1", typ: "access", sessionId: "s1" }, Math.floor(Date.now() / 1000) - 60);
    fetchMock.mockResolvedValue(
      refreshReply(200, ["bank_access_token=NEW.ACCESS.TOKEN; Path=/; Max-Age=900; HttpOnly; SameSite=strict"])
    );

    const res = await middleware(
      req("/dashboard", `theme=dark; bank_access_token=${expired}; bank_refresh_token=refresh-abc`)
    );

    // served, not redirected
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    // the browser receives the new access cookie ...
    expect(res.headers.get("set-cookie")).toContain("bank_access_token=NEW.ACCESS.TOKEN");
    // ... and the page rendered in THIS request already sees it (old one replaced, others kept)
    const forwarded = res.headers.get("x-middleware-request-cookie") ?? "";
    expect(forwarded).toContain("bank_access_token=NEW.ACCESS.TOKEN");
    expect(forwarded).not.toContain(expired);
    expect(forwarded).toContain("theme=dark");
    expect(forwarded).toContain("bank_refresh_token=refresh-abc");

    // it called the internal refresh endpoint with the visitor's cookies
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://localhost:3000/api/auth/refresh");
    expect(init.method).toBe("POST");
    expect(init.headers.cookie).toContain("bank_refresh_token=refresh-abc");
  });

  it("refreshes when the access cookie is simply missing (browser dropped it after 15 min)", async () => {
    fetchMock.mockResolvedValue(refreshReply(200, ["bank_access_token=FRESH; Path=/; HttpOnly"]));
    const res = await middleware(req("/dashboard/accounts", "bank_refresh_token=r1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-request-cookie")).toContain("bank_access_token=FRESH");
  });

  it("when the refresh is rejected, sends the visitor to /login and clears the dead cookies", async () => {
    fetchMock.mockResolvedValue(
      refreshReply(401, [
        "bank_access_token=; Path=/; Max-Age=0",
        "bank_refresh_token=; Path=/; Max-Age=0",
      ])
    );
    const res = await middleware(req("/dashboard", "bank_refresh_token=revoked"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?redirectTo=%2Fdashboard");
    const cookies = res.headers.getSetCookie().join(" | ");
    expect(cookies).toContain("bank_refresh_token=;");
  });

  it("treats an unreachable refresh endpoint as logged out (no crash)", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const res = await middleware(req("/dashboard", "bank_refresh_token=r1"));
    expect(res.status).toBe(307);
  });

  it("does not try to refresh for the refresh endpoint itself (no loops)", async () => {
    const res = await middleware(req("/api/auth/refresh", "bank_refresh_token=r1"));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not accept a purpose token as an access token", async () => {
    const purpose = await signed({ sub: "u1", typ: "login_2fa" });
    const res = await middleware(req("/dashboard", `bank_access_token=${purpose}`));
    expect(res.status).toBe(307);
    expect(fetchMock).not.toHaveBeenCalled(); // no refresh cookie, so nothing to refresh
  });

  it("sends an already-authenticated user away from /login", async () => {
    const access = await signed({ sub: "u1", typ: "access", sessionId: "s1" });
    const res = await middleware(req("/login", `bank_access_token=${access}`));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("still sets the strict security headers on normal responses", async () => {
    const res = await middleware(req("/"));
    expect(res.headers.get("content-security-policy")).toContain("script-src 'self' 'nonce-");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });
});
